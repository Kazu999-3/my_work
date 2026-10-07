import type { SupabaseClient } from '@supabase/supabase-js';

// 辞典(champion_facts)の各項目に「どの記事から何を足したか」を1件ずつ残す（champion_fact_claims、migration 89）。
// 04 lib/championFactClaims.ts と同じ処理（変える時は両方）。
// 2026-10-07: 毎週の自動更新が列を丸ごと上書きし、ライブラリ由来の追記が84体・425項目で消えていた。

const CLAIM_FIELDS = [
  'strengths', 'weaknesses', 'power_spikes', 'build_runes',
  'counter_champions', 'must_ban_champions', 'pick_recommendation', 'strategy',
];

/** 末尾への追記なら追記部分だけ、AI が全体を書き直していたら書き直し後の全文（要確認）を返す */
export function extractAddedText(before: string | null | undefined, after: string): { text: string; mixed: boolean } | null {
  const b = String(before || '').trim();
  const a = String(after || '').trim();
  if (!a || a === b) return null;
  if (!b) return { text: a, mixed: false };
  if (a.startsWith(b)) {
    const add = a.slice(b.length).trim().replace(/^【追記知見】\s*/, '').replace(/^-\s+/, '');
    return add ? { text: add, mixed: false } : null;
  }
  return { text: a, mixed: true };
}

/** 記事の統合で辞典の項目が変わった時に、足された部分を出典付きで記録する。失敗しても本来の処理は止めない。 */
export async function recordLibraryClaim(sb: SupabaseClient, input: {
  champion: string;
  field: string;
  before: string | null | undefined;
  after: string;
  articleId?: number | null;
  sourceTitle?: string | null;
}): Promise<void> {
  try {
    if (!CLAIM_FIELDS.includes(input.field)) return;
    const added = extractAddedText(input.before, input.after);
    if (!added) return;
    let sourceUrl: string | null = null;
    let title = input.sourceTitle || null;
    if (input.articleId != null) {
      const { data } = await sb.from('personal_knowledge').select('title, source_url').eq('id', input.articleId).maybeSingle();
      sourceUrl = data?.source_url || null;
      title = title || data?.title || null;
    }
    if (input.articleId == null && !sourceUrl && !title) return;
    const { error } = await sb.from('champion_fact_claims').upsert({
      champion: input.champion,
      field: input.field,
      body: added.text,
      origin: added.mixed ? 'library_mixed' : 'library',
      source_article_id: input.articleId ?? null,
      source_url: sourceUrl,
      source_title: title,
      needs_review: added.mixed,
    }, { onConflict: 'champion,field,body_hash', ignoreDuplicates: true });
    if (error) console.warn('[championFactClaims] 出典の記録に失敗:', error.message);
  } catch (e) {
    console.warn('[championFactClaims] 出典の記録に失敗:', e);
  }
}
