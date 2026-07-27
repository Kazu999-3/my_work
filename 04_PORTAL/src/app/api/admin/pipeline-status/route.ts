import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// 監視対象のジョブタイプ一覧
// 「データ収集」(lol_trend_collect) と「プロビルド」(pro_build%) は、そもそも
// edge_tasks に起票する仕組みが実装されたことがない（プロビルドはtask_type自体が
// 非存在）ため、常に古い/未実行のまま変わらず表示が実態と乖離していた。削除する。
const PIPELINE_JOBS = [
  { id: 'youtube-analysis', label: 'YouTube解析', pattern: 'youtube%' },
  { id: 'dict-synthesis', label: '辞典更新', pattern: 'champion_db%' },
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
          .select('status, created_at, updated_at, task_type')
          .ilike('task_type', job.pattern)
          .order('created_at', { ascending: false })
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
        };
      })
    );

    return NextResponse.json({ pipelines: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
