import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const RIOT_API_BASE_ASIA = "https://asia.api.riotgames.com";

async function fetchMatchDetails(matchId: string, apiKey: string) {
  const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/${matchId}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Riot API error ${res.statusText}`);
  return await res.json();
}

async function run() {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) throw new Error("Missing RIOT_API_KEY");

  // 1. ktm_matchesからriot_match_idがあるものを取得
  const { data: matches, error } = await supabase
    .from('ktm_matches')
    .select('*, ktm_match_participants(*)')
    .not('riot_match_id', 'is', null);

  if (error || !matches) {
    console.error("No matches found or error", error);
    return;
  }

  console.log(`Found ${matches.length} matches to backfill`);

  for (const match of matches) {
    console.log(`Processing match ${match.riot_match_id} (KTM Match ID: ${match.id})`);
    
    try {
      const riotDetails = await fetchMatchDetails(match.riot_match_id, apiKey);
      
      for (const p of match.ktm_match_participants) {
        // Find corresponding player in Riot participants using simple matching
        const riotP = riotDetails.info.participants.find((rp: any) => {
          const isRed = rp.teamId === 200;
          const dbIsRed = p.team === 'RED';
          if (isRed !== dbIsRed) return false;

          const dbRole = p.role.toUpperCase();
          const rpLane = (rp.teamPosition || rp.lane).toUpperCase();
          if (dbRole === 'TOP' && rpLane.includes('TOP')) return true;
          if (dbRole === 'JG' && rpLane.includes('JUNGLE')) return true;
          if (dbRole === 'MID' && rpLane.includes('MIDDLE')) return true;
          if (dbRole === 'ADC' && rpLane.includes('BOTTOM')) return true;
          if (dbRole === 'SUP' && rpLane.includes('UTILITY')) return true;
          
          return false;
        });

        if (riotP && riotP.championName) {
          // Update DB
          await supabase
            .from('ktm_match_participants')
            .update({ champion_name: riotP.championName })
            .eq('id', p.id);
          console.log(`  Updated participant ${p.player_name} -> ${riotP.championName}`);
        }
      }
    } catch (e: any) {
      console.error(`Failed to process match ${match.riot_match_id}: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000)); // Sleep on error to avoid rate limits
    }
    
    // Wait slightly to respect rate limits (20 requests per second, 100 per 2 minutes)
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log("Backfill complete!");
}

run().catch(console.error);
