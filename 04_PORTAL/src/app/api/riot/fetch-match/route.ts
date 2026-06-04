import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentCustomMatchId, fetchMatchDetails } from '../../../../lib/riot';

export async function POST(request: Request) {
  try {
    const { ign } = await request.json(); // e.g. "Name#TAG"

    if (!ign || !ign.includes('#')) {
      return NextResponse.json({ error: '正しいRiot IGN (Name#TAG) を指定してください、E }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'サーバ�EにRIOT_API_KEYが設定されてぁE��せん、E }, { status: 500 });
    }

    const [gameName, tagLine] = ign.split('#');

    // 1. PUUID 取征E    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    // 2. 最近�EカスタムゲームID取征E    const matchId = await fetchRecentCustomMatchId(puuid, apiKey);

    // 3. 試合詳細取征E    const matchDetails = await fetchMatchDetails(matchId, apiKey);

    return NextResponse.json(matchDetails);
  } catch (error: any) {
    console.error('Riot API Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'Riot APIからの取得に失敗しました、E }, { status: 500 });
  }
}
