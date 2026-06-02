import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Basic認証の設定 (ID: admin, PW: sovereign)
  const user = 'admin';
  const pwd = 'sovereign';

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [strUser, strPwd] = atob(authValue).split(':');

    if (strUser === user && strPwd === pwd) {
      return NextResponse.next();
    }
  }

  // 認証失敗時は401を返し、ブラウザの認証ダイアログを表示させる
  url.pathname = '/api/auth';
  return new NextResponse('Auth Required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  // すべてのページに認証をかける（APIルートや静的アセットを除く場合があるが今回は全域保護）
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
