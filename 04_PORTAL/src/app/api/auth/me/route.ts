import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findOrCreatePlayer, getPlayerCoins } from '../../../../lib/playerCoins';
import { decodeUserSession, isAdminDiscordId, USER_SESSION_COOKIE } from '../../../../lib/userSession';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    // 署名検証に失敗した(旧形式の無署名Cookieを含む)場合は未ログイン扱い
    const sessionData = decodeUserSession(cookieStore.get(USER_SESSION_COOKIE)?.value);
    if (!sessionData) {
      return NextResponse.json({ user: null });
    }

    // 最新のコイン残高、ランク、管理者権限を安全に取得
    const player = await findOrCreatePlayer({
      discordId: sessionData.discordId,
      name: sessionData.displayName || sessionData.username,
      autoCreate: true,
    });

    const isAdmin = isAdminDiscordId(sessionData.discordId);

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
