import { createHash } from 'crypto';
import { callGeminiWithRetry } from './geminiClient';
import { normalizeChampionName } from './championNames';
import { formatChampId, getAllChampionIds, getChampionAbilityNames } from './ddragonClient';
import { fetchAllRows } from './fetchAll';

// ============================================================
// 辞典(matchup_sentinel) / コーチAI知識層(champion_facts, champion_notes) /
// ナレッジ(personal_knowledge) の一斉ファクトチェック。
//
// 目的は2つ:
//  1. champion列の表記ゆれ・ゴミ値検出（スキン名混入や単発文字等が
//     グルーピングを狂わせ、辞典の質を下げている実例が見つかったため）
//  2. チャンピオン単位で全ソースをまとめてAIに横断照合させ、矛盾・
//     単一ソースのみの未確証claim・公式データとの食い違いを検出する
//     （レコード単位ではなくチャンピオン単位でAI呼び出しをまとめ、
//     約1,900レコード→約170コールに圧縮してGemini無料枠に収める）
//
// 検出結果は自動修正・自動削除せず、すべて dict_fact_check_queue に
// 積んで人間が最終判断する（辞典データを機械的に消すリスクを避けるため）。
// ============================================================

const NON_CHAMPION_MARKERS = new Set(['GLOBAL', 'SYSTEM', 'UNKNOWN', 'GENERAL']);

/**
 * 「特定のチャンピオンに関する記事ではない」ことを明示する際に書き込むマーカー値。
 * personal_knowledgeは既存の慣習(他機能が`.neq('champion','Unknown')`で除外している)に
 * 合わせて'Unknown'を踏襲。champion_notes/matchup_sentinelは'SYSTEM'が別の意味
 * (システム用の内部レコード)で既に使われているため、混同を避けて'GENERAL'を使う。
 */
export function getNoChampionMarker(table: string): string {
  return table === 'personal_knowledge' ? 'Unknown' : 'GENERAL';
}

/**
 * 表記揺れを実際のDataDragon ID相当まで正規化する。
 * championNames.ts(日本語・既知の英語表記ゆれ)とddragonClient.ts
 * (アポストロフィ/スペース除去)は担当範囲が異なり、片方だけでは
 * 例えば "Bel'Veth" と "BelVeth" が同一チャンピオンとして揃わない。
 * 両方を通すことでこのギャップを埋める。
 */
export function resolveChampionId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (NON_CHAMPION_MARKERS.has(trimmed.toUpperCase())) return null;
  return formatChampId(normalizeChampionName(trimmed));
}

/**
 * resolveChampionId()で正規化した上で、DataDragonの実在チャンピオン一覧と照合し、
 * 実在するチャンピオンIDだけを返す（存在しなければnull）。
 *
 * 辞典まわりの書き込み経路は、これまでファイルごとに「normalizeChampionNameだけ」
 * 「resolveChampionIdまで」「独自のFAKE_CHAMPIONS除外リスト」とバラバラの正規化しか
 * 行っておらず、これが表記ゆれによる孤立レコード（champ_Kai'sa_global等）や、
 * 手作りの除外リストが経路ごとに食い違ってゴミ値が混入し続ける根本原因になっていた。
 * 「実在チャンピオンかどうか」を唯一の判定基準にすることで、除外リストの保守漏れ
 * そのものを構造的に無くす。実在チャンピオンへ正規化する必要がある書き込み経路は
 * すべてこの関数に統一すること。
 */
export async function resolveToRosterChampion(raw: string | null | undefined): Promise<string | null> {
  const resolved = resolveChampionId(raw);
  if (!resolved) return null;
  const roster = await getAllChampionIds();
  const rosterArr = Array.from(roster);
  return rosterArr.find((r) => r.toLowerCase() === resolved.toLowerCase()) || null;
}

/**
 * カンマ区切りの複数チャンピオン文字列(例: "Ahri, Zed, Jungle")を、実在チャンピオンだけの
 * 配列に正規化する。解決できない断片（ゴミ値・プレースホルダー）は黙って除外され、
 * 重複は取り除かれる。
 */
export async function resolveChampionListString(raw: string | null | undefined): Promise<string[]> {
  if (!raw) return [];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    const champ = await resolveToRosterChampion(part);
    if (champ && !resolved.includes(champ)) resolved.push(champ);
  }
  return resolved;
}

