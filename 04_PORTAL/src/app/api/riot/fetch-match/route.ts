import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
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

    // 3. すでに登録済みの試合IDをDBから取得
    const { data: existingMatches } = await supabase
      .from('ktm_matches')
      .select('id, riot_match_id')
      .or(`id.in.(${matchIds.join(',')}),riot_match_id.in.(${matchIds.join(',')})`);

    const existingIds = new Set<string>();
    if (existingMatches) {
      existingMatches.forEach(m => {
        if (m.id) existingIds.add(m.id);
        if (m.riot_match_id) existingIds.add(m.riot_match_id);
      });
    }

    let targetMatchDetails = null;

    // 4. 未登録の最新カスタムゲームを探す
    for (const matchId of matchIds) {
      if (existingIds.has(matchId)) {
        continue; // すでに登録済み
      }

      // 詳細を取得してカスタムゲームか確認
      const details = await fetchMatchDetails(matchId, apiKey);
      
      // queueIdが 0（カスタムゲーム）または gameType が 'CUSTOM_GAME' であるかチェック
      if (details.queueId === 0 || details.gameType === 'CUSTOM_GAME') {
        targetMatchDetails = details;
        break; // 未登録の最新カスタムが見つかったのでループを抜ける
      }
    }

    if (!targetMatchDetails) {
      return NextResponse.json({ 
        error: '未登録の最新のカスタムゲームが見つかりませんでした。反映まで最大3分ほどかかる場合があります。しばらく経ってから再度お試しください。' 
      }, { status: 404 });
    }

    return NextResponse.json(targetMatchDetails);
  } catch (error: any) {
    console.error('Riot API Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'Riot APIからの取得に失敗しました。' }, { status: 500 });
  }
}
