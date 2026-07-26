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

  console.log("Fetching matches with riot_match_id...");
  const { data: dbMatches } = await supabase
    .from('ktm_matches')
    .select('*, ktm_match_participants(*)')
    .not('riot_match_id', 'is', null)
    .order('created_at', { ascending: false });

  if (!dbMatches) {
    console.log("No matches found.");
    return;
  }

  const { data: players } = await supabase.from('ktm_players').select('*');
  const nameToPuuid: Record<string, string> = {};
  players?.forEach(p => { if (p.puuid) nameToPuuid[p.name] = p.puuid; });

  let updatedCount = 0;

  for (const m of dbMatches) {
    console.log(`\nProcessing Match ${m.riot_match_id} / ${m.created_at}`);
    const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/${m.riot_match_id}?api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Failed to fetch Riot match details (Status: ${res.status})`);
      continue;
    }
    const details = await res.json();

    for (const p of m.ktm_match_participants) {
      const dbPuuid = nameToPuuid[p.player_name];
      if (!dbPuuid) continue;

      const riotP = details.info.participants.find((rp: any) => rp.puuid === dbPuuid);
      if (riotP) {
        let mappedRole = "";
        const tp = (riotP.teamPosition || riotP.lane || "").toUpperCase();
        
        if (tp.includes("TOP")) mappedRole = "TOP";
        else if (tp.includes("JUNGLE")) mappedRole = "JG";
        else if (tp.includes("MIDDLE") || tp.includes("MID")) mappedRole = "MID";
        else if (tp.includes("BOTTOM")) mappedRole = "ADC";
        else if (tp.includes("UTILITY")) mappedRole = "SUP";
        
        // If teamPosition is somehow invalid, fallback to previous db role
        if (!mappedRole) {
           console.log(`  Warning: Could not map role for ${p.player_name} (teamPosition: ${tp})`);
           continue;
        }

        if (p.role.toUpperCase() !== mappedRole) {
           console.log(`  [UPDATE] ${p.player_name} : ${p.role} -> ${mappedRole} (Champ: ${riotP.championName})`);
           
           const { error } = await supabase
             .from('ktm_match_participants')
             .update({ role: mappedRole })
             .eq('id', p.id);
             
           if (error) {
             console.error(`  Error updating ${p.player_name}: ${error.message}`);
           } else {
             updatedCount++;
           }
        }
      }
    }
    // Respect rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nDone! Total roles updated: ${updatedCount}`);
}

run().catch(console.error);