export interface QueuedIssue {
  champion: string;
  issue_type: 'contradiction' | 'unconfirmed_source' | 'possible_fact_error' | 'invalid_champion_tag';
  summary: string;
  detail?: {
    claim_a?: string;
    claim_b?: string;
    conflict_reason?: string;
    target_field?: string;
  };
  source_refs?: any;
}

/**
 * 未処理(pending)のレビュー件数がこれを超えたら、新規スキャンでの積み増しを止める。
 * 「溜まった未処理を"資産"と錯覚せず、まず今あるものを片付けてから次を積む」という
 * 運用側の在庫制限（Loop Engineeringの知見）。既に検出済みの項目のレビュー自体は
 * 妨げず、あくまで「新しく検出を増やす」動作だけを一時停止する。
 */
const PENDING_QUEUE_CAP = 50;

async function getPendingQueueCount(supabase: any): Promise<number> {
  const { count } = await supabase
    .from('dict_fact_check_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  return count || 0;
}

// ------------------------------------------------------------
// ステップ1: champion列の不正タグ検出（LLM不要・無料）
// ------------------------------------------------------------
const INVALID_TAG_TARGETS: { table: 'matchup_sentinel' | 'champion_notes' | 'personal_knowledge'; skip: string[] }[] = [
  { table: 'matchup_sentinel', skip: ['SYSTEM', 'GENERAL'] },
  { table: 'champion_notes', skip: ['SYSTEM', 'GENERAL'] },
  { table: 'personal_knowledge', skip: ['UNKNOWN'] },
];

export interface InvalidTagScanResult {
  inserted: number;
  autoResolved: number;
  capped: boolean;
}

/**
 * personal_knowledgeだけはUI(LibraryTabContent.tsx)がカンマ区切りで複数チャンピオンを
 * 1行に紐付けられる設計だが、この関数のresolveChampionIdは単一チャンピオン文字列専用の
 * ため、"Graves, Jax"のような正当な複数紐付けが恒久的にinvalid_champion_tagとして
 * 検出され続けていた(2026-08-05発覚)。カンマ区切りの断片を1つずつ判定し、実在する
 * チャンピオンが1つでも含まれていれば正常な行として扱う。
 */
function isChampionListValid(raw: string, rosterLower: Map<string, string>): boolean {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.some((part) => {
    const resolved = resolveChampionId(part);
    return !!(resolved && rosterLower.has(resolved.toLowerCase()));
  });
}

export async function scanInvalidChampionTags(supabase: any): Promise<InvalidTagScanResult> {
  const roster = await getAllChampionIds();
  const rosterLower = new Map(Array.from(roster).map((r) => [r.toLowerCase(), r]));

  const { data: existingPending } = await supabase
    .from('dict_fact_check_queue')
    .select('id, champion, source_refs')
    .eq('issue_type', 'invalid_champion_tag')
    .eq('status', 'pending');

  // 既にキューにある項目を、現在の正規化ロジックで再判定する。
  // 表記ゆれ対応表(championNames.ts)を拡充した後も、一度キューに積まれた項目は
  // 「既にある」という理由でずっとスキップされ続け、直したはずの表記が
  // 「未解決」のまま残り続けるバグがあった(2026-08-04発覚)。
  // これは人間の判断が要らない決定的な正規化なので、解決可能になった項目は
  // その場で自動修正して良い(手動の「この名前に修正」ボタンと同じロジック)。
  let autoResolved = 0;
  const already = new Set<string>();
  for (const item of existingPending || []) {
    const ref = Array.isArray(item.source_refs) ? item.source_refs[0] : null;
    const key = ref ? `${ref.table}:${ref.id}` : '';
    if (key) already.add(key);
    if (!ref?.table || !ref?.id || !INVALID_TAG_TARGETS.some((t) => t.table === ref.table)) continue;

    // personal_knowledgeの複数チャンピオン紐付け(カンマ区切り)は、既存の正当な行として
    // そのまま解消する(champion列は書き換えない)。
    const raw = String(item.champion || '');
    if (ref.table === 'personal_knowledge' && raw.includes(',') && isChampionListValid(raw, rosterLower)) {
      const { error: queueErr } = await supabase
        .from('dict_fact_check_queue')
        .update({ status: 'fixed', reviewed_at: new Date().toISOString(), detail: { autoResolved: true, note: '複数チャンピオン紐付けとして正常' } })
        .eq('id', item.id);
      if (!queueErr) { autoResolved++; already.delete(key); }
      continue;
    }

    const resolved = resolveChampionId(item.champion);
    const canonical = resolved ? rosterLower.get(resolved.toLowerCase()) : undefined;
    if (!canonical) continue;

    const { error: updateErr } = await supabase.from(ref.table).update({ champion: canonical }).eq('id', ref.id);
    if (updateErr) continue;
    const { error: queueErr } = await supabase
      .from('dict_fact_check_queue')
      .update({ status: 'fixed', reviewed_at: new Date().toISOString(), detail: { fixedChampion: canonical, autoResolved: true } })
      .eq('id', item.id);
    if (!queueErr) { autoResolved++; already.delete(key); }
  }

  const pendingCount = await getPendingQueueCount(supabase);
  if (pendingCount >= PENDING_QUEUE_CAP) {
    return { inserted: 0, autoResolved, capped: true };
  }

  let inserted = 0;
  let capped = false;
  outer:
  for (const target of INVALID_TAG_TARGETS) {
    const { data: rows } = await fetchAllRows((from, to) =>
      supabase.from(target.table).select('id, champion').not('champion', 'is', null).range(from, to)
    );
    for (const row of rows || []) {
      const raw = String(row.champion || '').trim();
      if (!raw || target.skip.includes(raw.toUpperCase())) continue;

      if (target.table === 'personal_knowledge' && raw.includes(',')) {
        if (isChampionListValid(raw, rosterLower)) continue; // 複数チャンピオン紐付けとして正常
      } else {
        const resolved = resolveChampionId(raw);
        if (resolved && rosterLower.has(resolved.toLowerCase())) continue; // 正常
      }

      const key = `${target.table}:${row.id}`;
      if (already.has(key)) continue;

      // 別リクエスト(単体チェック等)が並行実行された場合に上限を超えて積み増され
      // 続けないよう、実際に挿入する直前でDBの最新pending件数を取り直す。
      // ループ開始時点のpendingCountのままだと、その間に他リクエストが挿入した分を
      // 考慮できずレース窓が広いままだった。
      const liveCount = await getPendingQueueCount(supabase);
      if (liveCount >= PENDING_QUEUE_CAP) { capped = true; break outer; }

      const { error } = await supabase.from('dict_fact_check_queue').insert({
        champion: raw,
        issue_type: 'invalid_champion_tag',
        summary: `${target.table}のchampion列「${raw}」が実在チャンピオン名に一致しません`,
        source_refs: [{ table: target.table, id: row.id }],
        status: 'pending',
      });
      if (!error) inserted++;
    }
  }
  return { inserted, autoResolved, capped };
}

// ------------------------------------------------------------
// ステップ2: チャンピオン単位で全ソースをグルーピングし、横断ファクトチェック
// ------------------------------------------------------------
export interface ChampionSourceBundle {
  champion: string;
  matchupGlobal?: { id: number; strategy: string };
  matchupEnemies: { id: number; enemy: string; strategy: string }[];
  facts?: { strengths: string; weaknesses: string; power_spikes: string; build_runes: string; strategy: string; counter_champions: string; must_ban_champions: string };
  notes: { id: number; title: string; body: string }[];
  knowledge: { id: number; title: string; content: string }[];
}

export async function groupSourcesByChampion(supabase: any): Promise<Map<string, ChampionSourceBundle>> {
  const roster = await getAllChampionIds();
  const rosterArr = Array.from(roster);
  const rosterLower = new Map(rosterArr.map((r) => [r.toLowerCase(), r]));
  const map = new Map<string, ChampionSourceBundle>();

  const ensure = (raw: string | null): ChampionSourceBundle | null => {
    const resolved = resolveChampionId(raw);
    if (!resolved) return null;
    const canonical = rosterLower.get(resolved.toLowerCase());
    if (!canonical) return null; // 不正タグはscanInvalidChampionTags側の担当。ここでは無視する
    if (!map.has(canonical)) map.set(canonical, { champion: canonical, matchupEnemies: [], notes: [], knowledge: [] });
    return map.get(canonical)!;
  };

  const { data: sentinelRows } = await fetchAllRows((from, to) =>
    supabase.from('matchup_sentinel').select('id, champion, enemy, strategy').not('strategy', 'is', null).range(from, to)
  );
  (sentinelRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (!b) return;
    if (r.enemy === 'GLOBAL') b.matchupGlobal = { id: r.id, strategy: r.strategy || '' };
    else if (b.matchupEnemies.length < 5) b.matchupEnemies.push({ id: r.id, enemy: r.enemy, strategy: r.strategy || '' });
  });

  const { data: factsRows } = await fetchAllRows((from, to) =>
    supabase
      .from('champion_facts')
      .select('champion, strengths, weaknesses, power_spikes, build_runes, strategy, counter_champions, must_ban_champions')
      .eq('archived', false)
      .range(from, to)
  );
  (factsRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (b) b.facts = r;
  });

  const { data: notesRows } = await fetchAllRows((from, to) =>
    supabase.from('champion_notes').select('id, champion, title, body').order('created_at', { ascending: false }).range(from, to)
  );
  (notesRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (b && b.notes.length < 8) b.notes.push({ id: r.id, title: r.title || '', body: (r.body || '').slice(0, 400) });
  });

  const { data: knowledgeRows } = await fetchAllRows((from, to) =>
    supabase.from('personal_knowledge').select('id, champion, title, content').not('champion', 'is', null).neq('champion', 'Unknown').range(from, to)
  );
  (knowledgeRows || []).forEach((r: any) => {
    // personal_knowledgeはカンマ区切りで複数チャンピオンに紐付く記事をサポートしている。
    // 以前はensure()に生の"Graves, Jax"をそのまま渡しており単一チャンピオン解決に
    // 失敗して両チャンピオンのバンドルから丸ごと漏れていた(2026-08-05発覚)。
    // カンマ区切りを分解し、解決できた各チャンピオンのバンドルに個別に紐付ける。
    const raw = String(r.champion || '');
    const champs = raw.includes(',') ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : [raw];
    for (const c of champs) {
      const b = ensure(c);
      if (b && b.knowledge.length < 5) b.knowledge.push({ id: r.id, title: r.title || '', content: (r.content || '').slice(0, 400) });
    }
  });

  return map;
}

