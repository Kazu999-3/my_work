import { getChampionSearchVariations } from './championNames';

// ============================================================
// 統一知識取得レイヤー (課題#50 フェーズA)
//
// champion_facts（型付き本体）と champion_notes（記事/メモ）を合成し、
// 鮮度（patch/作成日）と出典優先度（手書き > 記事 > LLM）でランキングして
// テキストブロックを返す。コーチ・辞典・検索がこれを共通で使うことで、
// 「古い情報が混ざってアドバイス品質を下げる」問題を解消する。
//
// 新テーブルにデータが無ければ hasData=false を返すので、呼び出し側は
// 既存の matchup_sentinel 読み取りにフォールバックできる（非破壊移行）。
// ============================================================

// 出典の信頼度（大きいほど優先）
const SOURCE_PRIORITY: Record<string, number> = {
  manual: 5, matchup: 4, article: 3, custom_field: 2, note_draft: 1, llm: 1,
};

export interface ChampionKnowledge {
  hasData: boolean;
  text: string;
  latestPatch: string | null;
  factPatch: string | null;
  noteCount: number;
}

export async function getChampionKnowledge(
  supabase: any,
  champion: string,
  opts: { maxNotes?: number; maxNoteChars?: number } = {}
): Promise<ChampionKnowledge> {
  const empty: ChampionKnowledge = { hasData: false, text: '', latestPatch: null, factPatch: null, noteCount: 0 };
  if (!supabase || !champion) return empty;

  const maxNotes = opts.maxNotes ?? 5;
  const maxNoteChars = opts.maxNoteChars ?? 400;
  const variations = getChampionSearchVariations(champion);
  const orQuery = variations.map((v) => `champion.ilike.%${v}%`).join(',');

  const [{ data: facts }, { data: notes }] = await Promise.all([
    supabase.from('champion_facts').select('*').or(orQuery).limit(1),
    supabase.from('champion_notes').select('*').or(orQuery).limit(40),
  ]);

  const fact = facts && facts.length > 0 ? facts[0] : null;
  const noteRows: any[] = notes || [];

  if (!fact && noteRows.length === 0) return empty;

  // ノートを「鮮度(patch降順) → 出典優先度 → 作成日降順」でランキング
  const rankedNotes = [...noteRows].sort((a, b) => {
    const pa = a.patch || '', pb = b.patch || '';
    if (pa !== pb) return pb.localeCompare(pa); // 新しいパッチ優先
    const sa = SOURCE_PRIORITY[a.source] || 0, sb = SOURCE_PRIORITY[b.source] || 0;
    if (sa !== sb) return sb - sa;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  const factPatch = fact?.patch || null;
  const notePatch = rankedNotes[0]?.patch || null;
  const latestPatch = [factPatch, notePatch].filter(Boolean).sort((a, b) => (b as string).localeCompare(a as string))[0] || null;

  // テキスト合成
  const lines: string[] = [];
  if (fact) {
    lines.push(`【${fact.champion} 基本情報${fact.patch ? `（パッチ${fact.patch}）` : ''}】`);
    if (fact.strengths) lines.push(`強み: ${fact.strengths}`);
    if (fact.weaknesses) lines.push(`弱み: ${fact.weaknesses}`);
    if (fact.power_spikes) lines.push(`パワースパイク: ${fact.power_spikes}`);
    if (fact.build_runes) lines.push(`ビルド/ルーン: ${fact.build_runes}`);
    if (fact.full_clear_time) lines.push(`フルクリア: ${fact.full_clear_time}`);
    if (fact.jg_type) lines.push(`JGスタイル: ${fact.jg_type}${fact.jg_description ? `（${fact.jg_description}）` : ''}`);
    if (fact.counter_champions) lines.push(`カウンター: ${fact.counter_champions}`);
  }

  const topNotes = rankedNotes.slice(0, maxNotes);
  if (topNotes.length > 0) {
    lines.push('');
    lines.push('【関連メモ・記事（新しい順）】');
    for (const n of topNotes) {
      const tag = [n.patch ? `パッチ${n.patch}` : '', n.enemy ? `vs ${n.enemy}` : '', n.source].filter(Boolean).join('/');
      const body = (n.body || '').replace(/\s+/g, ' ').trim().slice(0, maxNoteChars);
      lines.push(`- 【${n.title || '無題'}】(${tag}) ${body}`);
    }
  }

  return {
    hasData: true,
    text: lines.join('\n'),
    latestPatch,
    factPatch,
    noteCount: rankedNotes.length,
  };
}
