import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { syncOnboardingChannels, renameOnboardingChannels } from '../../../../../lib/onboardingChannels';

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
    // チャンネル名を今の表示名へ付け直すのは1時間に1回（毎正時から5分以内の回だけ）
    let renamed: number | null = null;
    if (new Date().getUTCMinutes() < 5) {
      renamed = (await renameOnboardingChannels().catch((e) => {
        console.warn('[onboarding/channels/poll] チャンネル名の付け直しに失敗:', e);
        return { renamed: 0 };
      })).renamed;
    }
    return NextResponse.json({ success: true, channels: channels.length, notified, renamed });
  } catch (err: any) {
    console.error('[onboarding/channels/poll] error:', err);
    return NextResponse.json({ error: '個別案内の新着チェックに失敗しました。' }, { status: 500 });
  }
}