interface FactCheckResult {
  issue_type: 'contradiction' | 'unconfirmed_source' | 'possible_fact_error';
  summary: string;
}

/**
 * チャンピオン単位の全ソースを、AIプロンプトにも人間向けプレビューにも使える
 * 共通のテキストブロック配列に変換する。ここを共有することで「AIが実際に何を見て
 * 判定したか」と「人間が確認できる内容」が常に完全一致する。
 */
function buildSourceParts(bundle: ChampionSourceBundle): string[] {
  const parts: string[] = [];
  if (bundle.matchupGlobal?.strategy) parts.push(`【辞典本体(matchup_sentinel)】\n${bundle.matchupGlobal.strategy.slice(0, 1200)}`);
  bundle.matchupEnemies.forEach((m) => parts.push(`【辞典 対面メモ vs ${m.enemy}】\n${m.strategy.slice(0, 500)}`));
  if (bundle.facts) {
    const f = bundle.facts;
    parts.push(
      `【コーチAI知識層(champion_facts)】\n強み: ${f.strengths || ''}\n弱み: ${f.weaknesses || ''}\nパワースパイク: ${f.power_spikes || ''}\nビルド/ルーン: ${f.build_runes || ''}\n戦略: ${f.strategy || ''}\n苦手対面: ${f.counter_champions || ''}\n必須BAN: ${f.must_ban_champions || ''}`
    );
  }
  bundle.notes.forEach((n) => parts.push(`【コーチAI知識層メモ(champion_notes) ${n.title}】\n${n.body}`));
  bundle.knowledge.forEach((k) => parts.push(`【ナレッジ(personal_knowledge) ${k.title}】\n${k.content}`));
  return parts;
}

