import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const heartbeatId = '00000000-0000-0000-0000-000000000000';
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    // 1回のリクエストで全クエリを並列超高速実行
    const [
      { data: heartbeat },
      { data: queueTasks },
      { data: historyTasks },
      { count: factsCount },
      { count: libraryCount },
      { count: laneGuidesCount },
      { count: memosCount },
      { count: matchupLogCount },
      { data: ytQueueData },
      { count: todayTasksCount },
      { data: dictData },
      { data: libData }
    ] = await Promise.all([
      // ワーカーハートビート
      supabase.from('edge_tasks').select('*').eq('id', heartbeatId).maybeSingle(),
      // 実行中・待機中タスク一覧
      supabase.from('edge_tasks').select('*').neq('id', heartbeatId).in('status', ['running', 'pending']),
      // 直近完了・失敗履歴
      supabase.from('edge_tasks').select('*').neq('id', heartbeatId).in('status', ['completed', 'failed']).order('updated_at', { ascending: false }).limit(5),
      // 知識ベース統計
      supabase.from('champion_facts').select('champion', { count: 'exact', head: true }),
      supabase.from('personal_knowledge').select('id', { count: 'exact', head: true }).or('tags.is.null,tags.not.cs.{__DELETED__}'),
      supabase.from('lane_guides').select('id', { count: 'exact', head: true }),
      supabase.from('matchup_sentinel').select('matchup_id', { count: 'exact', head: true }).neq('enemy', 'GLOBAL'),
      supabase.from('matchup_log').select('id', { count: 'exact', head: true }),
      // YouTubeキュー
      supabase.from('youtube_queue').select('id, title, status, channel_name, updated_at').order('updated_at', { ascending: false }).limit(3),
      // 本日消費カウント
      supabase.from('edge_tasks').select('id', { count: 'exact', head: true }).gt('created_at', todayStart),
      // 直近の更新
      supabase.from('matchup_sentinel').select('matchup_id, champion, title, created_at').eq('enemy', 'GLOBAL').order('created_at', { ascending: false }).limit(5),
      supabase.from('personal_knowledge').select('id, title, champion, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    // ワーカー判定
    let workerActive = false;
    let diffSec = 9999;
    if (heartbeat && heartbeat.updated_at) {
      const updatedAt = new Date(heartbeat.updated_at);
      diffSec = Math.floor((Date.now() - updatedAt.getTime()) / 1000);
      workerActive = diffSec <= 30;
    }

    // 正しい edge_tasks のリアルタイム集計をシステムコクピットデータとしてマッピング
    const pendingTasks = queueTasks?.filter((t: any) => t.status === 'pending') || [];
    const runningTasks = queueTasks?.filter((t: any) => t.status === 'running') || [];

    const youtubeRunning = runningTasks.some((t: any) => t.task_type?.includes('youtube'));
    const dictRunning = runningTasks.some((t: any) => t.task_type?.includes('champion_db') || t.task_type?.includes('dict'));

    return NextResponse.json({
      worker: {
        active: workerActive,
        diff_seconds: diffSec,
        status: heartbeat?.payload?.status || 'idle',
        last_active: heartbeat?.updated_at || null
      },
      queue: queueTasks || [],
      history: historyTasks || [],
      kbStats: {
        facts: factsCount ?? 0,
        library: libraryCount ?? 0,
        laneGuides: laneGuidesCount ?? 0,
        memos: memosCount ?? 0,
        matchupLog: matchupLogCount ?? 0
      },
      systemMetrics: {
        services: {
          youtube_absorber: { running: youtubeRunning },
          dict_synthesizer: { running: dictRunning }
        },
        queue: {
          pending: pendingTasks.length,
          running: runningTasks.length,
          completed: 0
        }
      },
      apiUsage: todayTasksCount ?? 0,
      recentYoutubeQueue: ytQueueData || [],
      recentDictUpdates: dictData || [],
      recentLibraryUpdates: libData || []
    });

  } catch (err: any) {
    console.error('❌ [Dashboard Stats API] GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
