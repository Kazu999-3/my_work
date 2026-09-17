import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findOrCreatePlayer, getPlayerCoins } from '../../../../lib/playerCoins';

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

    // 最新のコイン残高、ランク、管理者権限を安全に取得
    const player = await findOrCreatePlayer({
      discordId: sessionData.discordId,
      name: sessionData.displayName || sessionData.username,
      autoCreate: true,
    });

    const adminIds = (process.env.ADMIN_DISCORD_IDS || '697220229964759130')
      .split(',')
      .map((s) => s.trim());
    const isAdmin = adminIds.includes(sessionData.discordId) || sessionData.discordId === '697220229964759130' || sessionData.username === 'kazuki' || player?.name?.includes('かずき');

    // 日本時間基準で今日のデイリーボーナス受取状況を判定
    const todayStr = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '-');
    const claimedDaily = player?.role_preferences?.lastDailyClaim === todayStr;

    const user = {
      ...sessionData,
      displayName: player?.name || player?.ign || sessionData.displayName,
      playerName: player?.name || sessionData.displayName || sessionData.username,
      coins: player ? getPlayerCoins(player) : (sessionData.coins ?? 1000),
      rank: player?.highest_rank || sessionData.rank || 'UNRANKED',
      isAdmin,
      claimedDaily,
    };

    return NextResponse.json({ user });
  } catch (err: any) {
    console.error('[auth/me] Error:', err);
    return NextResponse.json({ user: null, error: err.message }, { status: 500 });
  }
}
