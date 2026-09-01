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

    const sessionData = {
      discordId: player.discord_id || `local_${player.name}`,
      username: player.name,
      displayName: player.name,
      avatar: player.discord_id
        ? `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(player.discord_id.replace(/\D/g, '') || '0') % BigInt(5))}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`,
      coins: player.coins ?? 1000,
      rank: player.highest_rank || 'UNRANKED',
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

    return response;
  } catch (err: any) {
    console.error('[auth/select] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
