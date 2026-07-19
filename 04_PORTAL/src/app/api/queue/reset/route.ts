import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// YouTube解析キューのリセット(#88でDB化)。
// 旧実装はPCローカルの kirei_queue.json を書き換えていたため、Vercel上では機能しなかった。
// 現在のキューは youtube_queue テーブルなので、スタックした processing/failed を pending に戻す。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // S-01棚卸し対応: キューのリセットは管理者のみ
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('youtube_queue')
      .update({ status: 'pending', retry_count: 0, error_message: null })
      .in('status', ['processing', 'failed'])
      .select('id');
    if (error) throw error;
    return NextResponse.json({
      success: true,
      message: `${data?.length || 0} 件のタスクを pending に戻しました。次回のクラウドワーカー実行(30分おき)で再処理されます。`,
      resetCount: data?.length || 0,
    });
  } catch (e: any) {
    console.error('[queue/reset] error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
