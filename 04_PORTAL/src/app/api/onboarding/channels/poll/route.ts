import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { syncOnboardingChannels } from '../../../../../lib/onboardingChannels';

// 個別案内チャンネルの新着チェック。pg_cron（migration 100）から5分おきに呼ばれ、
// 本人からの新着があれば管理者へ通知する（2026-10-17）。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await verifyAdminSession(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  try {
    const { channels, notified } = await syncOnboardingChannels();
    return NextResponse.json({ success: true, channels: channels.length, notified });
  } catch (err: any) {
    console.error('[onboarding/channels/poll] error:', err);
    return NextResponse.json({ error: '個別案内の新着チェックに失敗しました。' }, { status: 500 });
  }
}
