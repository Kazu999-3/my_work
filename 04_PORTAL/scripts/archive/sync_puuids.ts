import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fetchPuuidByRiotId } from '../src/lib/riot';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) throw new Error("Missing RIOT_API_KEY");

  // ktm_players から ign があるが puuid がないものを取得
  const { data: players, error } = await supabase
    .from('ktm_players')
    .select('*')
    .not('ign', 'is', null);

  if (error || !players) {
    console.error("No players found or error", error);
    return;
  }

  console.log(`Found ${players.length} players with IGN.`);

  for (const p of players) {
    if (p.puuid) {
      console.log(`Skipping ${p.name} (PUUID already exists)`);
      continue;
    }

    try {
      const [gameName, tagLine] = p.ign.split('#');
      if (!gameName || !tagLine) {
         console.log(`Skipping ${p.name} - Invalid IGN format: ${p.ign}`);
         continue;
      }
      const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
      await supabase.from('ktm_players').update({ puuid }).eq('id', p.id);
      console.log(`Updated PUUID for ${p.name} (${p.ign}): ${puuid}`);
    } catch (e: any) {
      console.error(`Failed to fetch PUUID for ${p.ign}: ${e.message}`);
    }
    
    // Wait slightly to respect rate limits
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log("PUUID Sync complete!");
}

run().catch(console.error);
