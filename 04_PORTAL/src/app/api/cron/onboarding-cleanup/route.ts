import { NextResponse } from 'next/server';
import { autoSweepOnboardingChannels } from '../../../../lib/onboardingProcessor';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * 【Discord自浄化】個別案内チャンネル定期スイーパー (GET/POST /api/cron/onboarding-cleanup)
 * 1. 退出者チャンネルの即時自動削除
 * 2. 案内完了から48時間以上経過した放置チャンネルの自動削除
 */
async function handleCleanup(req: Request) {
  // 認証: CRON_SECRET、または 管理者セッション
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isCronAuth) {
    const adminAuth = await verifyAdminSession(req);
    if (!adminAuth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await autoSweepOnboardingChannels(15);
    return NextResponse.json({
      success: true,
      departedDeletedCount: result.departedDeleted.length,
      completedDeletedCount: result.completedDeleted.length,
      skippedCount: result.skipped,
      departedChannels: result.departedDeleted.map((c) => ({ id: c.channelId, name: c.name })),
      completedChannels: result.completedDeleted.map((c) => ({ id: c.channelId, name: c.name })),
      message: `クリーンアップ完了: 退出者 ${result.departedDeleted.length}件、完了済48時間経過 ${result.completedDeleted.length}件 を自動削除しました。`,
    });
  } catch (err: any) {
    console.error('[cron/onboarding-cleanup] error:', err);
    return NextResponse.json({ error: err.message || 'クリーンアップに失敗しました。' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleCleanup(req);
}

export async function POST(req: Request) {
  return handleCleanup(req);
}
