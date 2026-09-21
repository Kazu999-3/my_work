import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// YouTube URL または動画IDのゆるい妥当性チェック(完全なURLバリデーションは不要、
// 明らかに無関係な文字列だけ弾く)
function isPlausibleYoutubeInput(value: string): boolean {
  if (!value || value.length > 500) return false;
  if (value.includes('youtube.com') || value.includes('youtu.be')) return true;
  // 動画IDのみの直接指定も許可(既存extract_video_tactics.pyの仕様に合わせる)
  return /^[\w-]{6,20}$/.test(value.trim());
}

// 1. 動画深堀り解析のリクエスト登録
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { videoUrl, champion } = await req.json();
    const trimmedUrl = String(videoUrl || '').trim();

    if (!isPlausibleYoutubeInput(trimmedUrl)) {
      return NextResponse.json({ error: 'YouTube動画のURLまたは動画IDを入力してください。' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('edge_tasks')
      .insert({
        task_type: 'video_deep_dive',
        payload: { video_url: trimmedUrl, champion: String(champion || '').trim() },
        status: 'pending',
      })
      .select('id, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      taskId: data.id,
      message: 'ローカルワーカーへ深堀り解析をリクエストしました。ワーカー起動中であれば数分以内に処理されます。',
    });
  } catch (err: any) {
    console.error('❌ [Video Deep Dive API] POST Error:', err);
    return NextResponse.json({ error: err.message || 'リクエストの登録に失敗しました。' }, { status: 500 });
  }
}

// 2. 直近の深堀り解析タスクの状況取得(ポーリング用)
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('edge_tasks')
      .select('id, status, payload, result, error_message, updated_at, created_at')
      .eq('task_type', 'video_deep_dive')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ success: true, tasks: data || [] });
  } catch (err: any) {
    console.error('❌ [Video Deep Dive API] GET Error:', err);
    return NextResponse.json({ error: 'タスク一覧の取得に失敗しました。' }, { status: 500 });
  }
}
