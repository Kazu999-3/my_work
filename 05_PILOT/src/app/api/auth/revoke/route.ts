import { NextRequest, NextResponse } from 'next/server';
import {
  PILOT_SESSION_COOKIE,
  decodeAndVerifySession,
  revokeSession,
  clearAuthCookie,
} from '@/lib/tokenAuth';

export const dynamic = 'force-dynamic';

/**
 * サーバー側セッション失効API (SPEC 02 準拠)
 * 指定された sessionId、または現在のリクエストのセッションをサーバー側で恒久的に失効（ブラックリスト登録）する。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let targetSessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : null;

  // 指定がない場合は現在のCookieからセッションIDを特定
  if (!targetSessionId) {
    const cookie = req.cookies.get(PILOT_SESSION_COOKIE)?.value;
    const sessionRes = await decodeAndVerifySession(cookie);
    if (sessionRes.session) {
      targetSessionId = sessionRes.session.sessionId;
    }
  }

  if (!targetSessionId) {
    return NextResponse.json({ error: '失効対象の sessionId が見つかりません。' }, { status: 400 });
  }

  await revokeSession(targetSessionId);

  const res = NextResponse.json({ success: true, revokedSessionId: targetSessionId });
  // 現在のCookieと一致する場合はCookieも削除
  const currentCookie = req.cookies.get(PILOT_SESSION_COOKIE)?.value;
  if (currentCookie?.startsWith(targetSessionId)) {
    clearAuthCookie(res);
  }

  return res;
}
