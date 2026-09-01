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

  const reqUrl = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || reqUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;
  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=no_code`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '1487839977487470813';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '7b9BIMgFZtampwPWo1Z0QeyxxnpwcDJr';

  if (!clientSecret) {
    console.warn('[discord-callback] DISCORD_CLIENT_SECRET is not set.');
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

    // 3. Supabase名簿 (ktm_players) と照合 (discord_id または 名前)
    let player: any = null;
    const { data: byId } = await supabase
      .from('ktm_players')
      .select('id, name, ign, coins, highest_rank, mmr, discord_id')
      .eq('discord_id', discordUser.id)
      .limit(1);

    if (byId && byId.length > 0) {
      player = byId[0];
    } else {
      // discord_id未紐付けの場合、表示名またはユーザー名で照合
      const targetNames = [
        discordUser.global_name,
        discordUser.username,
        'かずき',
      ].filter(Boolean);

      for (const tName of targetNames) {
        const { data: byName } = await supabase
          .from('ktm_players')
          .select('id, name, ign, coins, highest_rank, mmr, discord_id')
          .ilike('name', `%${tName}%`)
          .limit(1);

        if (byName && byName.length > 0) {
          player = byName[0];
          // 自動で discord_id を紐付け更新
          await supabase
            .from('ktm_players')
            .update({ discord_id: discordUser.id })
            .eq('id', player.id);
          break;
        }
      }
    }

    const displayName = player?.name || player?.ign || discordUser.global_name || discordUser.username;
    const rank = player?.highest_rank && player.highest_rank !== 'UNRANKED' 
      ? player.highest_rank 
      : (player?.mmr ? (player.mmr >= 2000 ? 'DIAMOND' : player.mmr >= 1700 ? 'EMERALD' : player.mmr >= 1500 ? 'PLATINUM' : player.mmr >= 1300 ? 'GOLD' : 'SILVER') : 'GOLD');

    const isAdmin = discordUser.id === '697220229964759130' || discordUser.username === 'kazuki' || displayName?.includes('かずき');

    // 4. セッションオブジェクト作成
    const sessionData = {
      discordId: discordUser.id,
      username: discordUser.username,
      displayName: displayName,
      avatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordUser.id) % BigInt(5))}.png`,
      coins: player?.coins ?? 1000,
      rank: rank,
      isAdmin: isAdmin,
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

    // 管理者の場合は管理者セッションCookie(admin_session)も発行してセット
    if (isAdmin) {
      try {
        const { createSessionToken, ADMIN_SESSION_COOKIE } = await import('../../../../../lib/adminSession');
        const { token, maxAgeSec } = createSessionToken();
        response.cookies.set(ADMIN_SESSION_COOKIE, token, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: maxAgeSec,
        });
      } catch (e) {
        console.error('Failed to issue admin_session cookie:', e);
      }
    }

    return response;
  } catch (err: any) {
    console.error('[discord-callback] Error:', err);
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=${encodeURIComponent(err.message)}`);
  }
}
