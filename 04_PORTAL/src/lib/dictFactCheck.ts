import { createHash } from 'crypto';
import { callGeminiWithRetry } from './geminiClient';
import { normalizeChampionName } from './championNames';
import { formatChampId, getAllChampionIds, getChampionAbilityNames } from './ddragonClient';

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

const NON_CHAMPION_MARKERS = new Set(['GLOBAL', 'SYSTEM', 'UNKNOWN']);

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

export interface QueuedIssue {
  champion: string;
  issue_type: 'contradiction' | 'unconfirmed_source' | 'possible_fact_error' | 'invalid_champion_tag';
  summary: string;
  detail?: any;
  source_refs?: any;
}

// ------------------------------------------------------------
// ステップ1: champion列の不正タグ検出（LLM不要・無料）
// ------------------------------------------------------------
const INVALID_TAG_TARGETS: { table: 'matchup_sentinel' | 'champion_notes' | 'personal_knowledge'; skip: string[] }[] = [
  { table: 'matchup_sentinel', skip: ['SYSTEM'] },
  { table: 'champion_notes', skip: ['SYSTEM'] },
  { table: 'personal_knowledge', skip: ['UNKNOWN'] },
];

export async function scanInvalidChampionTags(supabase: any): Promise<number> {
  const roster = await getAllChampionIds();
  const rosterLower = new Set(Array.from(roster).map((s) => s.toLowerCase()));

  const { data: existingPending } = await supabase
    .from('dict_fact_check_queue')
    .select('source_refs')
    .eq('issue_type', 'invalid_champion_tag')
    .eq('status', 'pending');
  const already = new Set(
    (existingPending || []).map((r: any) => {
      const ref = Array.isArray(r.source_refs) ? r.source_refs[0] : null;
      return ref ? `${ref.table}:${ref.id}` : '';
    })
  );

  let inserted = 0;
  for (const target of INVALID_TAG_TARGETS) {
    const { data: rows } = await supabase.from(target.table).select('id, champion').not('champion', 'is', null);
    for (const row of rows || []) {
      const raw = String(row.champion || '').trim();
      if (!raw || target.skip.includes(raw.toUpperCase())) continue;

      const resolved = resolveChampionId(raw);
      if (resolved && rosterLower.has(resolved.toLowerCase())) continue; // 正常

      const key = `${target.table}:${row.id}`;
      if (already.has(key)) continue;

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
  return inserted;
}

// ------------------------------------------------------------
// ステップ2: チャンピオン単位で全ソースをグルーピングし、横断ファクトチェック
// ------------------------------------------------------------
interface ChampionSourceBundle {
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

  const { data: sentinelRows } = await supabase
    .from('matchup_sentinel').select('id, champion, enemy, strategy').not('strategy', 'is', null);
  (sentinelRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (!b) return;
    if (r.enemy === 'GLOBAL') b.matchupGlobal = { id: r.id, strategy: r.strategy || '' };
    else if (b.matchupEnemies.length < 5) b.matchupEnemies.push({ id: r.id, enemy: r.enemy, strategy: r.strategy || '' });
  });

  const { data: factsRows } = await supabase
    .from('champion_facts')
    .select('champion, strengths, weaknesses, power_spikes, build_runes, strategy, counter_champions, must_ban_champions')
    .eq('archived', false);
  (factsRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (b) b.facts = r;
  });

  const { data: notesRows } = await supabase
    .from('champion_notes').select('id, champion, title, body').order('created_at', { ascending: false });
  (notesRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (b && b.notes.length < 8) b.notes.push({ id: r.id, title: r.title || '', body: (r.body || '').slice(0, 400) });
  });

  const { data: knowledgeRows } = await supabase
    .from('personal_knowledge').select('id, champion, title, content').not('champion', 'is', null).neq('champion', 'Unknown');
  (knowledgeRows || []).forEach((r: any) => {
    const b = ensure(r.champion);
    if (b && b.knowledge.length < 5) b.knowledge.push({ id: r.id, title: r.title || '', content: (r.content || '').slice(0, 400) });
  });

  return map;
}

interface FactCheckResult {
  issue_type: 'contradiction' | 'unconfirmed_source' | 'possible_fact_error';
  summary: string;
}

