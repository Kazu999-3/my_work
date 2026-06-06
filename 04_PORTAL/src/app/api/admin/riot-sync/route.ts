import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchPuuidByRiotId, fetchSummonerByPuuid, fetchLeagueBySummonerId } from '../../../../lib/riot';

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

        // (B) Summoner ID を使って現在のランク (League-v4) を取得
        const leagueEntries = await fetchLeagueBySummonerId(summonerId, apiKey);
        
        // ソロキュー(RANKED_SOLO_5x5)を探す
        const soloQ = leagueEntries.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5');

        // ランクの強さを数値化して比較する関数
        const getRankValue = (rankStr: string) => {
          if (!rankStr || rankStr === 'UNRANKED') return 0;
          const tiers: Record<string, number> = {
            IRON: 100, BRONZE: 200, SILVER: 300, GOLD: 400, PLATINUM: 500, 
            EMERALD: 600, DIAMOND: 700, MASTER: 800, GRANDMASTER: 900, CHALLENGER: 1000
          };
          const divs: Record<string, number> = { 'IV': 1, 'III': 2, 'II': 3, 'I': 4 };
          
          const parts = rankStr.toUpperCase().split(' ');
          const tierVal = tiers[parts[0]] || 0;
          const divVal = parts[1] ? (divs[parts[1]] || 0) : 0;
          return tierVal + divVal;
        };

        let highestRank = player.highest_rank || 'UNRANKED';
        
        if (soloQ) {
          const currentRank = `${soloQ.tier} ${soloQ.rank}`;
          const currentVal = getRankValue(currentRank);
          const dbVal = getRankValue(highestRank);

          // 自己ベスト更新方式: 現在のランクが過去の最高ランクを上回っている場合のみ上書きする
          if (currentVal > dbVal) {
            highestRank = currentRank;
          }
        }

        // DBを更新 (puuid, summoner_id, highest_rank)
        const updateData: any = {
          puuid,
          summoner_id: summonerId,
          highest_rank: highestRank
        };

        const { error: updateError } = await supabase
          .from('ktm_players')
          .update(updateData)
          .eq('id', player.id);

        if (updateError) throw updateError;
        updatedCount++;
        
        // レートリミット対策で少し待機 (例: 200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err: any) {
        console.error(`Player ${player.ign} sync error:`, err);
        errors.push(`[${player.ign}] ${err.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${updatedCount} 人のプレイヤーのランクを同期しました。`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Riot Sync API Error:', error);
    return NextResponse.json({ error: error.message || '同期に失敗しました。' }, { status: 500 });
  }
}
