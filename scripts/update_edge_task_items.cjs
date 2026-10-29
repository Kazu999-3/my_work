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
  31: { team: 'BLUE', role: 'TOP' },
  254: { team: 'BLUE', role: 'JG' },
  910: { team: 'BLUE', role: 'MID' },
  119: { team: 'BLUE', role: 'ADC' },
  147: { team: 'BLUE', role: 'SUP' },
  82: { team: 'RED', role: 'TOP' },
  59: { team: 'RED', role: 'JG' },
  34: { team: 'RED', role: 'MID' },
  22: { team: 'RED', role: 'ADC' },
  12: { team: 'RED', role: 'SUP' },
};

async function updateEdgeTask() {
  const matchId = 'd0e39dd5-65ec-4063-94af-b267750b4882';
  console.log(`🚀 Updating edge_tasks for match ${matchId}...`);

  const { data: tasks, error: fetchErr } = await sb
    .from('edge_tasks')
    .select('id, payload')
    .eq('task_type', 'ktm_match_detail_stats');

  if (fetchErr || !tasks) {
    console.error('❌ Failed to fetch edge_tasks:', fetchErr);
    process.exit(1);
  }

  const targetTask = tasks.find((t) => t.payload?.matchId === matchId);
  if (!targetTask) {
    console.error('❌ Task not found for matchId:', matchId);
    process.exit(1);
  }

  const existingPayload = targetTask.payload;
  const rawParticipantMap = new Map();

  for (const rawP of rawData.participants) {
    const mapInfo = roleMapping[rawP.championId];
    if (mapInfo) {
      rawParticipantMap.set(`${mapInfo.team}_${mapInfo.role}`, rawP);
    }
  }

  const updatedParticipants = existingPayload.participants.map((p) => {
    const rawP = rawParticipantMap.get(`${p.team}_${p.role}`);
    if (!rawP) {
      console.warn(`No raw match for ${p.name} (${p.team} ${p.role})`);
      return p;
    }

    const s = rawP.stats;
    const items = [
      s.item0 || 0,
      s.item1 || 0,
      s.item2 || 0,
      s.item3 || 0,
      s.item4 || 0,
      s.item5 || 0,
      s.item6 || 0,
    ];
    const spells = [rawP.spell1Id || 0, rawP.spell2Id || 0];

    const damageDealt = s.totalDamageDealtToChampions || 0;
    const damageTaken = s.totalDamageTaken || 0;
    const cs = (s.totalMinionsKilled || 0) + (s.neutralMinionsKilled || 0);
    const gold = s.goldEarned || 0;
    const vision = s.visionScore || 0;

    return {
      ...p,
      items,
      spells,
      damage_dealt: damageDealt,
      damage_taken: damageTaken,
      cs,
      gold,
      vision,
      time_dead: s.totalTimeSpentDead || 0,
      cc_time: s.timeCCingOthers || 0,
      solo_kills: s.soloKills || 0,
      damage_mitigated: s.damageSelfMitigated || 0,
      building_damage: s.damageDealtToTurrets || 0,
      objective_damage: s.damageDealtToObjectives || 0,
      heal_shield: (s.totalHeal || 0) + (s.totalDamageShieldedOnTeammates || 0),
      turrets_killed: s.turretKills || 0,
      penta_kills: s.pentaKills || 0,
    };
  });

  const updatedPayload = {
    ...existingPayload,
    participants: updatedParticipants,
  };

  const { error: updateErr } = await sb
    .from('edge_tasks')
    .update({ payload: updatedPayload, updated_at: new Date().toISOString() })
    .eq('id', targetTask.id);

  if (updateErr) {
    console.error('❌ Failed to update edge_tasks:', updateErr);
  } else {
    console.log('✅ edge_tasks updated successfully with items and spells!');
    for (const p of updatedParticipants) {
      console.log(`  - ${p.name}: items=[${p.items.join(',')}] spells=[${p.spells.join(',')}]`);
    }
  }
}

updateEdgeTask().catch(console.error);
