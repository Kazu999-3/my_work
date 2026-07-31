import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// ============================================================
// note記事の公開管理・成績記録 (課題#54)
//
// noteには公式APIが無く、過去のスクレイピング(note_analytics_daemon.py)も
// 構造変化に弱く不安定だったため廃止済み。公開状態(URL/日時)と成績
// (閲覧数/スキ/売上)は管理者の手入力で記録する方式にする。
// ============================================================

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const update: Record<string, any> = {};

    // 公開登録: URLが渡されたら公開済み扱いにする（未指定ならpublished_atは現在時刻）
    if (typeof body.note_url === 'string') {
      update.note_url = body.note_url.trim() || null;
      if (update.note_url) {
        update.status = 'published';
        update.published_at = body.published_at ? new Date(body.published_at).toISOString() : new Date().toISOString();
      }
    }
    if (body.published_at !== undefined && update.published_at === undefined) {
      update.published_at = body.published_at ? new Date(body.published_at).toISOString() : null;
    }

    // 配信予定日（公開前の下書きに設定する）
    if (body.scheduled_at !== undefined) {
      update.scheduled_at = body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;
    }

    // 成績の手入力（渡された項目だけ更新）
    let touchedMetrics = false;
    for (const key of ['views', 'likes', 'sales_count', 'sales_amount'] as const) {
      if (body[key] !== undefined) {
        const n = Number(body[key]);
        update[key] = Number.isFinite(n) ? n : null;
        touchedMetrics = true;
      }
    }
    if (touchedMetrics) update.metrics_updated_at = new Date().toISOString();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません。' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('note_articles')
      .update(update)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ success: true, article: data });
  } catch (err: any) {
    console.error('[note-articles PATCH] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
