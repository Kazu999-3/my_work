import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds, fetchMatchDetails } from '../../../../lib/riot';

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

    // 2. カスタム(0) のマッチIDリストを取得 (最大5件)
    let matchIds: string[] = [];
    try {
      matchIds = await fetchRecentMatchIds(puuid, apiKey, 5, 0);
    } catch (err) {
      console.error('Error fetching custom matches:', err);
    }

    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json({ 
        error: '最新のカスタムゲームが見つかりませんでした。反映まで最大3分ほどかかる場合があります。しばらく経ってから再度お試しください。' 
      }, { status: 404 });
    }

    let targetMatchDetails = null;

    // 最新の最大3件まで詳細を取得して検証
    const scanCount = Math.min(matchIds.length, 3);
    for (let i = 0; i < scanCount; i++) {
      try {
        const details = await fetchMatchDetails(matchIds[i], apiKey);
        const gType = (details.gameType || "").toUpperCase();

        // Queue IDが0、またはgameTypeにCUSTOMが含まれている場合のみ
        if (details.queueId === 0 || gType.includes("CUSTOM")) {
          targetMatchDetails = details;
          break;
        }
      } catch (e: any) {
        console.error(`Error fetching match details for ${matchIds[i]}:`, e);
        if (e.message && (e.message.includes("429") || e.message.includes("Too Many Requests"))) {
          break;
        }
      }
    }

    if (!targetMatchDetails) {
      return NextResponse.json({ 
        error: '最新のカスタムゲームが見つかりませんでした。反映まで最大3分ほどかかる場合があります。しばらく経ってから再度お試しください。' 
      }, { status: 404 });
    }

    return NextResponse.json(targetMatchDetails);
  } catch (error: any) {
    console.error('Riot API Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'Riot APIからの取得に失敗しました。' }, { status: 500 });
  }
}
