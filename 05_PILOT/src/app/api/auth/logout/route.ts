import { NextRequest, NextResponse } from 'next/server';
import {
  PILOT_SESSION_COOKIE,
  decodeAndVerifySession,
  revokeSession,
  clearAuthCookie,
} from '@/lib/tokenAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(PILOT_SESSION_COOKIE)?.value;
  const sessionRes = await decodeAndVerifySession(cookie);

  if (sessionRes.session) {
    await revokeSession(sessionRes.session.sessionId);
  }

  const res = NextResponse.json({ success: true, message: 'ログアウトしました' });
  clearAuthCookie(res);
  return res;
}
