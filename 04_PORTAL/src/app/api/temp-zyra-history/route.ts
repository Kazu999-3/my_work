import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds, fetchMatchDetails } from '../../../lib/riot';

// 一時的な調査用エンドポイント（note記事の実データ拡充のため、直近のランクソロから
// ザイラジャングルの試合だけ抽出する）。使い終わったら削除する。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const apiKey = process.env.RIOT_API_KEY;
  const gameName = process.env.RIOT_GAME_NAME;
  const tagLine = process.env.RIOT_TAG_LINE;
  if (!apiKey || !gameName || !tagLine) {
    return NextResponse.json({ error: 'Riot環境変数が未設定です' }, { status: 500 });
  }

  try {
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    const matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 100);

    const zyraGames: any[] = [];
    for (const matchId of matchIds) {
      try {
        const match = await fetchMatchDetails(matchId, apiKey);
        const me = match.participants.find((p) => p.puuid === puuid);
        if (!me) continue;
        if (me.championName === 'Zyra' && me.lane === 'JUNGLE') {
          const gameMins = match.gameDuration / 60;
          zyraGames.push({
            matchId,
            win: me.win,
            kills: me.kills,
            deaths: me.deaths,
            assists: me.assists,
            csPerMin: Math.round(((me.totalMinionsKilled + me.neutralMinionsKilled) / gameMins) * 10) / 10,
            visionPerMin: Math.round((me.visionScore / gameMins) * 100) / 100,
            durationMin: Math.round(gameMins * 10) / 10,
            damage: me.damageDealtToChampions,
          });
        }
      } catch {
        // 個別試合の取得失敗はスキップして続行
      }
    }

    return NextResponse.json({ success: true, totalChecked: matchIds.length, zyraJungleGames: zyraGames.length, games: zyraGames });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
