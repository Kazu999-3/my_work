import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { enqueueEdgeTask } from '../../../../../lib/edgeTask';

// TaskStatusDrawer.tsx の「要対応・失敗タスク」パネルから、champion_trend以外の
// タスク種別も再実行できるようにする汎用エンドポイント。champion_trendは専用の
// /api/admin/champions/trend が既にあるため対象外、champion_db_bulk_updateは
// ジョブ単位の「更新を再開」ボタンが別途あるため対象外。
//
// dashboard-stats/route.ts は (task_type, payload) の組み合わせごとに最新1件だけを
// 「要対応」として見るため、同じpayloadで新しいpendingタスクを起票すれば、
// それが完了した時点で古い失敗行は自動的にパネルから消える(2026-08-12発覚:
// resolve_youtube_channelの再実行手段がUIに無く、既に解決済みバグの古い失敗記録が
// 永久に「要対応」に残り続けていた)。
const RETRYABLE_TASK_TYPES = new Set([
  'resolve_youtube_channel',
  'resolve_youtube_playlist',
  'youtube_channel_monitor',
  'reddit_scout',
  'lol_trend_collect',
  'dict_synthesizer',
]);

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { task_type, payload } = await req.json();

    if (!task_type || !RETRYABLE_TASK_TYPES.has(task_type)) {
      return NextResponse.json({ error: '再実行できないタスク種別です。' }, { status: 400 });
    }

    const task = await enqueueEdgeTask(task_type, payload || {});

    return NextResponse.json({
      success: true,
      message: '再実行タスクを起票しました。バックグラウンドで処理されます。',
      task,
    });
  } catch (err: any) {
    console.error('❌ [Task Retry API] POST Error:', err);
    return NextResponse.json({ error: `再実行の起票に失敗しました: ${err.message}` }, { status: 500 });
  }
}
