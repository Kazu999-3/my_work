import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('ktm_user_session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ user: null });
    }

    let sessionData: any = null;
    try {
      sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
    } catch {
      return NextResponse.json({ user: null });
    }

    if (!sessionData || !sessionData.discordId) {
      return NextResponse.json({ user: null });
    }

    // 最新のコイン残高とランクをDBから取得
    const { data: players } = await supabase
      .from('ktm_players')
      .select('id, name, ign, coins, highest_rank')
      .eq('discord_id', sessionData.discordId)
      .limit(1);

    const player = players && players.length > 0 ? players[0] : null;

    const user = {
      ...sessionData,
      displayName: player?.name || player?.ign || sessionData.displayName,
      coins: player?.coins ?? sessionData.coins ?? 1000,
      rank: player?.highest_rank || sessionData.rank || 'UNRANKED',
    };

    return NextResponse.json({ user });
  } catch (err: any) {
    console.error('[auth/me] Error:', err);
    return NextResponse.json({ user: null, error: err.message }, { status: 500 });
  }
}
