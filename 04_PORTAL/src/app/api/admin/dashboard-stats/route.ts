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
      // 「チャンピオン辞典」件数は実際に辞典画面が表示する matchup_sentinel(enemy=GLOBAL)を正とする。
      // champion_facts は対面タブ専用の別テーブルで、辞典本体の件数とは一致しないため使わない。
      supabase.from('matchup_sentinel').select('champion', { count: 'exact', head: true }).eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', ''),
      supabase.from('personal_knowledge').select('id', { count: 'exact', head: true }).or('tags.is.null,tags.not.cs.{__DELETED__}'),
      supabase.from('lane_guides').select('id', { count: 'exact', head: true }),
      supabase.from('matchup_sentinel').select('matchup_id', { count: 'exact', head: true }).neq('enemy', 'GLOBAL'),
      supabase.from('matchup_log').select('id', { count: 'exact', head: true }),
      // 「要対応」パネル用: 直近の失敗/完了タスク（同一(task_type, payload)キーの中で
      // 最新の状態だけを見て「今も本当に失敗中か」を判定するため、failed単独ではなく
      // completedも一緒に広めに取得する。再実行は新規タスクを積むだけで古い失敗行を
      // 消さないため、単純に status=failed だけを見ると「再実行して成功した後も
      // 古い失敗がずっとカウントされ続ける」バグになっていた。
      // youtube_absorbは動画ごとの状態がyoutube_queueテーブル(下のyoutubeErrorCount)に
      // 集約されており、ここに混ぜると大量の重複ノイズになるため除外する。task_typeも
      // 既知の(=ポータル側で遷移先を用意できる)種別だけに絞り、廃止済みタスク種別
      // (削除済み収益化パイプライン等)の「対応不可能な要対応」が残り続けるのを防ぐ。
      // matchup_simulation_5v5は10人分のチャンピオン構成そのものがpayloadになるため、
      // 全く同じ組み合わせで再実行されない限り(task_type,payload)デデュープが効かず、
      // 古い失敗が消えずに残り続けてしまう。またダッシュボードから再試行する導線も無い
      // ため、そもそもこのパネルの対象から除外する(結果はコーチページその場で見るもの)。
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
      // クラウドワーカー(youtube_worker/prospector/champion_researcher等)の最終実行ログ。
      // scripts/notify.py の record_worker_log() がここに書き込んでいるが、システムコクピットの
      // 「サービス監視」タブはこれまでこの行を一度もクエリしておらず、常に空のまま表示されていた。
      supabase.from('matchup_sentinel').select('raw_data').eq('matchup_id', 'SYSTEM_METRICS').maybeSingle(),
      // 「要対応」パネル用: 辞典の鮮度レビュー(週次自動検知)の直近結果。
      // AI判定を毎回このAPIで回すとコストが高いため、/api/cron/dict-review-check が
      // 書き込んだ通知履歴を読むだけにする（8日以内＝直近の週次実行分のみ有効扱い）。
      supabase.from('admin_notifications')
        .select('data, created_at')
        .eq('type', 'dict_review')
        .eq('read', false)
        .gt('created_at', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 「要対応」パネル用: 辞典一括更新の進捗ハートビート行(champ_db_bulk_updater.pyが
      // save_queueのたびにUPSERTする固定ID行)。champion_db_bulk_updateのedge_task自体は
      // edge_worker_daemon.py側でサブプロセスさえ正常終了すれば内部でsuspendedしていても
      // 常に"completed"にされるため、下のfailedTaskData(status=failed検出)では
      // 一切引っかからない。一括更新がAPI制限で一時停止していても「リアルタイム
      // タスクキュー」から完全に消えて見えてしまう問題(2026-08-12発覚)を防ぐため、
      // この行を直接見てstatus==='suspended'なら別途要対応に加える。
      supabase.from('edge_tasks')
        .select('status, payload, updated_at')
        .eq('id', '00000000-0000-0000-0000-000000000002')
        .maybeSingle(),
      // 「辞典ヘルス」カード用: /admin/dict-health と同じ内訳のサマリー。
      // システム運用トップに辞典の要対応件数が一切出ておらず、ヘルスダッシュボードを
      // 開くまで気づけなかったため追加(2026-08-13)。
      // 2026-08-14発覚: confidence列の値をそのまま数えるだけの実装だったため、常に
      // 要対応=0を表示する実バグだった。confidence='stale'という値はDBに一度も保存
      // されておらず、/admin/dict-healthは「パッチ不一致」または「strengths空」も
      // 要対応として動的に判定している。同じ分類ロジックに揃える。
      supabase.from('champion_facts').select('confidence, patch, strengths'),
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
        return true;
      })
      .slice(0, 10);

    // 辞典一括更新が内部でsuspended(API制限等で一時停止)している場合、上のデデュープ
    // では検知できないため別枠で先頭に追加する。
    const bulkProgress = champdbBulkProgress?.payload as any;
    if (champdbBulkProgress?.status === 'suspended' && bulkProgress) {
      failedTaskData.unshift({
        id: 'champdb_bulk_progress',
        task_type: 'champion_db_bulk_update',
        payload: {
          completed: bulkProgress.completed,
          total: bulkProgress.total,
          patch_version: bulkProgress.patch_version,
        },
        status: 'suspended',
        error_message: `${bulkProgress.completed ?? 0}/${bulkProgress.total ?? '?'}体完了、API制限等により一時停止中です`,
        updated_at: champdbBulkProgress.updated_at,
        executor: null,
      });
    }

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
