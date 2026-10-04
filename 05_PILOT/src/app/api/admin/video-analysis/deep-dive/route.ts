import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// 動画深掘り解析のリクエスト（旧ポータル /api/admin/video-analysis/deep-dive の移植）。2026-10-04
// edge_tasks に video_deep_dive を積むと、PCのエッジワーカー(edge_worker_daemon.py)が
// scripts/extract_video_tactics.py --deep-dive を実行し、対面・マクロ・ビルドの3観点で戦術バイブルへ追記する。

// 明らかに無関係な文字列だけ弾く（動画IDの直接指定も extract_video_tactics.py の仕様に合わせて許可）
function isPlausibleYoutubeInput(value: string): boolean {
  if (!value || value.length > 500) return false;
  if (value.includes('youtube.com') || value.includes('youtu.be')) return true;
  return /^[\w-]{6,20}$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { videoUrl, champion } = await req.json().catch(() => ({}));
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
      message: 'PCのエッジワーカーへ深掘り解析をリクエストしました。ワーカー稼働中なら数分〜20分で処理されます。',
    });
  } catch (e: any) {
    console.error('[admin/video-analysis/deep-dive] POST Error:', e);
    return NextResponse.json({ error: e.message || 'リクエストの登録に失敗しました。' }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { data, error } = await supabase
      .from('edge_tasks')
      .select('id, status, payload, error_message, updated_at, created_at')
      .eq('task_type', 'video_deep_dive')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return NextResponse.json({ success: true, tasks: data || [] });
  } catch (e: any) {
    console.error('[admin/video-analysis/deep-dive] GET Error:', e);
    return NextResponse.json({ error: 'タスク一覧の取得に失敗しました。' }, { status: 500 });
  }
}
