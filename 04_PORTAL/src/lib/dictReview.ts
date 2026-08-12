import { callGeminiWithRetry } from './geminiClient';

// ============================================================
// 辞典の鮮度レビュー・共通ロジック (課題#50 フェーズC)
//
// /api/admin/dict-review (管理者操作) と /api/cron/dict-review-check
// (週次の自動検知) の両方から使う。書き込みはせず、判定結果を返すだけ。
// ============================================================

export interface DictReviewCandidate {
  champion: string;
  patch: string | null;
  verdict: 'keep' | 'update' | 'archive';
  reason: string;
  note: string;
  reviewed_at: string | null;
  review_patch: string | null;
  current: {
    strengths: string | null;
    weaknesses: string | null;
    power_spikes: string | null;
    build_runes: string | null;
    strategy: string | null;
  };
}

// DDragonのメジャー番号はシーズン通し番号(14=2024,15=2025,16=2026...)のため、
// 辞典側(champion_facts.patch)の表記(西暦下2桁基準の26.xx)に揃えるため+10する(2026-08-08発覚)。
export async function getCurrentPatch(): Promise<string> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    const [rawMajor, rawMinor] = (versions[0] || '').split('.');
    if (!rawMajor || !rawMinor) return '';
    return `${parseInt(rawMajor, 10) + 10}.${rawMinor}`; // "26.13"
  } catch {
    return '';
  }
}

export async function reviewChampionFacts(supabase: any, limit: number): Promise<{ currentPatch: string; candidates: DictReviewCandidate[] }> {
  const currentPatch = await getCurrentPatch();

  // 未レビュー優先 → 更新が古い順
  const { data: facts } = await supabase
    .from('champion_facts')
    .select('champion, patch, strengths, weaknesses, power_spikes, build_runes, strategy, reviewed_at, review_patch')
    .eq('archived', false)
    .order('reviewed_at', { ascending: true, nullsFirst: true })
    .order('updated_at', { ascending: true })
    .limit(limit);

  const candidates: DictReviewCandidate[] = await Promise.all((facts || []).map(async (f: any) => {
    const prompt = `あなたはLoLのメタ分析コーチです。以下はチャンピオン「${f.champion}」の辞典データ（作成パッチ: ${f.patch || '不明'}）です。現在のパッチ ${currentPatch || '最新'} でもこの内容が概ね有効か判定してください。

強み: ${f.strengths || 'なし'}
弱み: ${f.weaknesses || 'なし'}
パワースパイク: ${f.power_spikes || 'なし'}
ビルド/ルーン: ${f.build_runes || 'なし'}

必ず以下のJSONのみ出力（前置き・コードブロック禁止）:
{"verdict":"keep|update|archive","reason":"<30字以内の理由>","note":"<updateの場合の要修正点。40字以内。不要なら空>"}
- keep: 現パッチでも概ね有効
- update: 一部古く、更新した方が良い
- archive: 大幅に古い/現メタと乖離、アーカイブ推奨`;
    let verdict: 'keep' | 'update' | 'archive' = 'keep', reason = '', note = '';
    try {
      const raw = await callGeminiWithRetry(prompt, { model: 'gemini-3.1-flash-lite', temperature: 0.2, maxOutputTokens: 256, maxRetries: 2, cacheKey: `dictreview:${f.champion}:${f.patch}:${currentPatch}` });
      let cleaned = (raw || '').trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) { const p = JSON.parse(cleaned.slice(s, e + 1)); verdict = p.verdict || 'keep'; reason = p.reason || ''; note = p.note || ''; }
    } catch { reason = 'LLM判定に失敗'; }
    return {
      champion: f.champion, patch: f.patch, verdict, reason, note,
      reviewed_at: f.reviewed_at, review_patch: f.review_patch,
      current: {
        strengths: f.strengths, weaknesses: f.weaknesses,
        power_spikes: f.power_spikes, build_runes: f.build_runes,
        strategy: f.strategy,
      },
    };
  }));

  return { currentPatch, candidates };
}

