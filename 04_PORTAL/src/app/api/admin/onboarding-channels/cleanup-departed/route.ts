import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { deleteDepartedMemberChannels, listOnboardingChannels } from '../../../../../lib/onboardingProcessor';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    let channelIds: string[] = Array.isArray(body?.channelIds) ? body.channelIds : [];

    // 指定がなければ全個別案内チャンネルを検査対象にする
    if (channelIds.length === 0) {
      const allChannels = await listOnboardingChannels();
      channelIds = allChannels.map((c) => c.channelId);
    }

    if (channelIds.length === 0) {
      return NextResponse.json({ success: true, deleted: [], skipped: 0, message: '対象チャンネルがありませんでした。' });
    }

    const result = await deleteDepartedMemberChannels(channelIds);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[admin/onboarding-channels/cleanup-departed] error:', err);
    return NextResponse.json({ error: err.message || '退出者チャンネルの削除に失敗しました。' }, { status: 500 });
  }
}
