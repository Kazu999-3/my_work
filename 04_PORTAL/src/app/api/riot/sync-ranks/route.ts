import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { fetchPuuidByRiotId, fetchSummonerByPuuid, fetchLeagueBySummonerId } from '../../../lib/riot';

export async function POST(req: Request) {
  try {
    const { discordName } = await req.json();
    if (!discordName) return NextResponse.json({ status: "ERROR", message: "Missing discordName" }, { status: 400 });

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // DB縺九ｉ繝励Ξ繧､繝､繝ｼ蜿門ｾ・    const { data: player, error } = await supabase
      .from('ktm_players')
      .select('id, ign')
      .eq('name', discordName)
      .single();

    if (error || !player) throw new Error("Player not found in DB.");
    if (!player.ign || !player.ign.includes('#')) throw new Error("IGN縺梧悴逋ｻ骭ｲ縺ｾ縺溘・荳肴ｭ｣縺ｧ縺吶・);

    const [gameName, tagLine] = player.ign.split('#');
    
    // PUUID -> SummonerID -> League
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    const summoner = await fetchSummonerByPuuid(puuid, apiKey);
    const leagues = await fetchLeagueBySummonerId(summoner.id, apiKey);

    // Solo Queue 縺ｮ繝ｩ繝ｳ繧ｯ繧呈爾縺・    const soloQ = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');
    let rankStr = "UNRANKED";
    if (soloQ) {
      rankStr = `${soloQ.tier} ${soloQ.rank}`;
    }

    // DB譖ｴ譁ｰ
    const { error: updateError } = await supabase
      .from('ktm_players')
      .update({ highest_rank: rankStr })
      .eq('id', player.id);

    if (updateError) throw new Error(`DB Update failed: ${updateError.message}`);

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: `繝ｩ繝ｳ繧ｯ諠・ｱ繧貞酔譛溘＠縺ｾ縺励◆: ${rankStr}` 
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