// ============================================================
// 辞典本文の矛盾検出 (2026-08-03 追加、08-03 GLOBAL本体まで対象拡大)
//
// matchup_sentinel.strategy へ追記し続ける書き込み経路が複数ある:
//  - ソロQ振り返り(/api/soloq/reflections): 対面メモ(enemy≠GLOBAL)に
//    「【ソロQ振り返りメモ (日付)】」形式で追記
//  - 攻略ライブラリ一括同期(/api/admin/knowledge/sync): 辞典本体(enemy=GLOBAL)に
//    「## 【記事】タイトル」形式で記事を追記（正規表現によるセクション単位の
//    追記/置換のみで、AIによる矛盾解消は行われない。champion_facts側への
//    マージ(/api/admin/champion-facts/merge)は「矛盾する場合はより具体的な方を
//    採用」とAIが判断しているのに、実際に表示される辞典本体側は素通しだった）
// どちらも「同じ場所に時期の異なる記述が蓄積され、古い情報と新しい情報が
// 矛盾したまま残る」リスクを持つため、追記が2回以上ある対面/本体だけを
// 対象に、内容の矛盾をLLMで判定する。書き込みはせず、判定結果を返すだけ。
// ============================================================

const APPEND_MARKERS = ['【ソロQ振り返りメモ', '## 【記事】'];

export interface MatchupContradictionCandidate {
  matchupId: string;
  champion: string;
  enemy: string;
  noteCount: number;
  summary: string;
}

function countAppends(strategy: string): number {
  return Math.max(...APPEND_MARKERS.map((m) => strategy.split(m).length - 1));
}

/** 1件分の矛盾判定。バッチ版(reviewMatchupContradictions)と即時チェック版(checkOneMatchupContradiction)で共有する。 */
async function judgeContradiction(row: { matchup_id: string; champion: string; enemy: string; strategy: string }): Promise<MatchupContradictionCandidate | null> {
  const noteCount = countAppends(row.strategy || '');
  if (noteCount < 2) return null;

  const subject = row.enemy === 'GLOBAL' ? `「${row.champion}」の辞典本体` : `「${row.champion} vs ${row.enemy}」の対面メモ`;
  const prompt = `以下はLoLの${subject}です。複数回にわたって追記された内容が含まれています。
時期の異なる記述同士で結論が矛盾していないか判定してください（例:「序盤有利」と「序盤不利」が両方書かれている等。パッチ変更を踏まえた自然な評価の変化は矛盾に含めない）。

${row.strategy}

必ず以下のJSONのみ出力（前置き・コードブロック禁止）:
{"hasContradiction":true|false,"summary":"<矛盾の内容。40字以内。無ければ空文字>"}`;
  try {
    const raw = await callGeminiWithRetry(prompt, { model: 'gemini-3.1-flash-lite', temperature: 0.2, maxOutputTokens: 200, maxRetries: 2, cacheKey: `matchupcontradiction:${row.matchup_id}:${noteCount}` });
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      const p = JSON.parse(cleaned.slice(s, e + 1));
      if (p.hasContradiction) {
        return { matchupId: row.matchup_id, champion: row.champion, enemy: row.enemy, noteCount, summary: p.summary || '' };
      }
    }
  } catch {
    // 判定失敗時はフラグを立てない(誤検知よりスキップを優先)
  }
  return null;
}

export async function reviewMatchupContradictions(supabase: any, limit: number): Promise<MatchupContradictionCandidate[]> {
  const { data: rows } = await supabase
    .from('matchup_sentinel')
    .select('matchup_id, champion, enemy, strategy')
    .not('strategy', 'is', null);

  const candidates = (rows || [])
    .map((r: any) => ({ ...r, noteCount: countAppends(r.strategy || '') }))
    .filter((r: any) => r.noteCount >= 2)
    .slice(0, limit);

  const results: MatchupContradictionCandidate[] = [];
  for (const c of candidates) {
    const found = await judgeContradiction(c);
    if (found) results.push(found);
  }
  return results;
}

