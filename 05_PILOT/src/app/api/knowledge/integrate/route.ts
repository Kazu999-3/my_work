import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { integrateArticles } from '@/lib/knowledgeIntegrate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_LIMIT_MAX = 30;
const SELECT = 'id, title, content, raw_content, champion, tags, source_url';

// 攻略ライブラリの記事をチャンピオン辞典へ統合する（旧ポータル knowledge/sync の後継）。
//   { ids: [..] }                          … 指定した記事を統合（承認画面の「承認して統合」）
//   { mode: 'batch', afterId, limit, onlyPending | onlyApproved }
//                                          … id 昇順に未統合の記事を順に統合（一括統合・定期実行用）。
//                                            レスポンスの nextAfterId を次回の afterId に渡す。
//                                            定期実行は onlyApproved（承認待ちを勝手に統合しない）。
// 認証は proxy.ts（Cookie、または GitHub Actions からの Bearer トークン）で行う。
export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await req.json().catch(() => ({}));

    let articles: any[] = [];
    let nextAfterId: number | null = null;
    let done = true;

    if (Array.isArray(body.ids)) {
      const ids = body.ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 100);
      if (ids.length === 0) return NextResponse.json({ error: 'ids が空です' }, { status: 400 });
      const { data, error } = await supabase.from('personal_knowledge').select(SELECT).in('id', ids)
        .or('tags.is.null,tags.not.cs.{__DELETED__}');
      if (error) throw error;
      articles = data || [];
    } else if (body.mode === 'batch') {
      const afterId = Number(body.afterId) || 0;
      const limit = Math.min(BATCH_LIMIT_MAX, Math.max(1, Number(body.limit) || 15));
      let q = supabase.from('personal_knowledge').select(SELECT)
        .gt('id', afterId)
        // tags が NULL の記事に .not('tags','cs',..) を別に掛けると比較結果が NULL になって除外されるため、
        // 1つの or 条件にまとめる（旧ポータルの同期ではタグ無しの記事が永久に対象外だった）
        // __INTEGRATED__ は統合済み。外さないと3時間おきに同じ記事を統合し直す
        .or('tags.is.null,and(tags.not.cs.{__DELETED__},tags.not.cs.{__MERGED__},tags.not.cs.{__INTEGRATED__})')
        .order('id', { ascending: true })
        .limit(limit);
      if (body.onlyPending) q = q.eq('review_status', 'pending');
      else if (body.onlyApproved) q = q.eq('review_status', 'approved');
      const { data, error } = await q;
      if (error) throw error;
      articles = data || [];
      done = articles.length < limit;
      nextAfterId = articles.length > 0 ? articles[articles.length - 1].id : null;
    } else {
      return NextResponse.json({ error: 'ids か mode:"batch" を指定してください' }, { status: 400 });
    }

    const result = await integrateArticles(supabase, articles);

    return NextResponse.json({
      success: result.errors.length === 0,
      processed: articles.length,
      integrated: result.integrated.length,
      integratedIds: result.integrated,
      skippedNoChampion: result.skippedNoChampion.length,
      champions: result.champions,
      errors: result.errors,
      nextAfterId: done ? null : nextAfterId,
      done,
    });
  } catch (e: any) {
    console.error('[knowledge/integrate] Error:', e);
    return NextResponse.json({ error: e.message || '統合に失敗しました' }, { status: 500 });
  }
}