/** 1チャンピオン分だけをピンポイントで取得する（レビューUIのプレビュー表示用）。 */
export async function getChampionBundle(supabase: any, champion: string): Promise<ChampionSourceBundle> {
  const bundle: ChampionSourceBundle = { champion, matchupEnemies: [], notes: [], knowledge: [] };

  const { data: sentinelRows } = await supabase
    .from('matchup_sentinel').select('id, enemy, strategy').eq('champion', champion).not('strategy', 'is', null);
  (sentinelRows || []).forEach((r: any) => {
    if (r.enemy === 'GLOBAL') bundle.matchupGlobal = { id: r.id, strategy: r.strategy || '' };
    else if (bundle.matchupEnemies.length < 5) bundle.matchupEnemies.push({ id: r.id, enemy: r.enemy, strategy: r.strategy || '' });
  });

  const { data: factsRow } = await supabase
    .from('champion_facts')
    .select('champion, strengths, weaknesses, power_spikes, build_runes, strategy, counter_champions, must_ban_champions')
    .eq('champion', champion).eq('archived', false).maybeSingle();
  if (factsRow) bundle.facts = factsRow;

  const { data: notesRows } = await supabase
    .from('champion_notes').select('id, title, body').eq('champion', champion).order('created_at', { ascending: false }).limit(8);
  (notesRows || []).forEach((r: any) => bundle.notes.push({ id: r.id, title: r.title || '', body: (r.body || '').slice(0, 400) }));

  const { data: knowledgeRows } = await supabase
    .from('personal_knowledge').select('id, title, content').eq('champion', champion).limit(5);
  (knowledgeRows || []).forEach((r: any) => bundle.knowledge.push({ id: r.id, title: r.title || '', content: (r.content || '').slice(0, 400) }));

  return bundle;
}