async function factCheckChampion(supabase: any, bundle: ChampionSourceBundle): Promise<FactCheckResult[]> {
  // 過去に人間が確定した訂正情報。これを「既に解決済み」として扱わせることで、
  // 同じ指摘を再度キューに積み続ける(再発)のを防ぐ。
  const { data: corrections } = await supabase
    .from('dict_known_corrections')
    .select('wrong_claim, correct_info')
    .eq('champion', bundle.champion)
    .order('created_at', { ascending: false })
    .limit(10);
  const knownCorrections: { wrong_claim: string; correct_info: string }[] = corrections || [];

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

  if (parts.length === 0) return [];

  const abilities = await getChampionAbilityNames(bundle.champion).catch(() => []);
  const abilityBlock = abilities.length > 0 ? `\n【公式スキル情報(Data Dragon、これが正）】\n${abilities.join(' / ')}\n` : '';
  const correctionsBlock = knownCorrections.length > 0
    ? `\n【過去に人間が確定した訂正（既に解決済み。同じ内容を再度指摘しないこと）】\n${knownCorrections.map((c) => `- 誤り: ${c.wrong_claim} → 正しくは: ${c.correct_info}`).join('\n')}\n`
    : '';

  const prompt = `あなたはLoLの厳格なファクトチェッカーです。以下は「${bundle.champion}」について複数の場所（辞典/コーチAI知識層/ナレッジ）に保存されている記述です。
これらはYouTube動画の自動文字起こし→AI要約→AI統合という無検証の経路で生成されたものが多く含まれ、誤りが混入している可能性があります。
${abilityBlock}${correctionsBlock}
${parts.join('\n\n---\n\n')}

以下の3種類を判定してください:
1. 矛盾(contradiction): 異なる出典間で結論が明確に矛盾している記述（例: 一方は「対面有利」、他方は「対面不利」）。パッチ変化による自然な評価の変化は矛盾に含めない。
2. 未確証(unconfirmed_source): 1つの出典にしか出てこない、具体的すぎる断定（例: 特定の秒数・数値の言い切り）で、他の出典で裏取りできないもの。一般的な内容や複数出典で一致している内容は含めない。
3. 事実誤りの疑い(fact_error): 公式スキル情報と矛盾する記述、または実在しないスキル名・効果への言及。
上記の「過去に確定した訂正」に既に対応済みの内容（正しい情報の方に沿っている記述）は問題として指摘しないこと。逆に、訂正後もまだ誤った内容(「誤り」欄の内容)がどこかに残っている場合は事実誤りの疑いとして指摘すること。

必ず以下のJSON形式のみ出力（前置き・コードブロック禁止、該当が無い項目は空配列）:
{"contradictions":[{"summary":"<40字以内>"}],"unconfirmed":[{"summary":"<40字以内>"}],"factErrors":[{"summary":"<40字以内>"}]}`;

  const contentHash = createHash('sha1')
    .update(parts.join('|') + '||' + knownCorrections.map((c) => c.wrong_claim + c.correct_info).join('|'))
    .digest('hex').slice(0, 16);
  const raw = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.2,
    maxOutputTokens: 700,
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
    const issues: FactCheckResult[] = [];
    (parsed.contradictions || []).forEach((c: any) => c?.summary && issues.push({ issue_type: 'contradiction', summary: String(c.summary).slice(0, 100) }));
    (parsed.unconfirmed || []).forEach((c: any) => c?.summary && issues.push({ issue_type: 'unconfirmed_source', summary: String(c.summary).slice(0, 100) }));
    (parsed.factErrors || []).forEach((c: any) => c?.summary && issues.push({ issue_type: 'possible_fact_error', summary: String(c.summary).slice(0, 100) }));
    return issues;
  } catch {
    return [];
  }
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
}

/** offsetからlimit件のチャンピオンだけを処理する（Vercelのタイムアウト回避のためのチャンク実行）。 */
export async function runFactCheckBatch(supabase: any, offset: number, limit: number): Promise<FactCheckBatchResult> {
  const grouped = await groupSourcesByChampion(supabase);
  const champions = Array.from(grouped.keys()).sort();
  const total = champions.length;
  const slice = champions.slice(offset, offset + limit);

  let flagged = 0;
  let processed = 0;
  let rateLimited = false;

  for (const champ of slice) {
    const bundle = grouped.get(champ)!;
    try {
      const issues = await factCheckChampion(supabase, bundle);
      if (issues.length > 0) {
        const sourceTables = sourceTablesOf(bundle);
        const rows = issues.map((i) => ({
          champion: champ,
          issue_type: i.issue_type,
          summary: i.summary,
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
    done: !rateLimited && nextOffset >= total,
    rateLimited,
  };
}
