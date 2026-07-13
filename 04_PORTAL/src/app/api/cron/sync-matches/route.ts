import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchRecentCustomMatchId, fetchMatchDetails } from '../../../../lib/riot';

export const maxDuration = 60; // Vercel タイムアウト延長(Proの場合は有効)

export async function GET(request: Request) {
  // 自動化用のCronエンドポイント（手動で叩くことも可能）
  
  // 認証チェック (cronジョブからのリクエストを想定)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET; // Vercel の CRON_SECRET 等を設定
  
  // 手動テスト用にローカルまたは特定のクエリがあれば通す
  const url = new URL(request.url);
  const isTest = url.searchParams.get('test') === 'true';

  if (!isTest && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const RIOT_API_KEY = process.env.RIOT_API_KEY;
  if (!RIOT_API_KEY) {
    return NextResponse.json({ error: 'Riot API Key is not set' }, { status: 500 });
  }

  try {
    // 1. puuidが登録されているプレイヤーを数名取得（最近アクティブな人から3名）
    const { data: activePlayers } = await supabase
      .from('ktm_players')
      .select('id, name, puuid, discord_id, role_preferences, pity, off_role_pity')
      .not('puuid', 'is', null)
      .eq('is_active', true)
      .limit(3);

    if (!activePlayers || activePlayers.length === 0) {
      return NextResponse.json({ message: 'puuidが登録されているアクティブプレイヤーがいません。' });
    }

    // KTMメンバー全体のpuuidリストを作っておく（参加者被り率の判定用）
    const { data: allPlayers } = await supabase
      .from('ktm_players')
      .select('id, name, puuid, discord_id, role_preferences, pity, off_role_pity, ign')
      .not('puuid', 'is', null);
    
    const allPuuids = allPlayers?.map((p: any) => p.puuid) || [];
    const allNames = allPlayers?.map((p: any) => p.name) || [];

    const processedMatchIds = new Set<string>();
    let savedMatchesCount = 0;

    for (const player of activePlayers) {
      if (!player.puuid) continue;

      try {
        // 直近のカスタムマッチIDを取得
        const matchId = await fetchRecentCustomMatchId(player.puuid, RIOT_API_KEY);
        if (!matchId) continue;
        if (processedMatchIds.has(matchId)) continue;
        processedMatchIds.add(matchId);

        // 既にDBにあるかチェック
        const { data: existingMatch } = await supabase
          .from('ktm_matches')
          .select('id')
          .eq('id', matchId)
          .single();

        if (existingMatch) {
          continue; // 登録済み
        }

        // 試合詳細を取得
        const matchDetails = await fetchMatchDetails(matchId, RIOT_API_KEY);
        
        // KTMマッチか判定 (参加者の半分以上がKTMメンバーかどうか)
        let ktmMemberCount = 0;
        // ※riot.ts の fetchMatchDetails は現在 puuid を返していないので、名前かpuuidで判定
        // ここではRiotID（GameName）がKTMプレイヤーの名前と一致するかどうかで簡易判定する
        matchDetails.participants.forEach((p: any) => {
          // 部分一致を廃止し、name もしくは ign との完全一致で判定する
          const isKtmPlayer = allPlayers?.some((k: any) => 
            k.name.toLowerCase() === p.riotIdName.toLowerCase() ||
            (k.ign && k.ign.toLowerCase() === p.riotIdName.toLowerCase())
          );
          if (isKtmPlayer) {
            ktmMemberCount++;
          }
        });

        // 5人以上一致すればKTMの内戦とみなす
        if (ktmMemberCount >= 5) {
          // ktm_matchesに登録
          const blueWin = matchDetails.participants.find((p: any) => p.teamId === 100)?.win || false;
          await supabase.from('ktm_matches').insert({
            id: matchId,
            team_red_win: !blueWin,
            match_data: matchDetails
          });

          // ktm_match_participants に登録 & Pity更新
          for (const p of matchDetails.participants) {
            const teamStr = p.teamId === 100 ? 'BLUE' : 'RED';
            let roleStr = p.lane || 'UNKNOWN';
            // RiotAPIのLane文字列をKTMのRoleに変換
            if (roleStr === 'JUNGLE') roleStr = 'JG';
            if (roleStr === 'MIDDLE') roleStr = 'MID';
            if (roleStr === 'BOTTOM') roleStr = 'ADC';
            if (roleStr === 'UTILITY') roleStr = 'SUP';

            // DB上のプレイヤーを特定 (完全一致で判定)
            const dbPlayer = allPlayers?.find((k: any) => 
              k.name.toLowerCase() === p.riotIdName.toLowerCase() || 
              (k.ign && k.ign.toLowerCase() === p.riotIdName.toLowerCase())
            );
            
            // ktm_match_participants.player_name は NOT NULL のため特定できない場合はフォールバック
            const playerName = dbPlayer ? dbPlayer.name : p.riotIdName;
            if (!dbPlayer) {
              console.warn(`[SyncMatches] Player not registered in DB for Riot ID: ${p.riotIdName}`);
            }

            await supabase.from('ktm_match_participants').insert({
              match_id: matchId,
              player_name: playerName,
              team: teamStr,
              role: roleStr,
              champion_name: p.championName,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              damage_dealt: p.damageDealtToChampions,
              vision_score: p.visionScore
            });

            // PITY自動計算 (KTMプレイヤーの場合)
            if (dbPlayer) {
              const primary = dbPlayer.role_preferences?.primary || 'ALL';
              let newPity = dbPlayer.pity || 0;
              let newOffPity = dbPlayer.off_role_pity || 0;

              if (primary === 'ALL' || primary === roleStr) {
                // 希望通りだった -> Pityリセット、OffPity増加
                newPity = 0;
                newOffPity += 1;
              } else {
                // 希望外だった -> Pity増加、OffPityリセット
                newPity += 1;
                newOffPity = 0;
              }

              // 更新
              await supabase
                .from('ktm_players')
                .update({ 
                  pity: newPity, 
                  off_role_pity: newOffPity,
                  spectator_pity: 0 // 試合に出たので0にリセット
                })
                .eq('id', dbPlayer.id);
            }
          }

          savedMatchesCount++;
        }

      } catch (err: any) {
        console.error(`PUUID ${player.puuid} の取得中にエラー:`, err.message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${savedMatchesCount}件のカスタムマッチを自動登録し、PITYを更新しました。`,
      processedIds: Array.from(processedMatchIds)
    });

  } catch (error: any) {
    console.error('Match Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
