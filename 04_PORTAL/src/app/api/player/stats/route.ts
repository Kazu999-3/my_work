import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const discordId = body.discordId;

    if (!discordId) {
      return NextResponse.json({ status: "ERROR", message: "Missing discordId" }, { status: 400 });
    }

    // 1. 繝励Ξ繧､繝､繝ｼ縺ｮ蝓ｺ譛ｬ諠・ｱ繧貞叙蠕・    const { data: player, error: playerError } = await supabase
      .from('ktm_players')
      .select('*')
      .eq('discord_id', discordId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ status: "NOT_FOUND" });
    }

    // 2. 逶ｴ霑代・隧ｦ蜷亥盾蜉險倬鹸繧貞叙蠕・    const { data: participants, error: partError } = await supabase
      .from('ktm_match_participants')
      .select('*, ktm_matches(*)')
      .eq('player_name', player.name)
      .order('created_at', { ascending: false });

    if (partError) {
      throw new Error(partError.message);
    }

    const stats = {
      total: { g: 0, w: 0 },
      recent: [] as { win: boolean }[],
      roles: {
        Top: { g: 0, w: 0 },
        Jg: { g: 0, w: 0 },
        Mid: { g: 0, w: 0 },
        Adc: { g: 0, w: 0 },
        Sup: { g: 0, w: 0 },
      } as Record<string, { g: number, w: number }>
    };

    let totalG = 0;
    let totalW = 0;

    participants?.forEach((p: any) => {
      const match = p.ktm_matches;
      if (!match) return;
      
      const isWin = p.team === match.winning_team;
      totalG++;
      if (isWin) totalW++;
      
      if (stats.recent.length < 5) {
        stats.recent.push({ win: isWin });
      }

      // 'TOP', 'JG' 遲峨ｒ蜈磯ｭ螟ｧ譁・ｭ励↓逶ｴ縺・(Top, Jg, Mid, Adc, Sup)
      let role = p.role ? p.role.toUpperCase() : 'UNKNOWN';
      if (role === 'TOP') role = 'Top';
      if (role === 'JG') role = 'Jg';
      if (role === 'MID') role = 'Mid';
      if (role === 'ADC') role = 'Adc';
      if (role === 'SUP') role = 'Sup';

      if (stats.roles[role]) {
        stats.roles[role].g++;
        if (isWin) stats.roles[role].w++;
      }
    });

    stats.total = { g: totalG, w: totalW };

    // MMR繧呈紛蠖｢
    const mmrs = {
      Top: player.mmr_top || player.mmr || 1200,
      Jg: player.mmr_jg || player.mmr || 1200,
      Mid: player.mmr_mid || player.mmr || 1200,
      Adc: player.mmr_adc || player.mmr || 1200,
      Sup: player.mmr_sup || player.mmr || 1200,
    };

    const responseData = {
      status: "SUCCESS",
      player: player.name,
      pity: player.pity_points || 0,
      mmrs: mmrs,
      stats: stats,
      rivalry: {}, // 莉雁ｾ後・諡｡蠑ｵ逕ｨ
      lolIgn: player.ign || null
    };

    return NextResponse.json(responseData);
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
