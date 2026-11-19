import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  PILOT_SESSION_COOKIE,
  decodeAndVerifySession,
  slideSessionCookie,
  verifyToken,
} from './lib/tokenAuth';

// 05_PILOT は個人用コクピットだが本番URLが公開されており、API は service role キーで
// DB を書き換えられる。全ページ・全APIをここで保護する。
//
// 入り方は2通り:
//   1. /login で合言葉を入力 ➔ 署名付きランダムセッションCookie発行
//   2. URL に ?token=合言葉 を付けて開く（ブックマーク用。回数制限のある /api/auth/link へ回す）
export async function proxy(request: NextRequest) {
  const { nextUrl } = request;

  // ?token= の照合は回数制限のある /api/auth/link で行う
  const queryToken = nextUrl.searchParams.get('token');
  if (queryToken !== null) {
    const clean = nextUrl.clone();
    clean.searchParams.delete('token');
    const link = new URL('/api/auth/link', request.url);
    link.searchParams.set('t', queryToken);
    link.searchParams.set('next', `${clean.pathname}${clean.search}`);
    return NextResponse.redirect(link);
  }

  // 静的ツールは認証不要で即座に利用可能
  if (nextUrl.pathname.startsWith('/tools/')) {
    return NextResponse.next();
  }

  // GitHub Actions の定期実行（辞典への統合）だけは Cookie を持てないため Bearer トークンで受け付ける
  if (nextUrl.pathname === '/api/knowledge/integrate') {
    const auth = request.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ') && verifyToken(auth.slice(7))) {
      return NextResponse.next();
    }
  }

  // 署名付きセッションCookieの検証（SPEC 02準拠）
  const sessionCookie = request.cookies.get(PILOT_SESSION_COOKIE)?.value;
  const sessionResult = await decodeAndVerifySession(sessionCookie);

  if (sessionResult.valid && sessionResult.session) {
    const res = NextResponse.next();
    // スライディングセッション更新（有効期限の半分を経過していたら自動延長）
    if (sessionResult.shouldSlide) {
      slideSessionCookie(res, sessionResult.session);
    }
    return res;
  }

  // 未認証時の処理
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
    '/((?!login|tools/|api/auth/|_next/static|_next/image|favicon\\.ico|icon\\.png|icons/|manifest\\.webmanifest|robots\\.txt).*)',
  ],
};
