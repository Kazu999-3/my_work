import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo') || '/casino';

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1485995531434987541';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://my-work-8jbd.vercel.app';
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
