import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchPuuidByRiotId, fetchSummonerByPuuid, fetchChampionMasteryByPuuid, fetchRiotIdByPuuid } from '../../../../lib/riot';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    // リクエストボディから playerIds を取得（部分同期用）
    let playerIds: number[] | undefined;
    try {
      const body = await request.json();
      if (body && Array.isArray(body.playerIds)) {
        playerIds = body.playerIds;
      }
    } catch (e) {
      // ボディがない、またはJSONパース失敗の場合は無視して全員取得
    }

    // 1. Supabaseからプレイヤーを取得
    let dbQuery = supabase.from('ktm_players').select('*');
    if (playerIds && playerIds.length > 0) {
      dbQuery = dbQuery.in('id', playerIds);
    }

    const { data: players, error } = await dbQuery;
    if (error || !players) {
      return NextResponse.json({ error: 'プレイヤーの取得に失敗しました。' }, { status: 500 });
    }

    let updatedCount = 0;
    const errors = [];

    // 2. プレイヤーごとに同期処理 (レートリミットを考慮して直列で実行)
    for (const player of players) {
      try {
        let puuid = player.puuid;
        let summonerId = player.summoner_id;
        let currentIgn = player.ign;

        // (A) puuid または summoner_id がない場合は RiotID から取得
        if (!puuid || !summonerId) {
          if (!currentIgn || !currentIgn.includes('#')) continue;
          const [gameName, tagLine] = currentIgn.split('#');
          puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
          const summoner = await fetchSummonerByPuuid(puuid, apiKey);
          summonerId = summoner.id;
        } else {
          // (A-2) すでに puuid がある場合は、Riot ID（改名）の自動同期を試みる
          try {
            const latestRiotId = await fetchRiotIdByPuuid(puuid, apiKey);
            const latestIgn = `${latestRiotId.gameName}#${latestRiotId.tagLine}`;
            if (latestIgn !== currentIgn) {
              console.log(`🔔 [Riot Sync] 改名を検知: ${currentIgn} ➜ ${latestIgn}`);
              currentIgn = latestIgn;
            }
          } catch (nameErr: any) {
            console.warn(`[Riot Sync] 最新Riot IDの取得に失敗しました: ${nameErr.message}`);
          }
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

        // DBを更新 (ign, puuid, summoner_id, highest_rank, main_champions)
        const updateData: any = {
          ign: currentIgn,
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

        // APIキーの無効（403）またはレートリミット（429）を検知した場合は、
        // ループを早期脱出して後続のAPI乱打によるクラッシュやIP BANを防ぐ（安全停止）
        const errMsg = err.message || '';
        if (errMsg.includes('403') || errMsg.includes('429') || errMsg.includes('Forbidden') || errMsg.includes('Too Many Requests')) {
          console.warn("⚠️ [Riot Sync] APIキーのエラー (403/429) を検知したため、同期処理を安全に中断します。");
          errors.push(`[SYSTEM] APIキーエラー（403/429）のため、処理を安全に中断しました。APIキーを確認してください。`);
          break;
        }
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
