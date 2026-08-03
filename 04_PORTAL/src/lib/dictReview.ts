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

export async function getCurrentPatch(): Promise<string> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    return (versions[0] || '').split('.').slice(0, 2).join('.'); // "15.13"
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
// 対面メモの矛盾検出 (2026-08-03 追加)
//
// ソロQ振り返り機能(/api/soloq/reflections)が matchup_sentinel.strategy に
// 「【ソロQ振り返りメモ (日付)】」形式で追記し続ける設計のため、同じ対面に
// 時期の異なる矛盾したメモ（例: パッチ変更前後で真逆の結論）が蓄積される
// リスクがある。追記が2回以上ある対面だけを対象に、内容の矛盾をLLMで
// 判定する。書き込みはせず、判定結果を返すだけ。
// ============================================================

const APPEND_MARKER = '【ソロQ振り返りメモ';

export interface MatchupContradictionCandidate {
  matchupId: string;
  champion: string;
  enemy: string;
  noteCount: number;
  summary: string;
}

export async function reviewMatchupContradictions(supabase: any, limit: number): Promise<MatchupContradictionCandidate[]> {
  const { data: rows } = await supabase
    .from('matchup_sentinel')
    .select('matchup_id, champion, enemy, strategy')
    .neq('enemy', 'GLOBAL')
    .not('strategy', 'is', null);

  const candidates = (rows || [])
    .map((r: any) => ({ ...r, noteCount: ((r.strategy || '').split(APPEND_MARKER).length - 1) }))
    .filter((r: any) => r.noteCount >= 2)
    .slice(0, limit);

  const results: MatchupContradictionCandidate[] = [];
  for (const c of candidates) {
    const prompt = `以下は「${c.champion} vs ${c.enemy}」のLoL対面メモです。複数回にわたって追記されたソロQ振り返りメモが含まれています。
時期の異なるメモ同士で結論が矛盾していないか判定してください（例:「序盤有利」と「序盤不利」が両方書かれている等。パッチ変更を踏まえた自然な評価の変化は矛盾に含めない）。

${c.strategy}

必ず以下のJSONのみ出力（前置き・コードブロック禁止）:
{"hasContradiction":true|false,"summary":"<矛盾の内容。40字以内。無ければ空文字>"}`;
    try {
      const raw = await callGeminiWithRetry(prompt, { model: 'gemini-3.1-flash-lite', temperature: 0.2, maxOutputTokens: 200, maxRetries: 2, cacheKey: `matchupcontradiction:${c.matchup_id}:${c.noteCount}` });
      let cleaned = (raw || '').trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) {
        const p = JSON.parse(cleaned.slice(s, e + 1));
        if (p.hasContradiction) {
          results.push({ matchupId: c.matchup_id, champion: c.champion, enemy: c.enemy, noteCount: c.noteCount, summary: p.summary || '' });
        }
      }
    } catch {
      // 判定失敗時はフラグを立てない(誤検知よりスキップを優先)
    }
  }
  return results;
}
