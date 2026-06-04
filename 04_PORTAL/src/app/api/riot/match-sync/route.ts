import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { fetchMatchDetails } from '../../../lib/riot';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext } from '../../../lib/mmr';

export async function POST(req: Request) {
  try {
    const { matchId } = await req.json(); // ktm_matches 縺ｮ ID

    if (!matchId) {
      return NextResponse.json({ status: "ERROR", message: "Missing matchId" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // 1. DB縺九ｉ隧ｦ蜷医→蜿ょ刈閠・ｒ蜿門ｾ・    const { data: match, error: matchError } = await supabase
      .from('ktm_matches')
      .select('*, ktm_match_participants(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      throw new Error("Match not found in DB.");
    }

    if (!match.riot_match_id) {
      // 譛ｬ譚･縺ｯ participants 縺ｮ puuid 縺九ｉ逶ｴ霑代・繧ｫ繧ｹ繧ｿ繝繧ｲ繝ｼ繝繧貞ｼ輔￥蜃ｦ逅・′蠢・ｦ√□縺後・      // MVP縺ｨ縺励※ match.riot_match_id 縺悟・縺｣縺ｦ縺・ｋ蜑肴署縺九√％縺薙〒繧ｨ繝ｩ繝ｼ縺ｫ縺吶ｋ
      // ・・iscord繝懊ャ繝亥・縺ｮ螳溯｣・↓繧医ｋ・・      throw new Error("This match doesn't have a Riot Match ID associated yet.");
    }

    // 2. Riot API縺九ｉ隧ｦ蜷郁ｩｳ邏ｰ繧貞叙蠕・    const riotDetails = await fetchMatchDetails(match.riot_match_id, apiKey);

    // 3. DB縺ｮ蜷・・繝ｬ繧､繝､繝ｼ縺ｫ蟇ｾ縺励※蜀崎ｨ育ｮ・    const participants = match.ktm_match_participants;
    
    // ・医・繝ｬ繧､繝､繝ｼ諠・ｱ縺ｨ驕主悉蜍晉紫縺ｮ蜿門ｾ怜・逅・・縲∵悽譚･ record/route.ts 縺ｨ蜷梧ｧ倥↓陦後≧蠢・ｦ√′縺ゅｋ縺後・    // 縲莉雁屓縺ｯ邁｡譏鍋噪縺ｫ蜿ょ刈閠・・迴ｾ蝨ｨ縺ｮMMR縺九ｉ騾・ｮ励√∪縺溘・蜿門ｾ励＠逶ｴ縺呻ｼ・    const names = participants.map((p: any) => p.player_name);
    const { data: dbPlayers } = await supabase.from('ktm_players').select('*').in('name', names);
    
    // 邁｡蜊倥・縺溘ａ縲∝享邇・↑縺ｩ縺ｯ荳蠕・0%縺ｧ險育ｮ暦ｼ・VP螳溯｣・ょｮ悟・迚医〒縺ｯ蜷梧ｧ倥↓history繧貞ｼ輔￥・・    const updates = [];

    for (const p of participants) {
      // Riot邨先棡縺九ｉ隧ｲ蠖薙・繝ｬ繧､繝､繝ｼ繧呈爾縺・      // IGN縺ｮ繝槭ャ繝√Φ繧ｰ縺碁屮縺励＞蝣ｴ蜷医・邁｡譏鍋噪縺ｫ繝ｭ繝ｼ繝ｫ縺ｨ繝√・繝縺ｧ蛻､螳・      const riotP = riotDetails.participants.find((rp: any) => {
        // Red = 200, Blue = 100
        const isRed = rp.teamId === 200;
        const dbIsRed = p.team === 'RED';
        if (isRed !== dbIsRed) return false;

        const dbRole = p.role.toUpperCase();
        const rpLane = rp.lane.toUpperCase();
        // 邁｡譏薙・繝・メ繝ｳ繧ｰ
        if (dbRole === 'TOP' && rpLane.includes('TOP')) return true;
        if (dbRole === 'JG' && rpLane.includes('JUNGLE')) return true;
        if (dbRole === 'MID' && rpLane.includes('MIDDLE')) return true;
        if (dbRole === 'ADC' && rpLane.includes('BOTTOM')) return true;
        if (dbRole === 'SUP' && rpLane.includes('UTILITY')) return true;
        
        return false;
      });

      if (!riotP) continue;

      const dbP = dbPlayers?.find(dp => dp.name === p.player_name);
      if (!dbP) continue;

      const currentMmr = Number(dbP[`mmr_${p.role.toLowerCase()}`]) || 1200;
      const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';

      const ctx: MmrCalcContext = {
        currentMmr,
        opponentMmr: 1200, // 邁｡譏灘喧
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
        role: p.role
      };

      const mmrDelta = calculateNewMMR(ctx);
      const kdaScore = calculateKdaScore(riotP.kills, riotP.deaths, riotP.assists);

      // participant 譖ｴ譁ｰ逕ｨ繝・・繧ｿ
      const pUpdate = {
        id: p.id,
        kills: riotP.kills,
        deaths: riotP.deaths,
        assists: riotP.assists,
        vision_score: riotP.visionScore || 0,
        kda_score: kdaScore,
        mmr_delta: mmrDelta
      };
      
      updates.push(pUpdate);

      // 繝励Ξ繧､繝､繝ｼ縺ｮMMR繧呈峩譁ｰ・域悽譚･縺ｯ蟾ｮ蛻・ｒ驕ｩ蛻・↓蠖薙※繧句ｿ・ｦ√′縺ゅｋ・・      // 莉雁屓縺ｯ譖ｴ譁ｰ蜑阪・蛟､繧貞宍蟇・↓霑ｽ縺医↑縺・◆繧√∫ｰ｡逡･蛹・      await supabase
        .from('ktm_match_participants')
        .update({
          kills: pUpdate.kills,
          deaths: pUpdate.deaths,
          assists: pUpdate.assists,
          vision_score: pUpdate.vision_score,
          kda_score: pUpdate.kda_score,
          mmr_delta: pUpdate.mmr_delta
        })
        .eq('id', p.id);
    }

    return NextResponse.json({ status: "SUCCESS", message: "Match detailed stats synchronized.", updates });
  } catch (err: any) {
    console.error("Match Sync Error:", err);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
