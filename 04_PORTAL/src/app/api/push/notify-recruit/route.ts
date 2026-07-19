import { NextResponse } from 'next/server';
import { sendPushToAll } from '../send/route';

// 新規募集が立った時のWeb Push通知(#54)。BOTから呼ばれる。
// 本文は固定テンプレート＋短い埋め込みのみ（任意文言は受け付けない＝乱用対策）。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { mode, time } = await req.json().catch(() => ({}));
    const safeMode = ['ノーマル', 'カスタム', 'ARAM'].includes(mode) ? mode : 'カスタム';
    const safeTime = typeof time === 'string' ? time.slice(0, 20) : '';
    const result = await sendPushToAll({
      title: '⚔️ 新しい募集が始まりました！',
      body: `${safeMode}${safeTime ? `（${safeTime}開始予定）` : ''} 参加はDiscordの募集板から！`,
      url: '/',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    // VAPID未設定などでも呼び出し元(BOT)の本処理は止めない
    console.warn('[push/notify-recruit] skipped:', e.message);
    return NextResponse.json({ success: false, message: e.message });
  }
}
