import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { name, discordId } = await req.json();

    if (!name && !discordId) {
      return NextResponse.json({ error: 'ユーザー名またはDiscord IDが必要です。' }, { status: 400 });
    }

    let q = supabase.from('ktm_players').select('*');
    if (discordId) q = q.eq('discord_id', discordId);
    else if (name) q = q.eq('name', name);

    const { data: player, error } = await q.single();
    if (error || !player) {
      return NextResponse.json({ error: '名簿に登録されていません。' }, { status: 404 });
    }

    const { getPlayerCoins } = await import('../../../../lib/playerCoins');
    const userCoins = getPlayerCoins(player);

    const adminIds = (process.env.ADMIN_DISCORD_IDS || '697220229964759130')
      .split(',')
      .map((s) => s.trim());
    const isAdmin = adminIds.includes(player.discord_id) || player.discord_id === '697220229964759130' || player.name === 'kazuki' || player.name?.includes('かずき');

    const sessionData = {
      discordId: player.discord_id || `local_${player.name}`,
      username: player.name,
      displayName: player.name,
      avatar: player.discord_id
        ? `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(player.discord_id.replace(/\D/g, '') || '0') % BigInt(5))}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`,
      coins: userCoins,
      rank: player.highest_rank || 'UNRANKED',
      isAdmin: isAdmin,
      loggedInAt: Date.now(),
    };

    const sessionCookieVal = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    const response = NextResponse.json({ success: true, user: sessionData });
    response.cookies.set('ktm_user_session', sessionCookieVal, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30日間有効
    });

    if (isAdmin) {
      try {
        const { createSessionToken, ADMIN_SESSION_COOKIE } = await import('../../../../lib/adminSession');
        const { token, maxAgeSec } = createSessionToken();
        response.cookies.set(ADMIN_SESSION_COOKIE, token, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: maxAgeSec,
        });
      } catch (e) {
        console.error('Failed to issue admin_session cookie in auth/select:', e);
      }
    }

    return response;
  } catch (err: any) {
    console.error('[auth/select] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
