import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';


export async function POST(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const body = await req.json();
    const { champion, role } = body;
    
    if (!champion) {
      return NextResponse.json({ success: false, error: 'Missing champion name' }, { status: 400 });
    }

    // edge_tasks にキューを追加
    try {
      const { enqueueEdgeTask } = await import('../../../../../lib/edgeTask');
      const inserted = await enqueueEdgeTask('champion_trend', {
        champion,
        role: role || 'Jungle'
      });
      return NextResponse.json({ 
        success: true, 
        message: '最新トレンド取得タスクをキューに追加しました。処理開始をお待ちください。',
        task_id: inserted.id
      });
    } catch (insertErr: any) {
      return NextResponse.json({ success: false, error: `キューの追加に失敗しました: ${insertErr.message}` }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
