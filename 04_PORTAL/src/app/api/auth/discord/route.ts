import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const returnTo = reqUrl.searchParams.get('returnTo') || '/casino';

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1487839977487470813';
  
  // 現在アクセス中のオリジン（localhostまたは本番ドメイン）から正確にコールバックURIを決定
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || reqUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64');

  const discordAuthUrl = new URL('https://discord.com/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', clientId);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('scope', 'identify');
  discordAuthUrl.searchParams.set('state', state);

  return NextResponse.redirect(discordAuthUrl.toString());
}
