import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { enqueueEdgeTask } from '../../../../../lib/edgeTask';

const RETRYABLE_TASK_TYPES = new Set([
  'resolve_youtube_channel',
  'resolve_youtube_playlist',
  'youtube_channel_monitor',
  'reddit_scout',
  'lol_trend_collect',
  'dict_synthesizer',
  'champion_trend',
]);

// 失敗しているタスクを一括で再起票する
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { tasks } = await req.json().catch(() => ({ tasks: [] }));

    let targetTasks = tasks;

    // タスク一覧が送られてこなかった場合は、DBから直近のfailedタスクを取得
    if (!targetTasks || targetTasks.length === 0) {
      const { data: failedRows } = await supabase
        .from('edge_tasks')
        .select('*')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(20);
      targetTasks = failedRows || [];
    }

    let retriedCount = 0;
    const errors: string[] = [];

    for (const t of targetTasks) {
      try {
        const type = t.task_type;
        const payload = t.payload || {};
        if (RETRYABLE_TASK_TYPES.has(type)) {
          await enqueueEdgeTask(type, payload);
          retriedCount++;
        }
      } catch (err: any) {
        errors.push(`${t.task_type}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      retriedCount,
      totalCount: targetTasks.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('❌ [Retry All API] Error:', err);
    return NextResponse.json({ error: `一括再実行に失敗しました: ${err.message}` }, { status: 500 });
  }
}
