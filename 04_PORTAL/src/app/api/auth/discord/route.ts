import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { encodeOAuthState, safeReturnTo, OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_SEC } from '../../../../lib/oauthState';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const returnTo = safeReturnTo(reqUrl.searchParams.get('returnTo'));
  // 使い捨ての合言葉。state に入れて Discord に渡し、同じ値を Cookie にも置いて、戻ってきた時に照合する（ログイン CSRF 対策）
  const nonce = randomUUID();

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1487839977487470813';
  
  // 現在アクセス中のオリジン（localhostまたは本番ドメイン）から正確にコールバックURIを決定
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || reqUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  const state = encodeOAuthState(returnTo, nonce);

  const discordAuthUrl = new URL('https://discord.com/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', clientId);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('scope', 'identify');
  discordAuthUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(discordAuthUrl.toString());
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    path: '/api/auth/discord',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Discord から戻ってくる時はトップレベルの GET なので lax で送られる
    sameSite: 'lax',
    maxAge: OAUTH_STATE_MAX_AGE_SEC,
  });
  return response;
}
