import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // 環境変数からパスワードを取得。設定されていない場合はデフォルトで 'ktm' とする（安全のため本番では必ず設定する）
  const adminPassword = process.env.ADMIN_PASSWORD || 'ktm';

  // ktm-admin 配下、または /api/admin 配下のアクセスかどうか
  const url = req.nextUrl;
  if (url.pathname.startsWith('/ktm-admin') || url.pathname.startsWith('/api/admin')) {
    
    // Authorization ヘッダーの確認
    const basicAuth = req.headers.get('authorization');
    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      // base64デコード (username:password)
      const [user, pwd] = atob(authValue).split(':');

      // ユーザー名は任意(例えば 'admin')とし、パスワードが一致するか確認
      if (pwd === adminPassword) {
        return NextResponse.next();
      }
    }

    // 認証失敗時、またはAuthorizationヘッダーがない場合は401を返しブラウザのダイアログを出す
    url.pathname = '/api/auth'; // Next.jsで401を直接返すためのダミーではなく、Responseを直接返す
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
  matcher: [
    '/ktm-admin/:path*',
    '/api/admin/:path*'
  ],
};
