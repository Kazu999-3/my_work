import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { markOnboardingChannelRead, dismissOnboardingChannelReply, channelUrl } from '../../../../../lib/onboardingChannels';

// 個別案内の既読記録（管理画面の「開く」から。2026-10-17）
export const dynamic = 'force-dynamic';

// アプリ通知のタップ先。既読にしてから Discord のチャンネルへ移る。
// 管理者としてログインしていない端末では既読にせず、そのまま Discord へ移す。
export async function GET(req: Request) {
  const channelId = new URL(req.url).searchParams.get('channelId') || '';
  if (!/^\d{5,25}$/.test(channelId)) return NextResponse.json({ error: 'channelId が不正です。' }, { status: 400 });
  const auth = await verifyAdminSession(req);
  if (auth.ok) await markOnboardingChannelRead(channelId).catch((e) => console.warn('[onboarding read] 既読の記録に失敗:', e));
  return NextResponse.redirect(channelUrl(channelId), 302);
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const channelId = typeof body?.channelId === 'string' ? body.channelId : '';
  if (!/^\d{5,25}$/.test(channelId)) return NextResponse.json({ error: 'channelId が不正です。' }, { status: 400 });
  try {
    // dismiss: true なら「返信不要」（既読にもなる）
    if (body?.dismiss === true) await dismissOnboardingChannelReply(channelId);
    else await markOnboardingChannelRead(channelId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/onboarding-channels/read] error:', err);
    return NextResponse.json({ error: '既読の記録に失敗しました。' }, { status: 500 });
  }
}