/**
 * 1件（1チャンピオンのGLOBAL辞典本体、または1対面）だけを即座にチェックする軽量版。
 * /api/admin/knowledge/sync が記事をmatchup_sentinelへマージした直後に呼び、週次cronを
 * 待たずその日のうちに矛盾へ気づけるようにする(2026-08-04追加、案①)。
 * 見つかった場合は自前で通知は出さない(呼び出し側の責務)。
 */
export async function checkOneMatchupContradiction(
  supabase: any,
  matchupId: string
): Promise<MatchupContradictionCandidate | null> {
  const { data: row } = await supabase
    .from('matchup_sentinel')
    .select('matchup_id, champion, enemy, strategy')
    .eq('matchup_id', matchupId)
    .maybeSingle();
  if (!row || !row.strategy) return null;
  return judgeContradiction(row);
}

// ============================================================
// 修正パターン検知 (knowledge_revisions の再利用)
//
// knowledge_revisionsは差分ビューアー(/admin/knowledge/revisions)で人間が
// 個別に見るだけの書きっぱなしログだった。特定の項目だけ短期間に何度も
// 書き換えられている場合、パッチ更新等の通常サイクルではなく、AIの
// リサーチ内容が不安定/誤り続けている兆候である可能性が高いため、
// 週次の鮮度レビューに合わせて検知する(2026-08-12追加)。
// ============================================================

export interface RevisionHotspotCandidate {
  targetType: string;
  targetKey: string;
  revisionCount: number;
  mostRevisedField: string;
  lastRevisedAt: string;
}

const REVISION_HOTSPOT_WINDOW_DAYS = 14;
const REVISION_HOTSPOT_THRESHOLD = 6; // 通常の週次一括更新なら14日で2回程度のため、これを大きく超える件数のみ拾う

