import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// 監視対象のジョブタイプ一覧
// 「データ収集」(lol_trend_collect) と「プロビルド」(pro_build%) は、そもそも
// edge_tasks に起票する仕組みが実装されたことがない（プロビルドはtask_type自体が
// 非存在）ため、常に古い/未実行のまま変わらず表示が実態と乖離していた。削除する。
//
// dict-synthesisは以前 champion_db% (=champion_db_bulk_update、週次バッチのみ)しか
// 見ておらず、実際に高頻度で辞典更新を行っている dict_synthesizer タスクの活動が
// 一切反映されず「全く更新されてない」ように見えていた。両方をtypesで監視する。
const PIPELINE_JOBS: { id: string; label: string; types: string[] }[] = [
  { id: 'youtube-analysis', label: 'YouTube解析', types: ['youtube_absorb', 'youtube_channel_monitor', 'resolve_youtube_channel', 'resolve_youtube_playlist'] },
  { id: 'dict-synthesis', label: '辞典更新', types: ['champion_db_bulk_update', 'dict_synthesizer'] },
  // edge_worker_daemon.py(ローカル)と edge-cloud-worker.yml(クラウド)の両方が
  // 同じ固定IDにUPSERTする生存ハートビート。どちらか新しい方の稼働状況を示す。
  { id: 'edge-worker', label: 'オンデマンド処理(トレンド/シミュレーション等)', types: ['worker_heartbeat'] },
];

export async function GET(req: Request) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const supabase = supabaseAdmin;

    const results = await Promise.all(
      PIPELINE_JOBS.map(async (job) => {
        // 各ジョブタイプの最新タスクを取得
        const { data } = await supabase
          .from('edge_tasks')
          .select('status, created_at, updated_at, task_type, executor')
          .in('task_type', job.types)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastRun = data?.updated_at || data?.created_at || null;
        const status = data?.status || 'never';

        // 鮮度判定: 24時間以内=fresh, 72時間以内=stale, それ以上=old
        let freshness: 'fresh' | 'stale' | 'old' | 'never' = 'never';
        if (lastRun) {
          const hoursAgo = (Date.now() - new Date(lastRun).getTime()) / 3600000;
          freshness = hoursAgo < 24 ? 'fresh' : hoursAgo < 72 ? 'stale' : 'old';
        }

        return {
          id: job.id,
          label: job.label,
          lastRun,
          status,
          freshness,
          executor: data?.executor || null,
        };
      })
    );

    // champion_trend の直近の失敗タスク一覧（通知から再実行導線を辿れるように）。
    // 再実行は新規タスクを積むだけで古い失敗行を消さないため、status=failedだけを
    // 見ると「再実行して成功した後も古い失敗がずっと表示され続ける」バグになる
    // (ダッシュボードの要対応パネルと同じ問題)。(champion, role)ごとに最新の状態だけを見る。
    const { data: recentTrendTasks } = await supabase
      .from('edge_tasks')
      .select('id, payload, status, error_message, updated_at, executor')
      .eq('task_type', 'champion_trend')
      .in('status', ['failed', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(100);

    const latestByPayload = new Map<string, any>();
    for (const t of (recentTrendTasks || [])) {
      const key = JSON.stringify(t.payload || {});
      if (!latestByPayload.has(key)) latestByPayload.set(key, t); // 降順取得済みなので最初の1件が最新
    }
    const failedTrendTasks = Array.from(latestByPayload.values())
      .filter((t) => {
        if (t.status !== 'failed') return false;
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

    return NextResponse.json({ pipelines: results, failedTasks: failedTrendTasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
