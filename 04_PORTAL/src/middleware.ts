import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // 環境変数からパスワードを取得。設定されていない場合はデフォルトで 'ktm' とする（安全のため本番では必ず設定する）
  const adminPassword = process.env.ADMIN_PASSWORD || 'ktm';

  const url = req.nextUrl;
  const path = url.pathname;

  // パスワード保護の対象となるパス（一般公開しないパス）
  const isProtected = 
    path === '/' ||
    path.startsWith('/ktm-admin') ||
    path.startsWith('/matchups') ||
    path.startsWith('/champions') ||
    path.startsWith('/library') ||
    path.startsWith('/design') ||
    path.startsWith('/admin') ||
    path.startsWith('/api/admin');

  if (isProtected) {
    // Authorization ヘッダーの確認
    const basicAuth = req.headers.get('authorization');
    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      // base64デコード (username:password)
      const [user, pwd] = atob(authValue).split(':');

      // パスワードが一致するか確認
      if (pwd === adminPassword) {
        return NextResponse.next();
      }
    }

    // 認証失敗時、またはAuthorizationヘッダーがない場合は401を返しブラウザのダイアログを出す
    return new NextResponse('Auth Required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="KTM Admin Area"',
      },
    });
  }

  return NextResponse.next();
}

// 適用するルートの定義
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
