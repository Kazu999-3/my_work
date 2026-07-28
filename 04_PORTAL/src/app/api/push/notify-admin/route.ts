import { NextRequest, NextResponse } from 'next/server';
import { verifyBotSecret } from '../../../../lib/botAuth';
import { createAdminNotification } from '../../../../lib/notify';

// ローカルのPython自動化(herald.py)から呼ばれるエンドポイント。
// 辞典更新・YouTube解析完了など、これまでDiscordのみに届いていた通知を
// ポータルの通知履歴＋プッシュ通知にも流す。認証はktm_bot(Cloudflare Workers)と
// 同じ x-bot-secret / PORTAL_BOT_SECRET を流用する(未設定の間はfail-open)。
export async function POST(req: NextRequest) {
  const authResult = verifyBotSecret(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { type, title, body, url, icon, data } = await req.json();
    if (!type || !title) {
      return NextResponse.json({ error: 'type と title は必須です。' }, { status: 400 });
    }
    const row = await createAdminNotification({ type, title, body, url, icon, data });
    return NextResponse.json({ success: true, notification: row });
  } catch (err: any) {
    console.error('[push/notify-admin] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
