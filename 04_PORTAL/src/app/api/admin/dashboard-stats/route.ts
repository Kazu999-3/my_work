import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { getPlayerCoins } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const heartbeatId = '00000000-0000-0000-0000-000000000000';

    // 1回のリクエストで全クエリを並列超高速実行
    const [
      { data: heartbeat },
      { data: queueTasks },
      { count: ytPendingCount },
      { count: ytCompletedCount },
      { data: historyTasks },
      { count: dictCount },
      { count: libraryCount },
      { count: laneGuidesCount },
      { count: memosCount },
      { count: matchupLogCount },
      { data: recentTaskData },
      { count: youtubeErrorCount },
      { data: systemMetricsRow },
      { data: dictReviewNotif },
      { data: champdbBulkProgress },
      { data: dictHealthRows },
      { data: activePlayers },
      { data: allMatches },
      { data: pendingBetTasks },
    ] = await Promise.all([
      // ワーカーハートビート
      supabase.from('edge_tasks').select('*').eq('id', heartbeatId).maybeSingle(),
      // 実行中・待機中タスク一覧
      supabase.from('edge_tasks').select('*').neq('id', heartbeatId).in('status', ['running', 'pending']),
      // YouTube 吸収キュー件数 (youtube_queue.status の実値は pending/completed/on_hold/error_*/failed/manually_closed のみ)
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      // 直近完了・失敗履歴
      supabase.from('edge_tasks').select('*').neq('id', heartbeatId).in('status', ['completed', 'failed']).order('updated_at', { ascending: false }).limit(5),
      // 知識ベース統計
      supabase.from('matchup_sentinel').select('champion', { count: 'exact', head: true }).eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', ''),
      supabase.from('personal_knowledge').select('id', { count: 'exact', head: true }).or('tags.is.null,tags.not.cs.{__DELETED__}'),
      supabase.from('lane_guides').select('id', { count: 'exact', head: true }),
      supabase.from('matchup_sentinel').select('matchup_id', { count: 'exact', head: true }).neq('enemy', 'GLOBAL'),
      supabase.from('matchup_log').select('id', { count: 'exact', head: true }),
      // 「要対応」パネル用: 直近の失敗/完了タスク
      supabase.from('edge_tasks')
        .select('id, task_type, payload, status, error_message, updated_at, executor')
        .in('status', ['failed', 'completed'])
        .in('task_type', [
          'champion_trend', 'resolve_youtube_channel',
          'resolve_youtube_playlist', 'youtube_channel_monitor', 'reddit_scout',
          'lol_trend_collect', 'dict_synthesizer', 'champion_db_bulk_update',
        ])
        .order('updated_at', { ascending: false })
        .limit(200),
      // 「要対応」パネル用: 手動対応が必要な動画キューのエラー件数
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true }).in('status', ['error_generation', 'error_no_transcript', 'failed']),
      // クラウドワーカー実行ログ
      supabase.from('matchup_sentinel').select('raw_data').eq('matchup_id', 'SYSTEM_METRICS').maybeSingle(),
      // 鮮度レビュー通知
      supabase.from('admin_notifications')
        .select('data, created_at')
        .eq('type', 'dict_review')
        .eq('read', false)
        .gt('created_at', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 辞典一括更新ハートビート
      supabase.from('edge_tasks')
        .select('status, payload, updated_at')
        .eq('id', '00000000-0000-0000-0000-000000000002')
        .maybeSingle(),
      // 辞典ヘルス
      supabase.from('champion_facts').select('confidence, patch, strengths'),
      // 🏆 大会メトリクス用: 登録プレイヤー
      supabase.from('ktm_players').select('id, name, role_preferences, metadata, is_active'),
      // 🏆 大会メトリクス用: 試合履歴
      supabase.from('ktm_matches').select('id, created_at').order('created_at', { ascending: false }).limit(200),
      // 🪙 カジノメトリクス用: 未精算ベットタスク
      supabase.from('edge_tasks').select('id, payload, created_at').eq('task_type', 'bet_record').eq('status', 'pending'),
    ]);

    // dict-health/route.tsのgetCurrentPatch()と同じロジック(西暦下2桁基準への変換)。
    // ここがズレると全チャンピオンが誤って「パッチ不一致」判定される。
    const dictHealthCurrentPatch = await (async () => {
      try {
        const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await res.json();
        const [rawMajor, rawMinor] = (versions[0] || '16.15.1').split('.');
        return `${parseInt(rawMajor, 10) + 10}.${rawMinor}`;
      } catch {
        return '26.15';
      }
    })();

    // (task_type, payload)ごとに最新の1件だけを残し、それが failed のものだけを
    // 「まだ未解決の要対応」として抽出する（再実行後に成功していれば自動的に消える）。
    const latestByKey = new Map<string, any>();
    for (const t of (recentTaskData || [])) {
      const key = `${t.task_type}|${JSON.stringify(t.payload || {})}`;
      if (!latestByKey.has(key)) latestByKey.set(key, t); // 降順取得済みなので最初の1件が最新
    }
    const failedTaskData = Array.from(latestByKey.values())
      .filter((t) => {
        if (t.status !== 'failed') return false;
        // チャンピオン辞典一括更新のタイムアウト＆自動再キューは正常な分割処理のため要対応から除外
        if (
          t.task_type === 'champion_db_bulk_update' &&
          typeof t.error_message === 'string' &&
          (t.error_message.includes('自動的に再キュー') || t.error_message.includes('3600秒'))
        ) {
          return false;
        }
        // クォータ枯渇・レート制限による安全スキップは要対応（バグ）から除外
        const errMsg = String(t.error_message || '').toLowerCase();
        if (
          errMsg.includes('quota') ||
          errMsg.includes('429') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('クォータ') ||
          errMsg.includes('利用上限') ||
          errMsg.includes('安全にスキップ') ||
          errMsg.includes('skipped')
        ) {
          return false;
        }
        return true;
      })
      .slice(0, 10);



    // ワーカー判定 (DBのupdated_at と payload.last_active の双方からタイムスタンプをパース)
    let workerActive = false;
    let diffSec = 9999;
    
    const rawTime = heartbeat?.updated_at || (heartbeat?.payload as any)?.last_active;
    if (rawTime) {
      const updatedAt = new Date(rawTime);
      const nowMs = Date.now();
      const updatedMs = updatedAt.getTime();
      if (!isNaN(updatedMs)) {
        diffSec = Math.max(0, Math.floor((nowMs - updatedMs) / 1000));
        // ワーカーのハートビート間隔(5秒〜30秒)＋クロック差・遅延を考慮し90秒以内なら稼働中と判定
        workerActive = diffSec <= 90;
      }
    }

    // 正しい edge_tasks のリアルタイム集計をシステムコクピットデータとしてマッピング
    const pendingTasks = queueTasks?.filter((t: any) => t.status === 'pending') || [];
    const runningTasks = queueTasks?.filter((t: any) => t.status === 'running') || [];

    const youtubeRunning = runningTasks.some((t: any) => t.task_type?.includes('youtube'));
    const dictRunning = runningTasks.some((t: any) => t.task_type?.includes('champion_db') || t.task_type?.includes('dict'));

    const dictHealthSummary = { verified: 0, aiGenerated: 0, stale: 0 };
    for (const row of (dictHealthRows || []) as any[]) {
      const p = (row.patch || '').split('.').slice(0, 2).join('.');
      const isLatestPatch = p === dictHealthCurrentPatch;
      const conf = row.confidence || 'ai_generated';
      const hasContent = !!row.strengths;

      if (conf === 'verified') dictHealthSummary.verified++;
      else if (!hasContent || !isLatestPatch || conf === 'stale') dictHealthSummary.stale++;
      else dictHealthSummary.aiGenerated++;
    }

    // 🏆 大会メトリクス集計
    const allPlayersList = activePlayers || [];
    const playersList = allPlayersList.filter((p: any) => p.is_active !== false);
    const activePlayerCount = playersList.length;
    const matchesList = allMatches || [];
    const totalMatchCount = matchesList.length;
    
    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentMatchesCount = matchesList.filter((m: any) => {
      const d = m.created_at;
      return d ? new Date(d).getTime() >= sevenDaysAgoMs : false;
    }).length;

    // 🪙 カジノメトリクス集計
    const totalCirculatingCoins = playersList.reduce((acc: number, p: any) => {
      return acc + getPlayerCoins(p);
    }, 0);

    const pendingBets = pendingBetTasks || [];
    let pendingBetBlueAmount = 0;
    let pendingBetRedAmount = 0;
    let pendingBetBlueCount = 0;
    let pendingBetRedCount = 0;

    for (const b of pendingBets) {
      const p = b.payload || {};
      const amt = Number(p.amount) || 0;
      const side = String(p.side || '').toLowerCase();
      if (side === 'blue') {
        pendingBetBlueAmount += amt;
        pendingBetBlueCount++;
      } else if (side === 'red') {
        pendingBetRedAmount += amt;
        pendingBetRedCount++;
      }
    }

    return NextResponse.json({
      worker: {
        active: workerActive,
        diff_seconds: diffSec,
        status: heartbeat?.payload?.status || 'idle',
        last_active: heartbeat?.updated_at || null
      },
      queue: queueTasks || [],
      history: historyTasks || [],
      ktmStats: {
        activePlayers: activePlayerCount,
        totalMatches: totalMatchCount,
        recentMatches: recentMatchesCount,
        latestMatchDate: matchesList[0]?.created_at || null,
      },
      casinoStats: {
        totalCirculatingCoins,
        pendingBetTotalAmount: pendingBetBlueAmount + pendingBetRedAmount,
        pendingBetCount: pendingBets.length,
        blueAmount: pendingBetBlueAmount,
        redAmount: pendingBetRedAmount,
        blueCount: pendingBetBlueCount,
        redCount: pendingBetRedCount,
      },
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
          pending: ytPendingCount ?? 0,
          running: runningTasks.filter((t: any) => t.task_type?.includes('youtube')).length,
          completed: ytCompletedCount ?? 0
        },
        cloud_workers: (systemMetricsRow?.raw_data as any)?.cloud_workers || {},
      },
      dictHealthSummary,
      needsAttention: {
        failedTasks: failedTaskData,
        youtubeErrorCount: youtubeErrorCount ?? 0,
        dictReviewCount: (dictReviewNotif?.data as any)?.needsAttention ?? 0,
      },
    });

  } catch (err: any) {
    console.error('❌ [Dashboard Stats API] GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