/** レビューUIで「AIが実際に見た内容」をそのまま表示するためのプレビューテキスト。 */
export async function getChampionPreviewText(supabase: any, champion: string): Promise<string> {
  const bundle = await getChampionBundle(supabase, champion);
  const parts = buildSourceParts(bundle);
  return parts.length > 0 ? parts.join('\n\n---\n\n') : '（この項目に紐づく辞典/コーチAI知識層/ナレッジのデータが見つかりませんでした）';
}

export interface EditableSourceBlock {
  key: string;
  table: 'matchup_sentinel' | 'champion_notes' | 'champion_facts';
  id?: number;
  champion?: string;
  field: string;
  label: string;
  value: string;
  deletable: boolean;
}

export interface LinkedSourceBlock {
  key: string;
  table: 'personal_knowledge';
  id: number;
  label: string;
  value: string;
  url: string;
}

const FACT_FIELD_LABELS: Record<string, string> = {
  strengths: '強み', weaknesses: '弱み', power_spikes: 'パワースパイク', build_runes: 'ビルド/ルーン',
  strategy: '戦略', counter_champions: '苦手対面', must_ban_champions: '必須BAN',
};

/**
 * レビューUIから「実際にどのレコードのどの項目が根拠か」を個別に編集・削除できるように、
 * チャンピオン単位のバンドルを1ブロック=1編集単位のリストへ分解する。
 * 訂正を記録するだけでは元の誤った文章そのものは書き変わらず残り続けるため、
 * 矛盾・事実誤りをその場で直接直せるようにするのが目的。
 * personal_knowledgeは既存の攻略ライブラリ編集画面があるため、ここでは編集対象にせず
 * リンクだけを返す。
 */
export function buildEditableBlocks(bundle: ChampionSourceBundle): { editable: EditableSourceBlock[]; linked: LinkedSourceBlock[] } {
  const editable: EditableSourceBlock[] = [];
  const linked: LinkedSourceBlock[] = [];

  if (bundle.matchupGlobal?.strategy) {
    editable.push({
      key: `matchup_sentinel:${bundle.matchupGlobal.id}`, table: 'matchup_sentinel', id: bundle.matchupGlobal.id,
      field: 'strategy', label: '辞典本体（全体的な立ち回り）', value: bundle.matchupGlobal.strategy, deletable: false,
    });
  }
  bundle.matchupEnemies.forEach((m) => {
    editable.push({
      key: `matchup_sentinel:${m.id}`, table: 'matchup_sentinel', id: m.id,
      field: 'strategy', label: `対面メモ vs ${m.enemy}`, value: m.strategy, deletable: true,
    });
  });
  if (bundle.facts) {
    const f = bundle.facts as any;
    Object.keys(FACT_FIELD_LABELS).forEach((field) => {
      const value = f[field];
      if (value) {
        editable.push({
          key: `champion_facts:${bundle.champion}:${field}`, table: 'champion_facts', champion: bundle.champion,
          field, label: `コーチAI知識層: ${FACT_FIELD_LABELS[field]}`, value, deletable: false,
        });
      }
    });
  }
  bundle.notes.forEach((n) => {
    editable.push({
      key: `champion_notes:${n.id}`, table: 'champion_notes', id: n.id,
      field: 'body', label: `コーチAIノート: ${n.title || '(無題)'}`, value: n.body, deletable: true,
    });
  });
  bundle.knowledge.forEach((k) => {
    linked.push({
      key: `personal_knowledge:${k.id}`, table: 'personal_knowledge', id: k.id,
      label: `ナレッジ: ${k.title || '(無題)'}`, value: k.content, url: `/admin/knowledge?tab=library&article=${k.id}`,
    });
  });

  return { editable, linked };
}

