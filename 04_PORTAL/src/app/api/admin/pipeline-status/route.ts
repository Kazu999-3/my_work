import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 監視対象のジョブタイプ一覧
const PIPELINE_JOBS = [
  { id: 'data-collection', label: 'データ収集', pattern: 'lol_trend%' },
  { id: 'youtube-analysis', label: 'YouTube解析', pattern: 'youtube%' },
  { id: 'dict-synthesis', label: '辞典更新', pattern: 'champion_db%' },
  { id: 'pro-build', label: 'プロビルド', pattern: 'pro_build%' },
];

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
