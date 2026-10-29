const fs = require('fs');
const path = require('path');

require(path.resolve(__dirname, '../04_PORTAL/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../04_PORTAL/.env.local')
});

const { createClient } = require(path.resolve(__dirname, '../04_PORTAL/node_modules/@supabase/supabase-js'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Supabase credentials not found');
  process.exit(1);
}

const sb = createClient(url, key);
const rawData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'match_609617813_raw.json'), 'utf8'));

const roleMapping = {
  // BLUE
  31: { team: 'BLUE', role: 'TOP' },
  254: { team: 'BLUE', role: 'JG' },
  910: { team: 'BLUE', role: 'MID' },
  119: { team: 'BLUE', role: 'ADC' },
  147: { team: 'BLUE', role: 'SUP' },
  // RED
  82: { team: 'RED', role: 'TOP' },
  59: { team: 'RED', role: 'JG' },
  34: { team: 'RED', role: 'MID' },
  22: { team: 'RED', role: 'ADC' },
  12: { team: 'RED', role: 'SUP' },
};

async function backfill() {
  const matchId = 'd0e39dd5-65ec-4063-94af-b267750b4882';
  console.log(`🚀 Starting backfill for match ${matchId}...`);

  // 1. ktm_matches テーブルの更新
  const { error: matchErr } = await sb
    .from('ktm_matches')
    .update({
      riot_match_id: '609617813',
      game_duration: rawData.gameDuration || 2245,
    })
    .eq('id', matchId);

  if (matchErr) {
    console.error('❌ Failed to update ktm_matches:', matchErr);
  } else {
    console.log('✅ ktm_matches updated (riot_match_id: 609617813)');
  }

  // 2. 参加者レコードの取得
  const { data: dbParticipants, error: fetchErr } = await sb
    .from('ktm_match_participants')
    .select('id, player_name, team, role, champion_name')
    .eq('match_id', matchId);

  if (fetchErr || !dbParticipants) {
    console.error('❌ Failed to fetch db participants:', fetchErr);
    process.exit(1);
  }

  console.log(`Found ${dbParticipants.length} participants in DB.`);

  for (const rawP of rawData.participants) {
    const mapInfo = roleMapping[rawP.championId];
    if (!mapInfo) {
      console.warn('Unknown championId:', rawP.championId);
      continue;
    }

    const targetRow = dbParticipants.find(
      (dp) => dp.team === mapInfo.team && dp.role === mapInfo.role
    );

    if (!targetRow) {
      console.warn(`Target row not found for ${mapInfo.team} ${mapInfo.role}`);
      continue;
    }

    const s = rawP.stats;
    const damageDealt = s.totalDamageDealtToChampions || 0;
    const damageTaken = s.totalDamageTaken || 0;
    const cs = (s.totalMinionsKilled || 0) + (s.neutralMinionsKilled || 0);
    const gold = s.goldEarned || 0;
    const visionScore = s.visionScore || 0;
    const objectiveDamage = s.damageDealtToObjectives || 0;
    const healShield = (s.totalHeal || 0) + (s.totalDamageShieldedOnTeammates || 0);

    const updatePayload = {
      damage_dealt: damageDealt,
      damage_taken: damageTaken,
      cs: cs,
      gold: gold,
      vision_score: visionScore,
      objective_damage: objectiveDamage,
      heal_shield: healShield,
    };

    const { error: updateErr } = await sb
      .from('ktm_match_participants')
      .update(updatePayload)
      .eq('id', targetRow.id);

    if (updateErr) {
      console.error(`❌ Failed to update ${targetRow.player_name}:`, updateErr);
    } else {
      console.log(`✅ Updated ${targetRow.player_name} (${targetRow.team} ${targetRow.role}): CS=${cs}, Dmg=${damageDealt}, Taken=${damageTaken}, Gold=${gold}, Vision=${visionScore}`);
    }
  }

  console.log('\n🎉 All participants backfilled successfully!');
}

backfill().catch(console.error);
