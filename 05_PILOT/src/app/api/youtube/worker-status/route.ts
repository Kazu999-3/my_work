import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// PCのエッジワーカーの死活と、動画解析パイプラインの実測値を返す。
//
// 死活はローカルデーモン専用のハートビート行(…0005)で判定する。旧ポータルは共有行(…0000)を
// 見ていたが、そちらは GitHub Actions も更新するため、デーモンが落ちていても稼働中に見えていた。
// デーモンは5秒おきに送信するので、2分以上途切れたら停止とみなす。
const LOCAL_HEARTBEAT_ID = '00000000-0000-0000-0000-000000000005';
const STALE_SEC = 120;
const HEARTBEAT_IDS = ['00000000-0000-0000-0000-000000000000', LOCAL_HEARTBEAT_ID];

export async function GET() {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [hb, pendingTasks, failed24h, lastCompleted, completed24h, pendingVideos, latestFailure] = await Promise.all([
      supabase.from('edge_tasks').select('updated_at, payload').eq('id', LOCAL_HEARTBEAT_ID).maybeSingle(),
      supabase.from('edge_tasks').select('id, task_type, status, created_at')
        .in('status', ['pending', 'running']).not('id', 'in', `(${HEARTBEAT_IDS.join(',')})`)
        .order('created_at', { ascending: true }).limit(20),
      supabase.from('edge_tasks').select('id', { count: 'exact', head: true })
        .eq('status', 'failed').gte('created_at', since24h),
      supabase.from('youtube_queue').select('updated_at').eq('status', 'completed')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true })
        .eq('status', 'completed').gte('updated_at', since24h),
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('edge_tasks').select('task_type, error_message, updated_at')
        .eq('status', 'failed').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (hb.error) throw hb.error;

    const lastBeat = hb.data?.updated_at ? new Date(hb.data.updated_at) : null;
    const diffSec = lastBeat ? Math.floor((Date.now() - lastBeat.getTime()) / 1000) : null;

    return NextResponse.json({
      success: true,
      worker: {
        active: diffSec !== null && diffSec <= STALE_SEC,
        lastHeartbeat: hb.data?.updated_at || null,
        diffSeconds: diffSec,
        status: (hb.data?.payload as any)?.status || null,
      },
      tasks: {
        waiting: pendingTasks.data || [],
        failed24h: failed24h.count || 0,
        latestFailure: latestFailure.data
          ? { ...latestFailure.data, error_message: String(latestFailure.data.error_message || '').slice(-300) }
          : null,
      },
      videos: {
        pending: pendingVideos.count || 0,
        completed24h: completed24h.count || 0,
        lastCompletedAt: lastCompleted.data?.updated_at || null,
      },
    });
  } catch (e: any) {
    console.error('[youtube/worker-status] Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}
