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