async function factCheckChampion(supabase: any, bundle: ChampionSourceBundle): Promise<QueuedIssue[]> {
  // 過去に人間が確定した訂正情報。これを「既に解決済み」として扱わせることで、
  // 同じ指摘を再度キューに積み続ける(再発)のを防ぐ。
  const { data: corrections } = await supabase
    .from('dict_known_corrections')
    .select('wrong_claim, correct_info')
    .eq('champion', bundle.champion)
    .order('created_at', { ascending: false })
    .limit(10);
  const knownCorrections: { wrong_claim: string; correct_info: string }[] = corrections || [];

  const parts = buildSourceParts(bundle);

  if (parts.length === 0) return [];

  const abilities = await getChampionAbilityNames(bundle.champion).catch(() => []);
  const abilityBlock = abilities.length > 0 ? `\n【公式スキル情報(Data Dragon、これが正）】\n${abilities.join(' / ')}\n` : '';
  const correctionsBlock = knownCorrections.length > 0
    ? `\n【過去に人間が確定した訂正（既に解決済み。同じ内容を再度指摘しないこと）】\n${knownCorrections.map((c) => `- 誤り: ${c.wrong_claim} → 正しくは: ${c.correct_info}`).join('\n')}\n`
    : '';

  const prompt = `あなたはLoLの超厳格なファクトチェッカーです。以下は「${bundle.champion}」について複数の場所（辞典/コーチAI知識層/ナレッジ）に保存されている記述です。
${abilityBlock}${correctionsBlock}
${parts.join('\n\n---\n\n')}

【厳格な指示】
1. 微細な言い回しの違いや過剰な指摘は一切行わず、ユーザーが確認すべき【最も本質的で重大な問題のみ】を厳選してください。
2. 重複する指摘は完全に除外し、各カテゴリ（矛盾, 未確証, 事実誤り）で【最大2件まで】しか出力してはいけません（該当がなければ0件）。
3. 判定時には、対象となっている具体的なデータフィールド（例: "power_spikes", "strengths", "weaknesses", "build_runes", "strategy", "counter_champions", "must_ban_champions", "matchup_sentinel"）を "target_field" に明記してください。

以下の3種類を判定してください:
1. 矛盾(contradiction): 異なる出典間で結論が明確に矛盾している記述（例: 一方は「対面有利」、他方は「対面不利」）。
2. 未確証(unconfirmed_source): 1つの出典にしか出てこない、具体的すぎる断定。
3. 事実誤りの疑い(fact_error): 公式スキル情報と矛盾する記述、または実在しないスキル名・効果への言及。

必ず以下のJSON形式のみ出力（前置き・コードブロック禁止、該当が無い項目は空配列）:
{
  "contradictions": [
    {
      "summary": "<40字以内の概要 (例: Wukongのパワースパイク時期の矛盾)>",
      "target_field": "<"power_spikes" | "strengths" | "weaknesses" | "build_runes" | "strategy" | "matchup_sentinel">",
      "claim_a": "<引っかかった実際の記述Aの要点・抜粋テキスト (例: 【パワー: 中盤】)>",
      "claim_b": "<食い違っている実際の記述Bの要点・抜粋テキスト (例: 【パワー: 35分以降弱体化】)>",
      "conflict_reason": "<どこがどう食い違っているのかの具体的理由>"
    }
  ],
  "unconfirmed": [
    {
      "summary": "<40字以内の概要>",
      "target_field": "<"power_spikes" | "strengths" | "weaknesses" | "build_runes" | "strategy" | "matchup_sentinel">",
      "claim_a": "<該当する具体的な断定記述テキスト>",
      "conflict_reason": "<他の情報源で裏取りできない理由>"
    }
  ],
  "factErrors": [
    {
      "summary": "<40字以内の概要>",
      "target_field": "<"power_spikes" | "strengths" | "weaknesses" | "build_runes" | "strategy" | "matchup_sentinel">",
      "claim_a": "<実際に公式情報と矛盾している具体的な記述テキスト>",
      "conflict_reason": "<公式情報との矛盾理由>"
    }
  ]
}`;

  const contentHash = createHash('sha1')
    .update(parts.join('|') + '||' + knownCorrections.map((c) => c.wrong_claim + c.correct_info).join('|'))
    .digest('hex').slice(0, 16);
  const raw = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.1,
    maxOutputTokens: 800,
    maxRetries: 2,
    cacheKey: `factcheck:${bundle.champion}:${contentHash}`,
  });

  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) return [];
    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    const issues: QueuedIssue[] = [];

    (parsed.contradictions || []).slice(0, 2).forEach((c: any) => {
      if (c?.summary) {
        issues.push({
          champion: bundle.champion,
          issue_type: 'contradiction',
          summary: String(c.summary).slice(0, 100),
          detail: {
            claim_a: c.claim_a ? String(c.claim_a) : undefined,
            claim_b: c.claim_b ? String(c.claim_b) : undefined,
            conflict_reason: c.conflict_reason ? String(c.conflict_reason) : undefined,
            target_field: c.target_field ? String(c.target_field) : undefined,
          },
        });
      }
    });
    (parsed.unconfirmed || []).slice(0, 2).forEach((c: any) => {
      if (c?.summary) {
        issues.push({
          champion: bundle.champion,
          issue_type: 'unconfirmed_source',
          summary: String(c.summary).slice(0, 100),
          detail: {
            claim_a: c.claim_a ? String(c.claim_a) : undefined,
            conflict_reason: c.conflict_reason ? String(c.conflict_reason) : undefined,
            target_field: c.target_field ? String(c.target_field) : undefined,
          },
        });
      }
    });
    (parsed.factErrors || []).slice(0, 2).forEach((c: any) => {
      if (c?.summary) {
        issues.push({
          champion: bundle.champion,
          issue_type: 'possible_fact_error',
          summary: String(c.summary).slice(0, 100),
          detail: {
            claim_a: c.claim_a ? String(c.claim_a) : undefined,
            conflict_reason: c.conflict_reason ? String(c.conflict_reason) : undefined,
            target_field: c.target_field ? String(c.target_field) : undefined,
          },
        });
      }
    });
    return issues;
  } catch {
    return [];
  }
}

