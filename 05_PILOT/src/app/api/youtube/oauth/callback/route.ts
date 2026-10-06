import { NextRequest, NextResponse } from 'next/server';

// OAuth認可コードをリフレッシュトークンに交換して表示する画面
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'youtube_oauth_state';

export async function GET(req: NextRequest) {
  const stateParam = req.nextUrl.searchParams.get('state');
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return new NextResponse('<pre>state検証に失敗しました。/api/youtube/oauth からやり直してください。</pre>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
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

  const redirectUri = `${req.nextUrl.origin}/api/youtube/oauth/callback`;

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
    if (!tokenRes.ok || !data.refresh_token) {
      return new NextResponse(
        `<pre>リフレッシュトークンの取得に失敗しました:\n${JSON.stringify(data, null, 2)}</pre>`,
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>YouTube OAuth 認可完了</title></head>
<body style="font-family: sans-serif; max-width: 680px; margin: 40px auto; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc;">
  <h2 style="color: #10b981;">✅ 認可に成功しました</h2>
  <p>以下のリフレッシュトークンをコピーし、Vercelまたはローカルの環境変数に設定してください：</p>
  <p><strong>環境変数名:</strong> <code>YOUTUBE_OAUTH_REFRESH_TOKEN</code></p>
  <pre style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; word-break: break-all; color: #38bdf8;">${data.refresh_token}</pre>
  <p><a href="/admin/youtube" style="color: #f59e0b; text-decoration: underline;">動画解析センターへ戻る →</a></p>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'トークン交換エラー' }, { status: 500 });
  }
}
