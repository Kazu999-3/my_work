import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, setAuthCookie } from '@/lib/tokenAuth';
import { clientIp, isLoginBlocked, recordLoginFailure } from '@/lib/loginRateLimit';

export const dynamic = 'force-dynamic';

// URL に ?token=合言葉 を付けて開く入り方（ブックマーク用）の受け口。proxy.ts がここへ回す。
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') || '';
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const ip = clientIp(req.headers);

  const toLogin = () => {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  };

  const rateLimit = await isLoginBlocked(ip);
  if (rateLimit.blocked || rateLimit.unavailable) return toLogin();

  if (!verifyToken(token)) {
    await recordLoginFailure(ip);
    return toLogin();
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  setAuthCookie(res);
  return res;
}
