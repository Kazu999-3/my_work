import { supabaseAdmin } from './supabaseAdmin';

// 辞典(champion_facts)の各項目に「どの記事から何を足したか」を1件ずつ残す（champion_fact_claims、migration 89）。
// 2026-10-07: 毎週の自動更新が列を丸ごと上書きし、ライブラリ由来の追記が84体・425項目で消えていた。
// 列の文章だけでは出典が分からないため、追記のたびにここへ記録する。
// 出典の無い AI 生成をこのテーブルに入れる時は origin='ai_estimate' にすること（DB の CHECK 制約でも保証）。

export const CLAIM_FIELDS = [
  'strengths', 'weaknesses', 'power_spikes', 'build_runes',
  'counter_champions', 'must_ban_champions', 'pick_recommendation', 'strategy',
] as const;

export type ClaimOrigin = 'library' | 'library_mixed' | 'web_search' | 'manual' | 'ai_estimate';

/**
 * 更新前後の文章から「足された部分」を取り出す。
 * 末尾への追記なら追記部分だけ（origin=library）、AI が全体を書き直していたら書き直し後の全文（origin=library_mixed、要確認）。
 */
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

/** 記事の承認・統合で辞典の項目が変わった時に、足された部分を出典付きで記録する。失敗しても本来の処理は止めない。 */
export async function recordLibraryClaim(input: {
  champion: string;
  field: string;
  before: string | null | undefined;
  after: string;
  sourceId?: string | number | null;
  sourceTitle?: string | null;
}): Promise<void> {
  try {
    if (!(CLAIM_FIELDS as readonly string[]).includes(input.field)) return;
    const added = extractAddedText(input.before, input.after);
    if (!added) return;
    const articleId = input.sourceId != null && /^\d+$/.test(String(input.sourceId)) ? Number(input.sourceId) : null;
    let sourceUrl: string | null = null;
    let title = input.sourceTitle || null;
    if (articleId != null) {
      const { data } = await supabaseAdmin.from('personal_knowledge').select('title, source_url').eq('id', articleId).maybeSingle();
      sourceUrl = data?.source_url || null;
      title = title || data?.title || null;
    }
    if (articleId == null && !sourceUrl && !title) return; // 出典が分からないものはライブラリ由来として記録しない
    const { error } = await supabaseAdmin.from('champion_fact_claims').upsert({
      champion: input.champion,
      field: input.field,
      body: added.text,
      origin: added.mixed ? 'library_mixed' : 'library',
      source_article_id: articleId,
      source_url: sourceUrl,
      source_title: title,
      needs_review: added.mixed,
    }, { onConflict: 'champion,field,body_hash', ignoreDuplicates: true });
    if (error) console.warn('[championFactClaims] 出典の記録に失敗:', error.message);
  } catch (e) {
    console.warn('[championFactClaims] 出典の記録に失敗:', e);
  }
}