/**
 * 一斉ファクトチェックの進捗はサーバー側に永続化されないため、タブを閉じる・エラー等で
 * 中断した後に再実行すると、常にoffset=0から再スキャンされる。invalid_champion_tagは
 * source_refsのキーで重複排除していたが、contradiction/unconfirmed_source/
 * possible_fact_errorには同種のチェックが無く、既にレビュー済み手前のチャンピオンが
 * 再スキャンされるたびに同一内容がキューへ重複して積まれ、AI呼び出しコストも
 * 二重にかかっていた。同じ内容(issue_type+summary)が既にpendingで存在する場合は
 * 挿入対象から除外する。
 */
async function filterAlreadyPendingIssues(supabase: any, champion: string, issues: QueuedIssue[]): Promise<QueuedIssue[]> {
  if (issues.length === 0) return issues;
  const { data: existing } = await supabase
    .from('dict_fact_check_queue')
    .select('issue_type, summary')
    .eq('champion', champion)
    .eq('status', 'pending');
  const existingKeys = new Set((existing || []).map((r: any) => `${r.issue_type}::${r.summary}`));
  return issues.filter((i) => !existingKeys.has(`${i.issue_type}::${i.summary}`));
}

function sourceTablesOf(bundle: ChampionSourceBundle): string[] {
  return [
    bundle.matchupGlobal || bundle.matchupEnemies.length > 0 ? 'matchup_sentinel' : null,
    bundle.facts ? 'champion_facts' : null,
    bundle.notes.length > 0 ? 'champion_notes' : null,
    bundle.knowledge.length > 0 ? 'personal_knowledge' : null,
  ].filter(Boolean) as string[];
}

