import { NextResponse } from 'next/server';
import { sendPushToAll } from '../send/route';
import { verifyBotSecret } from '../../../../lib/botAuth';

// 新規募集が立った時のWeb Push通知(#54)。BOTから呼ばれる。
// 本文は固定テンプレート＋短い埋め込みのみ（任意文言は受け付けない＝乱用対策）。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
  // ===== Bot共有シークレット確認 (未設定の間はfail-open) =====
  const authResult = verifyBotSecret(req);
  if (!authResult.ok) {
    return NextResponse.json({ success: false, message: authResult.error }, { status: 401 });
  }
  // =================================
    const { mode, time } = await req.json().catch(() => ({}));
    const safeMode = ['ノーマル', 'カスタム', 'ARAM'].includes(mode) ? mode : 'カスタム';
    const safeTime = typeof time === 'string' ? time.slice(0, 20) : '';
    // ユーザー要望によりカスタム募集通知は停止中
    return NextResponse.json({ success: true, message: 'カスタム募集通知は無効化されています（スキップ）' });
  } catch (e: any) {
    // VAPID未設定などでも呼び出し元(BOT)の本処理は止めない
    console.warn('[push/notify-recruit] skipped:', e.message);
    return NextResponse.json({ success: false, message: e.message });
  }
}
