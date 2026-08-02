import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds, fetchMatchDetails } from '../../../../lib/riot';

export async function POST(request: Request) {
  try {
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
      // ランク限定で見つからない場合は全キューから取得
      matchIds = await fetchRecentMatchIds(puuid, apiKey, 5);
    }

    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json(
        { error: '直近の試合データが見つかりませんでした。' },
        { status: 404 }
      );
    }

    const latestMatchId = matchIds[0];
    const matchDetails = await fetchMatchDetails(latestMatchId, apiKey);

    const me = matchDetails.participants.find((p) => p.puuid === puuid);
    if (!me) {
      return NextResponse.json(
        { error: '試合詳細からプレイヤー情報が見つかりませんでした。' },
        { status: 404 }
      );
    }

    // 対面（別チームかつ同レーン、もしくは別チームの同役割）を探す
    let enemy = matchDetails.participants.find(
      (p) => p.teamId !== me.teamId && p.lane === me.lane && me.lane !== 'NONE' && me.lane !== ''
    );

    // 見つからない場合は敵チームで1番ダメージが多い/特定の参加者を候補とする
    if (!enemy) {
      const enemyTeam = matchDetails.participants.filter((p) => p.teamId !== me.teamId);
      if (enemyTeam.length > 0) {
        enemy = enemyTeam[0];
      }
    }

    const cs = (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0);
    const kdaStr = `${me.kills}/${me.deaths}/${me.assists}`;

    return NextResponse.json({
      matchId: latestMatchId,
      champion: me.championName,
      enemyChampion: enemy ? enemy.championName : 'Unknown',
      win: me.win,
      kda: kdaStr,
      cs: cs,
      gameDuration: matchDetails.gameDuration,
      lane: me.lane
    });
  } catch (error: any) {
    console.error('Latest SoloQ fetch error:', error);
    return NextResponse.json(
      { error: error.message || '直近のソロQ試合取得に失敗しました。' },
      { status: 500 }
    );
  }
}
