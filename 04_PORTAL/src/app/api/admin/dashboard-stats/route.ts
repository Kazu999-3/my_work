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
      { count: dictCount },
      { count: libraryCount },
      { count: laneGuidesCount },
      { count: memosCount },
      { count: matchupLogCount },
      { data: ytQueueData },
      { count: todayTasksCount },
      { data: dictData },
      { data: libData },
      { data: recentTaskData },
      { count: youtubeErrorCount },
      { count: openRecruitCount },
      { data: recentRecruitData },
      { data: systemMetricsRow },
    ] = await Promise.all([
      // ワーカーハートビート
      supabase.from('edge_tasks').select('*').eq('id', heartbeatId).maybeSingle(),
      // 実行中・待機中タスク一覧
      supabase.from('edge_tasks').select('*').neq('id', heartbeatId).in('status', ['running', 'pending']),
      // 直近完了・失敗履歴
      supabase.from('edge_tasks').select('*').neq('id', heartbeatId).in('status', ['completed', 'failed']).order('updated_at', { ascending: false }).limit(5),
      // 知識ベース統計
      // 「チャンピオン辞典」件数は実際に辞典画面が表示する matchup_sentinel(enemy=GLOBAL)を正とする。
      // champion_facts は対面タブ専用の別テーブルで、辞典本体の件数とは一致しないため使わない。
      supabase.from('matchup_sentinel').select('champion', { count: 'exact', head: true }).eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', ''),
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
      // 「要対応」パネル用: 直近の失敗/完了タスク（同一(task_type, payload)キーの中で
      // 最新の状態だけを見て「今も本当に失敗中か」を判定するため、failed単独ではなく
      // completedも一緒に広めに取得する。再実行は新規タスクを積むだけで古い失敗行を
      // 消さないため、単純に status=failed だけを見ると「再実行して成功した後も
      // 古い失敗がずっとカウントされ続ける」バグになっていた。
      // youtube_absorbは動画ごとの状態がyoutube_queueテーブル(下のyoutubeErrorCount)に
      // 集約されており、ここに混ぜると大量の重複ノイズになるため除外する。task_typeも
      // 既知の(=ポータル側で遷移先を用意できる)種別だけに絞り、廃止済みタスク種別
      // (削除済み収益化パイプライン等)の「対応不可能な要対応」が残り続けるのを防ぐ。
      supabase.from('edge_tasks')
        .select('id, task_type, payload, status, error_message, updated_at, executor')
        .in('status', ['failed', 'completed'])
        .in('task_type', [
          'champion_trend', 'matchup_simulation_5v5', 'resolve_youtube_channel',
          'resolve_youtube_playlist', 'youtube_channel_monitor', 'reddit_scout',
          'lol_trend_collect', 'dict_synthesizer', 'champion_db_bulk_update',
        ])
        .order('updated_at', { ascending: false })
        .limit(200),
      // 「要対応」パネル用: 手動対応が必要な動画キューのエラー件数
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true }).in('status', ['error_generation', 'error_no_transcript', 'failed']),
      // 募集アクティビティ: 現在募集中の件数
      supabase.from('recruitments').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      // 募集アクティビティ: 直近の募集一覧
      supabase.from('recruitments').select('id, owner_discord_id, mode, max_count, status, created_at').order('created_at', { ascending: false }).limit(5),
      // クラウドワーカー(youtube_worker/prospector/champion_researcher等)の最終実行ログ。
      // scripts/notify.py の record_worker_log() がここに書き込んでいるが、システムコクピットの
      // 「サービス監視」タブはこれまでこの行を一度もクエリしておらず、常に空のまま表示されていた。
      supabase.from('matchup_sentinel').select('raw_data').eq('matchup_id', 'SYSTEM_METRICS').maybeSingle(),
    ]);

    // (task_type, payload)ごとに最新の1件だけを残し、それが failed のものだけを
    // 「まだ未解決の要対応」として抽出する（再実行後に成功していれば自動的に消える）。
    const latestByKey = new Map<string, any>();
    for (const t of (recentTaskData || [])) {
      const key = `${t.task_type}|${JSON.stringify(t.payload || {})}`;
      if (!latestByKey.has(key)) latestByKey.set(key, t); // 降順取得済みなので最初の1件が最新
    }
    const failedTaskData = Array.from(latestByKey.values())
      .filter((t) => t.status === 'failed')
      .slice(0, 10);

    // 直近募集の募集主名をktm_playersから解決（discord_idで突き合わせ）
    let recruitOwnerNames: Record<string, string> = {};
    const ownerIds = [...new Set((recentRecruitData || []).map((r: any) => r.owner_discord_id).filter(Boolean))];
    if (ownerIds.length > 0) {
      const { data: ownerPlayers } = await supabase.from('ktm_players').select('discord_id, name').in('discord_id', ownerIds);
      recruitOwnerNames = Object.fromEntries((ownerPlayers || []).map((p: any) => [p.discord_id, p.name]));
    }

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
        facts: dictCount ?? 0,
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
        },
        cloud_workers: (systemMetricsRow?.raw_data as any)?.cloud_workers || {},
      },
      apiUsage: todayTasksCount ?? 0,
      recentYoutubeQueue: ytQueueData || [],
      recentDictUpdates: dictData || [],
      recentLibraryUpdates: libData || [],
      needsAttention: {
        failedTasks: failedTaskData,
        youtubeErrorCount: youtubeErrorCount ?? 0,
      },
      recruitActivity: {
        openCount: openRecruitCount ?? 0,
        recent: (recentRecruitData || []).map((r: any) => ({
          ...r,
          owner_name: recruitOwnerNames[r.owner_discord_id] || null,
        })),
      }
    });

  } catch (err: any) {
    console.error('❌ [Dashboard Stats API] GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
