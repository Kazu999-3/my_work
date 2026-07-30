import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// YouTube動画をプレイリストへ追加する機能のための、一度だけ使うOAuth認可の入口。
// Googleの同意画面へリダイレクトし、コールバック側でリフレッシュトークンを取得する。
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'YOUTUBE_OAUTH_CLIENT_IDが未設定です。' }, { status: 500 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/admin/youtube/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // 既存の認可を上書きしてでも必ずrefresh_tokenを受け取るための組み合わせ
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/youtube',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
