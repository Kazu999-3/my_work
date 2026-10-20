import { NextResponse } from 'next/server';
import { verifyBotSecretStrict } from '../../../../lib/botAuth';
import { sendToMemberChannel } from '../../../../lib/onboardingChannels';

// Bot から頼まれて、本人の個別案内チャンネルへメンション付きで1件送る（2026-10-20）。
// Bot は DM で送っていた案内（参加ボタンを押した初参加者への「レーン設定のお願い」など）を、
// ユーザー判断で個別案内チャンネルへ切り替えた。チャンネルの見つけ方はポータル側にしか無いためここを通す。
// 任意のメンバーへ投稿できるため、合言葉が未設定なら必ず拒否する厳しい方の認証を使う。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = verifyBotSecretStrict(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const discordId = String(body.discordId || '');
  if (!/^\d{5,25}$/.test(discordId)) return NextResponse.json({ error: 'discordId が不正です' }, { status: 400 });
  const content = typeof body.content === 'string' ? body.content.slice(0, 1800) : undefined;
  const embeds = Array.isArray(body.embeds) ? body.embeds.slice(0, 3) : undefined;
  if (!content && !embeds) return NextResponse.json({ error: '送る中身がありません' }, { status: 400 });

  const sent = await sendToMemberChannel(discordId, { content, embeds });
  return NextResponse.json({ ok: true, sent });
}
