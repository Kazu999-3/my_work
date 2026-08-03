import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds, fetchMatchDetails } from '../../../../lib/riot';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ign = body.ign || process.env.DEFAULT_RIOT_IGN || "";

    if (!ign || !ign.includes('#')) {
      return NextResponse.json(
        { error: 'Riot ID (例: 名前#JP1) を入力してください。' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'サーバーに RIOT_API_KEY が設定されていません。' },
        { status: 500 }
      );
    }

    const [gameName, tagLine] = ign.split('#');
    const puuid = await fetchPuuidByRiotId(gameName.trim(), tagLine.trim(), apiKey);

    // ランクソロ(420)または直近マッチ
    let matchIds = await fetchRecentMatchIds(puuid, apiKey, 5, 420);
    if (!matchIds || matchIds.length === 0) {
      matchIds = await fetchRecentMatchIds(puuid, apiKey, 5);
    }

    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json(
        { error: '直近のソロQ試合データが見つかりませんでした。' },
        { status: 404 }
      );
    }

    // 直近最大5件のマッチ詳細をを取得
    const matchPromises = matchIds.map(async (mId) => {
      try {
        const details = await fetchMatchDetails(mId, apiKey);
        const me = details.participants.find((p) => p.puuid === puuid);
        if (!me) return null;

        let enemy = details.participants.find(
          (p) => p.teamId !== me.teamId && p.lane === me.lane && me.lane !== 'NONE' && me.lane !== ''
        );
        if (!enemy) {
          const enemyTeam = details.participants.filter((p) => p.teamId !== me.teamId);
          if (enemyTeam.length > 0) enemy = enemyTeam[0];
        }

        const cs = (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0);
        const kdaStr = `${me.kills}/${me.deaths}/${me.assists}`;

        return {
          matchId: mId,
          champion: me.championName,
          enemyChampion: enemy ? enemy.championName : 'Unknown',
          win: me.win,
          kda: kdaStr,
          cs,
          gameDuration: details.gameDuration,
          lane: me.lane,
        };
      } catch (err) {
        console.error(`Match fetch error for ${mId}:`, err);
        return null;
      }
    });

    const results = await Promise.all(matchPromises);
    const validMatches = results.filter((m) => m !== null);

    if (validMatches.length === 0) {
      return NextResponse.json(
        { error: '試合データの取得・パースに失敗しました。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ matches: validMatches });
  } catch (error: any) {
    console.error('Recent SoloQ matches fetch error:', error);
    return NextResponse.json(
      { error: error.message || '直近のソロQ試合一覧取得に失敗しました。' },
      { status: 500 }
    );
  }
}
