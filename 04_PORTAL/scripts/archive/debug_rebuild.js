const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// MMR算出ロジックを簡易的に移植（検証用）
function calculateInitialMmr(rank, role, prefs) {
  // 簡易版
  return 1200;
}
function calculateNewMMR(ctx) {
  // ctx.delta などを適当に返す簡易版
  return ctx.isWin ? 16 : -16;
}
function calculateKdaScore(kills, deaths, assists) {
  return (kills + assists) / Math.max(1, deaths);
}

const envContent = fs.readFileSync("../.env", 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].replace(/["']/g, '').trim() : '';
};

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRebuild() {
  try {
    const { data: allPlayers, error: pError } = await supabase.from('ktm_players').select('*');
    if (pError) throw pError;

    const playersMap = new Map();
    for (const p of allPlayers) {
      const prefs = p.role_preferences || { primary: 'ALL', secondary: 'FILL' };
      playersMap.set(p.name, {
        id: p.id, name: p.name, highest_rank: p.highest_rank, role_preferences: prefs,
        mmr_top: 1200, mmr_jg: 1200, mmr_mid: 1200, mmr_adc: 1200, mmr_sup: 1200,
        totalGames: 0, totalWins: 0, laneGames: { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 }
      });
    }

    const { data: allMatches, error: mError } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
    if (mError) throw mError;

    const { data: allParticipants, error: pErr } = await supabase.from('ktm_match_participants').select('*');
    if (pErr) throw pErr;

    const participantsByMatch = new Map();
    if (allParticipants) {
      for (const part of allParticipants) {
        const list = participantsByMatch.get(part.match_id) || [];
        list.push(part);
        participantsByMatch.set(part.match_id, list);
      }
    }

    const participantUpdates = [];

    for (const match of allMatches) {
      const participants = participantsByMatch.get(match.id) || [];
      if (participants.length === 0) continue;
      const blueTeam = participants.filter(p => p.team === 'BLUE');
      const redTeam = participants.filter(p => p.team === 'RED');

      const snapshotMap = new Map();
      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        if (!memPlayer) continue;
        snapshotMap.set(p.player_name, {
          mmr_top: memPlayer.mmr_top,
          mmr_jg: memPlayer.mmr_jg,
          mmr_mid: memPlayer.mmr_mid,
          mmr_adc: memPlayer.mmr_adc,
          mmr_sup: memPlayer.mmr_sup,
          totalGames: memPlayer.totalGames,
          totalWins: memPlayer.totalWins,
          laneGames: { ...memPlayer.laneGames }
        });
      }

      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        const playerSnapshot = snapshotMap.get(p.player_name);
        if (!memPlayer || !playerSnapshot) continue;

        const role = p.role.toUpperCase();
        const isWin = p.team === match.winning_team;
        
        const ctx = { isWin };
        const delta = calculateNewMMR(ctx);
        const kdaScore = calculateKdaScore(p.kills || 0, p.deaths || 0, p.assists || 0);

        participantUpdates.push({ 
          id: p.id, 
          match_id: p.match_id,
          player_name: p.player_name,
          role: p.role,
          team: p.team,
          champion_name: p.champion_name,
          kda_score: kdaScore, 
          mmr_delta: delta 
        });

        // 状態更新
        const mmrKey = `mmr_${role.toLowerCase()}`;
        memPlayer[mmrKey] += delta;
        memPlayer.totalGames += 1;
        if (isWin) memPlayer.totalWins += 1;
      }
    }

    console.log("Total updates count:", participantUpdates.length);
    const nullRecords = participantUpdates.filter(pu => !pu.player_name);
    console.log("Updates with null player_name:", nullRecords.length);
    if (nullRecords.length > 0) {
      console.log("Sample null update records:", nullRecords.slice(0, 5));
      return;
    }

    // テスト用の Dry Run upsert (トランザクションではないので実際に行われるが、問題箇所の特定)
    console.log("Running upsert test...");
    const { error: upsertError } = await supabase
      .from('ktm_match_participants')
      .upsert(participantUpdates.map(pu => ({
        id: pu.id,
        match_id: pu.match_id,
        player_name: pu.player_name,
        role: pu.role,
        team: pu.team,
        champion_name: pu.champion_name,
        kda_score: pu.kda_score,
        mmr_delta: pu.mmr_delta
      })));

    if (upsertError) {
      console.error("Upsert failed:", upsertError);
    } else {
      console.log("Upsert completed successfully!");
    }

  } catch (err) {
    console.error("Script Error:", err);
  }
}

debugRebuild();
