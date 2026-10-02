import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PILOT_COOKIE_NAME, verifyToken, setAuthCookie } from './lib/tokenAuth';

// 05_PILOT は個人用コクピットだが本番URLが公開されており、API は service role キーで
// DB を書き換えられる。2026-10-02 まで認証が一切無かったため、全ページ・全APIをここで保護する。
//
// 入り方は2通り:
//   1. /login で合言葉を入力
//   2. URL に ?token=合言葉 を付けて開く（ブックマーク用。Cookie を発行して token を消した URL へ戻す）
export function proxy(request: NextRequest) {
  const { nextUrl } = request;

  const queryToken = nextUrl.searchParams.get('token');
  if (queryToken !== null) {
    const clean = nextUrl.clone();
    clean.searchParams.delete('token');
    if (verifyToken(queryToken)) {
      const res = NextResponse.redirect(clean);
      setAuthCookie(res, queryToken);
      return res;
    }
  }

  if (verifyToken(request.cookies.get(PILOT_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  if (nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '認証が必要です。/login から合言葉を入力してください。' }, { status: 401 });
  }

  const login = new URL('/login', request.url);
  const next = nextUrl.clone();
  next.searchParams.delete('token');
  login.searchParams.set('next', `${next.pathname}${next.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // ログイン画面とその API、静的ファイル・PWA のアイコン/マニフェストは除外する
  matcher: [
    '/((?!login|api/auth/|_next/static|_next/image|favicon\\.ico|icon\\.png|icons/|manifest\\.webmanifest|robots\\.txt).*)',
  ],
};
