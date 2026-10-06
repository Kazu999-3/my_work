import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// YouTube動画をプレイリストへ追加するためのOAuth認可の入口
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'youtube_oauth_state';

export async function GET(req: NextRequest) {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'YOUTUBE_OAUTH_CLIENT_IDが未設定です。' }, { status: 500 });
  }

  const state = randomBytes(16).toString('hex');
  const redirectUri = `${req.nextUrl.origin}/api/youtube/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/youtube',
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/youtube/oauth',
    maxAge: 10 * 60,
  });
  return res;
}
