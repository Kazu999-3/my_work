import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchMatchDetails } from '../../../../lib/riot';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext } from '../../../../lib/mmr';

export async function POST(req: Request) {
  try {
    const { matchId } = await req.json(); // ktm_matches の ID

    if (!matchId) {
      return NextResponse.json({ status: "ERROR", message: "Missing matchId" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // 1. DBから試合と参加者を取得
    const { data: match, error: matchError } = await supabase
      .from('ktm_matches')
      .select('*, ktm_match_participants(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      throw new Error("Match not found in DB.");
    }

    if (!match.riot_match_id) {
      // 本来は participants の puuid から直近のカスタムゲームを引く処理が必要だが、
      // MVPとして match.riot_match_id が入っている前提か、ここでエラーにする
      // （Discordボット側の実装による）
      throw new Error("This match doesn't have a Riot Match ID associated yet.");
    }

    // 2. Riot APIから試合詳細を取得
    const riotDetails = await fetchMatchDetails(match.riot_match_id, apiKey);

    // 3. DBの各プレイヤーに対して再計算
    const participants = match.ktm_match_participants;
    
    // （プレイヤー情報と過去勝率の取得処理は、本来 record/route.ts と同様に行う必要があるが、
    // 　今回は簡易的に参加者の現在のMMRから逆算、または取得し直す）
    const names = participants.map((p: any) => p.player_name);
    const { data: dbPlayers } = await supabase.from('ktm_players').select('*').in('name', names);
    
    // 簡単のため、勝率などは一律50%で計算（MVP実装。完全版では同様にhistoryを引く）
    const updates = [];

    for (const p of participants) {
      const dbP = dbPlayers?.find(dp => dp.name === p.player_name);
      if (!dbP) continue;

      // DBのpuuidとRiotのpuuidでマッチング。puuidがなければ簡易マッチング
      const riotP = riotDetails.participants.find((rp: any) => {
        if (dbP.puuid && rp.puuid === dbP.puuid) return true;

        const isRed = rp.teamId === 200;
        const dbIsRed = p.team === 'RED';
        if (isRed !== dbIsRed) return false;

        const dbRole = p.role.toUpperCase();
        const rpLane = rp.lane.toUpperCase();
        if (dbRole === 'TOP' && rpLane.includes('TOP')) return true;
        if (dbRole === 'JG' && rpLane.includes('JUNGLE')) return true;
        if (dbRole === 'MID' && rpLane.includes('MIDDLE')) return true;
        if (dbRole === 'ADC' && rpLane.includes('BOTTOM')) return true;
        if (dbRole === 'SUP' && rpLane.includes('UTILITY')) return true;
        
        return false;
      });

      if (!riotP) continue;

      const currentMmr = Number(dbP[`mmr_${p.role.toLowerCase()}`]) || 1200;
      const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';

      const teamRiotParticipants = riotDetails.participants.filter((rp: any) => rp.teamId === riotP.teamId);
      const teamTotalKills = teamRiotParticipants.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
      
      const isDamageMvp = teamRiotParticipants.every((rp: any) => (riotP.damageDealtToChampions || 0) >= (rp.damageDealtToChampions || 0)) && (riotP.damageDealtToChampions || 0) > 0;
      const isObjectiveMvp = teamRiotParticipants.every((rp: any) => (riotP.damageDealtToObjectives || 0) >= (rp.damageDealtToObjectives || 0)) && (riotP.damageDealtToObjectives || 0) > 0;
      const isTankMvp = teamRiotParticipants.every((rp: any) => (riotP.totalDamageTaken || 0) >= (rp.totalDamageTaken || 0)) && (riotP.totalDamageTaken || 0) > 0;
      const isHealMvp = teamRiotParticipants.every((rp: any) => (riotP.totalHeal || 0) >= (rp.totalHeal || 0)) && (riotP.totalHeal || 0) > 0;

      const ctx: MmrCalcContext = {
        currentMmr,
        opponentMmr: 1200, 
        isWin: p.team === match.winning_team,
        kills: riotP.kills,
        deaths: riotP.deaths,
        assists: riotP.assists,
        mainRank,
        numGames: 10,
        matchupCount: 0,
        totalWinRate: 50,
        visionScore: riotP.visionScore || 0,
        cs: (riotP.totalMinionsKilled || 0) + (riotP.neutralMinionsKilled || 0),
        damageDealt: riotP.damageDealtToChampions || 0,
        damageTaken: riotP.totalDamageTaken || 0,
        objectiveDamage: riotP.damageDealtToObjectives || 0,
        healShield: riotP.totalHeal || 0,
        role: p.role,
        teamTotalKills,
        isDamageMvp,
        isObjectiveMvp,
        isTankMvp,
        isHealMvp
      };

      const mmrDelta = calculateNewMMR(ctx);
      const kdaScore = calculateKdaScore(riotP.kills, riotP.deaths, riotP.assists);

      // Riot API の実際のレーン情報をマッピング
      let mappedRole = p.role; // デフォルトは元のロール
      const tp = (riotP.teamPosition || riotP.lane || "").toUpperCase();
      if (tp.includes("TOP")) mappedRole = "TOP";
      else if (tp.includes("JUNGLE")) mappedRole = "JG";
      else if (tp.includes("MIDDLE") || tp.includes("MID")) mappedRole = "MID";
      else if (tp.includes("BOTTOM")) mappedRole = "ADC";
      else if (tp.includes("UTILITY")) mappedRole = "SUP";

      const pUpdate = {
        id: p.id,
        kills: riotP.kills,
        deaths: riotP.deaths,
        assists: riotP.assists,
        vision_score: riotP.visionScore || 0,
        kda_score: kdaScore,
        mmr_delta: mmrDelta,
        champion_name: riotP.championName,
        role: mappedRole // 実際のレーンで上書き
      };
      
      updates.push(pUpdate);

      await supabase
        .from('ktm_match_participants')
        .update({
          kills: pUpdate.kills,
          deaths: pUpdate.deaths,
          assists: pUpdate.assists,
          vision_score: pUpdate.vision_score,
          kda_score: pUpdate.kda_score,
          mmr_delta: pUpdate.mmr_delta,
          champion_name: pUpdate.champion_name,
          role: pUpdate.role
        })
        .eq('id', p.id);
    }

    return NextResponse.json({ status: "SUCCESS", message: "Match detailed stats synchronized.", updates });
  } catch (err: any) {
    console.error("Match Sync Error:", err);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
