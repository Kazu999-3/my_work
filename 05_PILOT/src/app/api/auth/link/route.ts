import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, setAuthCookie } from '@/lib/tokenAuth';
import { clientIp, isLoginBlocked, recordLoginFailure } from '@/lib/loginRateLimit';

export const dynamic = 'force-dynamic';

// URL に ?token=合言葉 を付けて開く入り方（ブックマーク用）の受け口。proxy.ts がここへ回す。
// 2026-10-19: 以前は proxy.ts の中で照合しており、回数の制限なしで何度でも試せた。
// /login と同じ回数制限を通す。
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

  if (await isLoginBlocked(ip)) return toLogin();
  if (!verifyToken(token)) {
    await recordLoginFailure(ip);
    return toLogin();
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  setAuthCookie(res, token);
  return res;
}
