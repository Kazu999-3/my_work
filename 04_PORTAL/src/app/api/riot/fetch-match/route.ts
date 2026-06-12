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

    // 2. 直近の試合IDリスト取得
    const matchIds = await fetchRecentMatchIds(puuid, apiKey, 20);

    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json({ error: 'Riot API: 試合履歴がありません。' }, { status: 404 });
    }

    let targetMatchDetails = null;

    // 3. 直近20試合から最も新しいカスタムゲームを探す
    for (const matchId of matchIds) {
      // 詳細を取得してカスタムゲームか確認
      const details = await fetchMatchDetails(matchId, apiKey);
      
      const gType = (details.gameType || "").toUpperCase();

      // queueIdが 0（カスタムゲーム）または gameType に 'CUSTOM' が含まれているかチェック
      if (details.queueId === 0 || gType.includes("CUSTOM")) {
        targetMatchDetails = details;
        break; // 最も新しいカスタムが見つかったのでループを抜ける
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