export interface FactCheckBatchResult {
  processed: number;
  flagged: number;
  totalChampions: number;
  nextOffset: number;
  done: boolean;
  rateLimited: boolean;
  capped: boolean;
}

/** offsetからlimit件のチャンピオンだけを処理する（Vercelのタイムアウト回避のためのチャンク実行）。 */
export async function runFactCheckBatch(supabase: any, offset: number, limit: number): Promise<FactCheckBatchResult> {
  const grouped = await groupSourcesByChampion(supabase);
  const champions = Array.from(grouped.keys()).sort();
  const total = champions.length;
  const slice = champions.slice(offset, offset + limit);

  // 未処理レビューが上限に達している間は、AI呼び出しのコストをかけてまで
  // 新しい指摘を積み増さない。先にキューを片付けてから再開する運用にする。
  const pendingCount = await getPendingQueueCount(supabase);
  if (pendingCount >= PENDING_QUEUE_CAP) {
    return { processed: 0, flagged: 0, totalChampions: total, nextOffset: offset, done: true, rateLimited: false, capped: true };
  }

  let flagged = 0;
  let processed = 0;
  let rateLimited = false;
  let capped = false;

  for (const champ of slice) {
    // 別リクエスト(単体チェック等)が並行実行された場合に上限超過が続かないよう、
    // ループ開始時点のpendingCountではなくDBの最新件数を毎回取り直して判定する。
    const liveCount = await getPendingQueueCount(supabase);
    if (liveCount >= PENDING_QUEUE_CAP) { capped = true; break; }

    const bundle = grouped.get(champ)!;
    try {
      const rawIssues = await factCheckChampion(supabase, bundle);
      const issues = await filterAlreadyPendingIssues(supabase, champ, rawIssues);
      if (issues.length > 0) {
        const sourceTables = sourceTablesOf(bundle);
        const rows = issues.map((i) => ({
          champion: champ,
          issue_type: i.issue_type,
          summary: i.summary,
          detail: i.detail || null,
          source_refs: sourceTables,
          status: 'pending',
        }));
        const { error } = await supabase.from('dict_fact_check_queue').insert(rows);
        if (!error) flagged += rows.length;
      }
      processed++;
    } catch (e: any) {
      if (String(e?.message || '').includes('レート制限')) {
        rateLimited = true;
        break;
      }
      console.warn(`[dictFactCheck] ${champ} の判定に失敗（スキップして続行）:`, e);
      processed++;
    }
  }

  const nextOffset = offset + processed;
  return {
    processed,
    flagged,
    totalChampions: total,
    nextOffset,
    done: capped || (!rateLimited && nextOffset >= total),
    rateLimited,
    capped,
  };
}

/** 全168チャンピオンの過去の古い pending キューを一元で綺麗サッパリ削除・一括リセットする */
export async function resetAllPendingFactChecks(supabase: any): Promise<number> {
  const { count } = await supabase
    .from('dict_fact_check_queue')
    .delete({ count: 'exact' })
    .eq('status', 'pending');
  return count || 0;
}

/** チャンピオン辞典ページから、そのチャンピオン1体だけを即時ファクトチェックする。 */
export async function runFactCheckForChampion(supabase: any, champion: string): Promise<{ flagged: number; capped: boolean }> {
  // 過去の古い過剰検出キュー(19件等)を一度綺麗にリセット・削除
  await supabase
    .from('dict_fact_check_queue')
    .delete()
    .eq('champion', champion)
    .eq('status', 'pending');

  const bundle = await getChampionBundle(supabase, champion);
  const rawIssues = await factCheckChampion(supabase, bundle);
  if (rawIssues.length === 0) return { flagged: 0, capped: false };

  const sourceTables = sourceTablesOf(bundle);
  const rows = rawIssues.map((i) => ({
    champion,
    issue_type: i.issue_type,
    summary: i.summary,
    detail: i.detail || null,
    source_refs: sourceTables,
    status: 'pending',
  }));
  const { error } = await supabase.from('dict_fact_check_queue').insert(rows);
  if (error) throw error;
  return { flagged: rows.length, capped: false };
}
