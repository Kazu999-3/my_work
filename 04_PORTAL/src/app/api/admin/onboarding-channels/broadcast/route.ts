import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { broadcastToOnboardingChannels } from '../../../../../lib/onboardingChannels';

// 個別案内チャンネルへの一斉連絡（管理画面から。2026-10-17）
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 70件 × 0.3秒 + 応答待ち

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const channelIds: string[] = Array.isArray(body?.channelIds) ? body.channelIds.filter((v: any) => typeof v === 'string') : [];
  const mention = body?.mention === true;

  if (!content) return NextResponse.json({ error: '本文が空です。' }, { status: 400 });
  // メンション行を足しても Discord の上限（2000文字）に収まるように
  if (content.length > 1900) return NextResponse.json({ error: '本文は1900文字以内にしてください。' }, { status: 400 });
  if (channelIds.length === 0) return NextResponse.json({ error: '送り先が選ばれていません。' }, { status: 400 });
  if (channelIds.length > 200) return NextResponse.json({ error: '送り先が多すぎます。' }, { status: 400 });

  try {
    const result = await broadcastToOnboardingChannels(channelIds, content, mention);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[admin/onboarding-channels/broadcast] error:', err);
    return NextResponse.json({ error: '一斉連絡の送信に失敗しました。' }, { status: 500 });
  }
}
