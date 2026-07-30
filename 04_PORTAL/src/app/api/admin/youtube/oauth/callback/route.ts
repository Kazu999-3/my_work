import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../../lib/adminAuth';

// OAuth認可コードをリフレッシュトークンに交換し、その場で表示するだけの画面。
// 表示されたリフレッシュトークンはVercelの環境変数(YOUTUBE_OAUTH_REFRESH_TOKEN)へ
// 手動でコピーする運用。ここに保存はしない（一度きりの確認用）。
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get('code');
  const errorParam = req.nextUrl.searchParams.get('error');
  if (errorParam) {
    return new NextResponse(`<pre>Google側で認可が拒否されました: ${errorParam}</pre>`, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (!code) {
    return NextResponse.json({ error: 'codeパラメータがありません。' }, { status: 400 });
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRETが未設定です。' }, { status: 500 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/admin/youtube/oauth/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      return new NextResponse(`<pre>トークン交換に失敗しました: ${JSON.stringify(data, null, 2)}</pre>`, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (!data.refresh_token) {
      return new NextResponse(
        `<pre>refresh_tokenが返ってきませんでした（既に一度認可済みの可能性があります）。
Googleアカウントの「サードパーティ製アプリとサービスへのアクセス権」からこのアプリのアクセスを一度取り消してから、もう一度 /api/admin/youtube/oauth を開き直してください。

レスポンス: ${JSON.stringify(data, null, 2)}</pre>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return new NextResponse(
      `<pre>認可に成功しました。以下の値をVercelの環境変数 YOUTUBE_OAUTH_REFRESH_TOKEN に設定してください。

${data.refresh_token}

このトークンは今この画面にしか表示されません。設定後、この画面は閉じて構いません。</pre>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