export async function reviewRevisionHotspots(supabase: any, limit: number): Promise<RevisionHotspotCandidate[]> {
  const since = new Date(Date.now() - REVISION_HOTSPOT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from('knowledge_revisions')
    .select('target_type, target_key, field, created_at')
    .gte('created_at', since);

  if (!rows || rows.length === 0) return [];

  const groups = new Map<
    string,
    { targetType: string; targetKey: string; count: number; fieldCounts: Map<string, number>; lastRevisedAt: string }
  >();
  for (const r of rows as { target_type: string; target_key: string; field: string; created_at: string }[]) {
    const key = `${r.target_type}|${r.target_key}`;
    let g = groups.get(key);
    if (!g) {
      g = { targetType: r.target_type, targetKey: r.target_key, count: 0, fieldCounts: new Map(), lastRevisedAt: r.created_at };
      groups.set(key, g);
    }
    g.count += 1;
    g.fieldCounts.set(r.field, (g.fieldCounts.get(r.field) || 0) + 1);
    if (r.created_at > g.lastRevisedAt) g.lastRevisedAt = r.created_at;
  }

  return Array.from(groups.values())
    .filter((g) => g.count >= REVISION_HOTSPOT_THRESHOLD)
    .map((g) => ({
      targetType: g.targetType,
      targetKey: g.targetKey,
      revisionCount: g.count,
      mostRevisedField: Array.from(g.fieldCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'body',
      lastRevisedAt: g.lastRevisedAt,
    }))
    .sort((a, b) => b.revisionCount - a.revisionCount)
    .slice(0, limit);
}

// ============================================================
// 品質審査 (Builder-Critic方式)
//
// これまで辞典生成は「作って終わり」の一発勝負で、実在の優良事例と比較する
// 品質チェックが無かった(2026-08-12、参考にしたnote記事群のBuilder-Critic
// パターンを踏まえ追加)。自動一括更新パイプライン(champ_db_bulk_updater.py)には
// 組み込まず、オンデマンドの手動チェックに留める——チャンピオン1体あたり実質
// Gemini呼び出しが増えるため、233体を毎回自動で二重採点すると、同日中に直した
// クォータ問題を再燃させかねないため。TS側の対話用キー(GEMINI_API_KEY)を使う
// ため、辞典一括更新のバッチ専用キー(GEMINI_API_KEY_BATCH)とも枠が別。
// ============================================================

export interface QualityCritique {
  champion: string;
  barChampion: string;
  pass: boolean;
  score: number;
  issues: string[];
  verdictSummary: string;
}

export async function critiqueChampionEntry(supabase: any, champion: string): Promise<QualityCritique | null> {
  const FIELDS = 'champion, strengths, weaknesses, power_spikes, build_runes, jg_type, jg_description, pro_builds, research_sources';

  const { data: target } = await supabase
    .from('champion_facts')
    .select(FIELDS)
    .ilike('champion', champion)
    .maybeSingle();
  if (!target) return null;

  // 「基準」を固定チャンピオンにハードコードすると、その記述自体が将来劣化/変更
  // された時に基準として機能しなくなるため、その時点で最も内容が充実している
  // 別チャンピオンを毎回動的に選ぶ。
  const { data: candidates } = await supabase
    .from('champion_facts')
    .select(FIELDS)
    .neq('champion', target.champion)
    .not('strengths', 'is', null)
    .not('weaknesses', 'is', null)
    .limit(30);

  const scored = (candidates || []).map((c: any) => ({
    row: c,
    len:
      (c.strengths?.length || 0) + (c.weaknesses?.length || 0) + (c.power_spikes?.length || 0) + (c.build_runes?.length || 0)
      + (Array.isArray(c.pro_builds) ? c.pro_builds.length * 50 : 0)
      + (Array.isArray(c.research_sources) ? c.research_sources.length * 20 : 0),
  })).sort((a: any, b: any) => b.len - a.len);
  const bar = scored[0]?.row;
  if (!bar) return null;

  const formatEntry = (f: any) =>
    `強み: ${f.strengths || '(空)'}\n弱み: ${f.weaknesses || '(空)'}\nパワースパイク: ${f.power_spikes || '(空)'}\n`
    + `ビルド・ルーン: ${f.build_runes || '(空)'}\nジャングルタイプ: ${f.jg_type || '(空)'} - ${f.jg_description || ''}\n`
    + `プロビルド件数: ${Array.isArray(f.pro_builds) ? f.pro_builds.length : 0}件\n出典件数: ${Array.isArray(f.research_sources) ? f.research_sources.length : 0}件`;

  const prompt = `あなたは辛口の品質審査AI(Critic)です。LoL(League of Legends)のチャンピオン辞典の「評価対象」を、実在の「基準となる優良事例」と比較し、同等以上の具体性・実用性を持っているか判定してください。

【基準となる優良事例】(チャンピオン: ${bar.champion})
${formatEntry(bar)}

【評価対象】(チャンピオン: ${target.champion})
${formatEntry(target)}

【評価基準】
1. 具体性: 「強い」「弱い」等の抽象的な表現だけでなく、具体的な数値・アイテム名・タイミングが含まれているか
2. 実用性: プレイヤーが実戦ですぐ使える示唆になっているか
3. 出典の有無: 裏取り可能な情報源が記録されているか

必ず以下のJSON形式のみで出力してください:
{
  "pass": true または false,
  "score": 1から10の整数,
  "issues": ["具体的な問題点(無ければ空配列)"],
  "verdict_summary": "1〜2文の日本語の総評"
}`;

  try {
    const raw = await callGeminiWithRetry(prompt, {
      model: 'gemini-3.1-flash-lite',
      temperature: 0.2,
      maxOutputTokens: 512,
      maxRetries: 2,
    });
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return {
      champion: target.champion,
      barChampion: bar.champion,
      pass: !!parsed.pass,
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      verdictSummary: parsed.verdict_summary || '',
    };
  } catch {
    return null;
  }
}
