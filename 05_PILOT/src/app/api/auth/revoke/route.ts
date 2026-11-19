import { NextRequest, NextResponse } from 'next/server';
import {
  PILOT_SESSION_COOKIE,
  decodeAndVerifySession,
  revokeSession,
  clearAuthCookie,
} from '@/lib/tokenAuth';

export const dynamic = 'force-dynamic';

/**
 * サーバー側セッション失効API (SPEC 02 & SPEC 03 準拠)
 * 呼び出し元の Cookie にある自分自身のセッションのみ失効可能。
 * 他人の sessionId をボディで指定した場合は 403 拒否。
 * DB 永続化失敗時は 500 エラーを返す。
 */
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(PILOT_SESSION_COOKIE)?.value;
  const sessionRes = await decodeAndVerifySession(cookie);
  if (!sessionRes.valid || !sessionRes.session) {
    return NextResponse.json(
      { error: '認証されていないか、セッションが無効です。' },
      { status: 401 }
    );
  }

  const currentSessionId = sessionRes.session.sessionId;

  // ボディで sessionId が指定された場合、自セッションと一致しているか検証（他人のセッション失効を防止）
  const body = await req.json().catch(() => ({}));
  if (typeof body?.sessionId === 'string' && body.sessionId.trim()) {
    const requestedSessionId = body.sessionId.trim();
    if (requestedSessionId !== currentSessionId) {
      return NextResponse.json(
        { error: '他のセッションを失効する権限がありません。自分自身のセッションのみ失効可能です。' },
        { status: 403 }
      );
    }
  }

  const revoked = await revokeSession(currentSessionId);
  if (!revoked) {
    console.error(`[auth/revoke] ⚠️ セッション ${currentSessionId} の永続化に失敗しました`);
    return NextResponse.json(
      { error: 'セッションの失効処理（DB永続化）に失敗しました。' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ success: true, revokedSessionId: currentSessionId });
  clearAuthCookie(res);
  return res;
}
