import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentCustomMatchId, fetchMatchDetails } from '../../../../lib/riot';

export async function POST(request: Request) {
  try {
    const { ign } = await request.json(); // e.g. "Name#TAG"

    if (!ign || !ign.includes('#')) {
      return NextResponse.json({ error: '正しいRiot IGN (Name#TAG) を指定してください。' }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'サーバーにRIOT_API_KEYが設定されていません。' }, { status: 500 });
    }

    const [gameName, tagLine] = ign.split('#');

    // 1. PUUID 取得
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    // 2. 最近のカスタムゲームID取得
    const matchId = await fetchRecentCustomMatchId(puuid, apiKey);

    // 3. 試合詳細取得
    const matchDetails = await fetchMatchDetails(matchId, apiKey);

    return NextResponse.json(matchDetails);
  } catch (error: any) {
    console.error('Riot API Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'Riot APIからの取得に失敗しました。' }, { status: 500 });
  }
}
