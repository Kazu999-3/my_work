import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext } from '../../../../lib/mmr';

export async function POST(request: Request) {
  try {
    const { winningTeam, gameDuration, participants, riotMatchId } = await request.json();

    if (!winningTeam || !participants || participants.length !== 10) {
      return NextResponse.json({ error: '蜈･蜉帙ョ繝ｼ繧ｿ縺御ｸ肴ｭ｣縺ｧ縺吶・0莠ｺ縺ｮ蜿ょ刈閠・→蜍晏茜繝√・繝縺悟ｿ・ｦ√〒縺吶・ }, { status: 400 });
    }

    // 1. 繝・・繧ｿ繝吶・繧ｹ縺九ｉ蜈ｨ蜿ょ刈閠・・譛譁ｰ繧ｹ繝・・繧ｿ繧ｹ繧貞叙蠕・    const names = participants.map((p: any) => p.name);
    const { data: dbPlayers, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !dbPlayers || dbPlayers.length !== 10) {
      return NextResponse.json({ error: '荳驛ｨ縺ｮ繝励Ξ繧､繝､繝ｼ諠・ｱ縺轡B縺九ｉ隕九▽縺九ｊ縺ｾ縺帙ｓ縲・ }, { status: 500 });
    }

    // 2. 驕主悉縺ｮ蜍晉紫繝ｻ隧ｦ蜷域焚繧貞叙蠕・(Supabase縺ｮktm_match_participants遲峨°繧・
    // 邁｡譏鍋噪縺ｫ蜈ｨ隧ｦ蜷亥ｱ･豁ｴ繧偵ヵ繧ｧ繝・メ縺励※髮・ｨ茨ｼ医ヱ繝輔か繝ｼ繝槭Φ繧ｹ蝠城｡後′縺ゅｌ縺ｰ蠕梧律View繧・寔險医ユ繝ｼ繝悶Ν縺ｫ遘ｻ陦鯉ｼ・    const { data: historyData, error: hError } = await supabase
      .from('ktm_match_participants')
      .select(`
        player_name, role, team, ktm_matches!inner(winning_team)
      `)
      .in('player_name', names);

    const statsMap: Record<string, { roleGames: Record<string, number>, totalGames: number, totalWins: number }> = {};
    names.forEach((name: string) => {
      statsMap[name] = { roleGames: {}, totalGames: 0, totalWins: 0 };
    });

    if (historyData) {
      historyData.forEach((row: any) => {
        const pName = row.player_name;
        const role = row.role;
        const isWin = row.team === row.ktm_matches.winning_team;
        if (!statsMap[pName]) return;
        
        statsMap[pName].totalGames += 1;
        if (isWin) statsMap[pName].totalWins += 1;
        
        statsMap[pName].roleGames[role] = (statsMap[pName].roleGames[role] || 0) + 1;
      });
    }

    // 3. 蜷・・繝ｬ繧､繝､繝ｼ縺ｮMMR螟牙虚繧定ｨ育ｮ・    const results = [];
    
    for (const input of participants) {
      const dbP = dbPlayers.find(p => p.name === input.name);
      if (!dbP) continue;

      const roleMmrKey = `mmr_${input.role.toLowerCase()}` as keyof typeof dbP;
      const currentMmr = Number(dbP[roleMmrKey]) || 1200;

      // 蟇ｾ髱｢逶ｸ謇九・MMR繧呈爾縺・      const opponent = participants.find((p: any) => p.role === input.role && p.team !== input.team);
      const oppDbP = opponent ? dbPlayers.find(p => p.name === opponent.name) : null;
      const oppMmrKey = opponent ? `mmr_${opponent.role.toLowerCase()}` as keyof typeof oppDbP : null;
      const opponentMmr = oppDbP && oppMmrKey ? (Number(oppDbP[oppMmrKey]) || 1200) : 1200;

      // 繧ｹ繧ｿ繝・ヤ險育ｮ礼畑繝・・繧ｿ貅門ｙ
      const isWin = input.team === winningTeam;
      const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';
      
      const pStats = statsMap[input.name];
      const numGames = pStats.roleGames[input.role] || 0;
      const totalWinRate = pStats.totalGames > 0 ? (pStats.totalWins / pStats.totalGames) * 100 : 50;
      
      // 蟇ｾ髱｢蝗樊焚縺ｮ險育ｮ・(莉雁屓縺ｯ邁｡譏鍋噪縺ｫ0縺ｨ縺吶ｋ縺九”istoryData縺九ｉ縺輔ｉ縺ｫ髮・ｨ亥庄閭ｽ縺縺檎怐逡･)
      const matchupCount = 0; 

      const ctx: MmrCalcContext = {
        currentMmr,
        opponentMmr,
        isWin,
        kills: Number(input.kills),
        deaths: Number(input.deaths),
        assists: Number(input.assists),
        mainRank,
        numGames,
        matchupCount,
        totalWinRate,
        visionScore: 0, // 騾溷ｱ譎ゅ・縺ｾ縺蜿門ｾ励〒縺阪↑縺・◆繧・
        cs: 0,          // 騾溷ｱ譎ゅ・縺ｾ縺蜿門ｾ励〒縺阪↑縺・◆繧・
        role: input.role
      };

      const mmrDelta = calculateNewMMR(ctx);
      const kdaScore = calculateKdaScore(input.kills, input.deaths, input.assists);

      results.push({
        ...input,
        currentMmr,
        mmrDelta,
        kdaScore,
        dbPlayer: dbP
      });
    }

    // 4. DB縺ｸ縺ｮ繝医Λ繝ｳ繧ｶ繧ｯ繧ｷ繝ｧ繝ｳ譖ｸ縺崎ｾｼ縺ｿ
    // (1) ktm_matches 繝ｬ繧ｳ繝ｼ繝我ｽ懈・
    const { data: matchData, error: mError } = await supabase
      .from('ktm_matches')
      .insert({
        winning_team: winningTeam,
        game_duration: gameDuration || 0,
        riot_match_id: riotMatchId || null
      })
      .select('id')
      .single();

    if (mError || !matchData) {
      throw new Error(`隧ｦ蜷医Ξ繧ｳ繝ｼ繝峨・菴懈・縺ｫ螟ｱ謨・ ${mError?.message}`);
    }

    const newMatchId = matchData.id;

    // (2) ktm_match_participants 縺ｫ10莠ｺ蛻・NSERT
    const participantInserts = results.map(r => ({
      match_id: newMatchId,
      player_name: r.name,
      team: r.team,
      role: r.role,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      vision_score: r.vision_score || 0,
      kda_score: r.kdaScore,
      mmr_delta: r.mmrDelta
    }));

    const { error: piError } = await supabase
      .from('ktm_match_participants')
      .insert(participantInserts);
    
    if (piError) throw new Error(`蜿ょ刈閠・ョ繝ｼ繧ｿ縺ｮ菴懈・縺ｫ螟ｱ謨・ ${piError.message}`);

    // (3) ktm_players 縺ｮMMR繧旦PDATE
    // 縺昴ｌ縺槭ｌ縺ｮ繝ｬ繧ｳ繝ｼ繝峨ｒ譖ｴ譁ｰ
    for (const r of results) {
      const roleMmrKey = `mmr_${r.role.toLowerCase()}`;
      const newRoleMmr = r.currentMmr + r.mmrDelta;
      
      // 蜈ｨ菴溺MR縺ｯ蜷・Ξ繝ｼ繝ｳ縺ｮ蟷ｳ蝮・ｒ縺ｨ繧九・縺桑TM縺ｮ莉墓ｧ・      const top = r.role === 'TOP' ? newRoleMmr : (r.dbPlayer.mmr_top || 1200);
      const jg = r.role === 'JG' ? newRoleMmr : (r.dbPlayer.mmr_jg || 1200);
      const mid = r.role === 'MID' ? newRoleMmr : (r.dbPlayer.mmr_mid || 1200);
      const adc = r.role === 'ADC' ? newRoleMmr : (r.dbPlayer.mmr_adc || 1200);
      const sup = r.role === 'SUP' ? newRoleMmr : (r.dbPlayer.mmr_sup || 1200);
      const newTotalMmr = Math.round((top + jg + mid + adc + sup) / 5);

      const updateData: any = {
        [roleMmrKey]: newRoleMmr,
        mmr: newTotalMmr
      };

      const { error: uError } = await supabase
        .from('ktm_players')
        .update(updateData)
        .eq('name', r.name);
        
      if (uError) console.error(`Player ${r.name} 縺ｮ譖ｴ譁ｰ繧ｨ繝ｩ繝ｼ:`, uError);
    }

    return NextResponse.json({ success: true, matchId: newMatchId, updates: results });

  } catch (error: any) {
    console.error('Record Match Error:', error);
    return NextResponse.json({ error: error.message || '隧ｦ蜷医・險倬鹸荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・ }, { status: 500 });
  }
}
