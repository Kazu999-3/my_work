import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  let returnTo = '/casino';
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      if (parsed.returnTo) returnTo = parsed.returnTo;
    } catch {}
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://my-work-8jbd.vercel.app';
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=no_code`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1487839977487470813';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientSecret) {
    console.warn('[discord-callback] DISCORD_CLIENT_SECRET is not set.');
    // シークレット未設定時は、モック/開発用フォールバック
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=no_secret`);
  }

  try {
    // 1. トークン交換
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[discord-callback] Token exchange failed:', tokenData);
      return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=token_failed`);
    }

    // 2. ユーザー情報取得 (@me)
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();
    if (!userRes.ok || !discordUser.id) {
      return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=user_failed`);
    }

    // 3. Supabase名簿 (ktm_players) と照合
    const { data: players } = await supabase
      .from('ktm_players')
      .select('id, name, ign, coins, highest_rank')
      .eq('discord_id', discordUser.id)
      .limit(1);

    const player = players && players.length > 0 ? players[0] : null;
    const displayName = player?.name || player?.ign || discordUser.global_name || discordUser.username;

    // 4. セッションオブジェクト作成
    const sessionData = {
      discordId: discordUser.id,
      username: discordUser.username,
      displayName: displayName,
      avatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordUser.id) % BigInt(5))}.png`,
      coins: player?.coins ?? 1000,
      rank: player?.highest_rank || 'UNRANKED',
      loggedInAt: Date.now(),
    };

    const sessionCookieVal = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    const response = NextResponse.redirect(`${baseUrl}${returnTo}`);
    response.cookies.set('ktm_user_session', sessionCookieVal, {
      path: '/',
      httpOnly: false, // クライアントJSでも読み取れるように
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30日間
    });

    return response;
  } catch (err: any) {
    console.error('[discord-callback] Error:', err);
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=${encodeURIComponent(err.message)}`);
  }
}
