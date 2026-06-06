import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchPuuidByRiotId, fetchSummonerByPuuid, fetchChampionMasteryByPuuid } from '../../../../lib/riot';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    // 1. Supabaseから全プレイヤーを取得
    const { data: players, error } = await supabase.from('ktm_players').select('*');
    if (error || !players) {
      return NextResponse.json({ error: 'プレイヤーの取得に失敗しました。' }, { status: 500 });
    }

    let updatedCount = 0;
    const errors = [];

    // 2. プレイヤーごとに同期処理 (レートリミットを考慮して直列で実行)
    for (const player of players) {
      try {
        if (!player.ign || !player.ign.includes('#')) continue;

        let puuid = player.puuid;
        let summonerId = player.summoner_id;

        // (A) puuid または summoner_id がない場合は RiotID から取得
        if (!puuid || !summonerId) {
          const [gameName, tagLine] = player.ign.split('#');
          puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
          const summoner = await fetchSummonerByPuuid(puuid, apiKey);
          summonerId = summoner.id;
        }

        // (B) ランクの同期は廃止（403エラー回避のため）
        // 既存のランク情報をそのまま保持する
        let highestRank = player.highest_rank || 'UNRANKED';

        // (C) チャンピオンマスタリー (得意チャンピオンTOP3) を取得
        const masteries = await fetchChampionMasteryByPuuid(puuid, apiKey, 3);
        const topChampions = masteries.map((m: any) => ({
          championId: m.championId,
          championLevel: m.championLevel,
          championPoints: m.championPoints
        }));

        // DBを更新 (puuid, summoner_id, highest_rank, main_champions)
        const updateData: any = {
          puuid,
          summoner_id: summonerId,
          highest_rank: highestRank,
          main_champions: topChampions
        };

        const { error: updateError } = await supabase
          .from('ktm_players')
          .update(updateData)
          .eq('id', player.id);

        if (updateError) throw updateError;
        updatedCount++;
        
        // レートリミット対策で少し待機 (例: 250ms)
        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (err: any) {
        console.error(`Player ${player.ign} sync error:`, err);
        errors.push(`[${player.ign}] ${err.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${updatedCount} 人のプレイヤーのRiot情報を同期しました。`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Riot Sync API Error:', error);
    return NextResponse.json({ error: error.message || '同期に失敗しました。' }, { status: 500 });
  }
}
