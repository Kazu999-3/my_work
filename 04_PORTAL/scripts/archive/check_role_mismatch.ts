import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const RIOT_API_BASE_ASIA = "https://asia.api.riotgames.com";

async function run() {
  const apiKey = process.env.RIOT_API_KEY;

  const { data: dbMatches } = await supabase
    .from('ktm_matches')
    .select('*, ktm_match_participants(*)')
    .not('riot_match_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!dbMatches) return;

  for (const m of dbMatches) {
    console.log(`\nMatch ${m.riot_match_id} / ${m.created_at}`);
    const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/${m.riot_match_id}?api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const details = await res.json();

    const { data: players } = await supabase.from('ktm_players').select('*');
    const puuidToName: Record<string, string> = {};
    players?.forEach(p => { if (p.puuid) puuidToName[p.puuid] = p.name; });

    for (const p of m.ktm_match_participants) {
      const dbPuuid = players?.find(pl => pl.name === p.player_name)?.puuid;
      const riotP = details.info.participants.find((rp: any) => rp.puuid === dbPuuid);
      if (riotP) {
        let mappedRole = "";
        const tp = riotP.teamPosition || riotP.lane;
        if (tp.includes("TOP")) mappedRole = "TOP";
        if (tp.includes("JUNGLE")) mappedRole = "JG";
        if (tp.includes("MIDDLE")) mappedRole = "MID";
        if (tp.includes("BOTTOM")) mappedRole = "ADC";
        if (tp.includes("UTILITY")) mappedRole = "SUP";
        
        console.log(`  Player: ${p.player_name} | DB Role: ${p.role.padEnd(4)} | Riot Role: ${mappedRole.padEnd(4)} | Champ: ${riotP.championName} `);
        if (p.role.toUpperCase() !== mappedRole) {
           console.log(`    >>> MISMATCH! DB: ${p.role}, Riot: ${mappedRole}`);
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

run().catch(console.error);
