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

async function fetchCustomMatchIds(puuid: string, apiKey: string): Promise<string[]> {
  const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=100&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Riot API error (match IDs): ${res.statusText}`);
  }
  return await res.json();
}

async function fetchMatchDetails(matchId: string, apiKey: string) {
  const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/${matchId}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Riot API error (match details): ${res.statusText}`);
  }
  return await res.json();
}

async function run() {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) throw new Error("Missing RIOT_API_KEY");

  // 1. Get all matches without champion_name
  const { data: dbMatches, error } = await supabase
    .from('ktm_matches')
    .select('*, ktm_match_participants(*)');

  if (error || !dbMatches) {
    console.error("Error fetching db matches", error);
    return;
  }

  // 2. Filter matches that need backfill
  const matchesToProcess = dbMatches.filter(m => 
    m.ktm_match_participants.some((p: any) => p.champion_name === null)
  );

  console.log(`Found ${matchesToProcess.length} DB matches to backfill.`);

  // 3. Get all players with PUUID
  const { data: players } = await supabase.from('ktm_players').select('*').not('puuid', 'is', null);
  if (!players || players.length === 0) {
    console.log("No players with PUUID found.");
    return;
  }
  
  // Create mapping of name -> puuid for easy matching
  const nameToPuuid: Record<string, string> = {};
  players.forEach((p: any) => nameToPuuid[p.name] = p.puuid);

  // 4. Try to find Riot Match for each DB match
  for (const m of matchesToProcess) {
    console.log(`\nProcessing DB Match ${m.id} (Date: ${m.created_at})`);
    
    // Find a participant in this match who has a PUUID
    const participantWithPuuid = m.ktm_match_participants.find((p: any) => nameToPuuid[p.player_name]);
    if (!participantWithPuuid) {
      console.log(`  No participant with PUUID found for this match. Skipping.`);
      continue;
    }

    const puuid = nameToPuuid[participantWithPuuid.player_name];
    console.log(`  Fetching Riot matches for ${participantWithPuuid.player_name} (PUUID: ${puuid})...`);
    
    try {
      const riotMatchIds = await fetchCustomMatchIds(puuid, apiKey);
      let foundRiotMatch = null;

      for (const riotId of riotMatchIds) {
        const details = await fetchMatchDetails(riotId, apiKey);
        if (!details) continue;

        // Compare participants to see if it's the same match
        // Count how many DB participants exist in the Riot match
        let matchCount = 0;
        for (const p of m.ktm_match_participants) {
           const pPuuid = nameToPuuid[p.player_name];
           if (pPuuid) {
               const exists = details.info.participants.some((rp: any) => rp.puuid === pPuuid);
               if (exists) matchCount++;
           }
        }
        
        // If at least 3 people from the DB match are in this Riot match, it's highly likely the same one
        if (matchCount >= Math.min(3, m.ktm_match_participants.filter((p: any) => nameToPuuid[p.player_name]).length)) {
          foundRiotMatch = details;
          break;
        }
      }

      if (foundRiotMatch) {
        console.log(`  Matched with Riot Match ID: ${foundRiotMatch.metadata.matchId}`);
        
        // Save Riot Match ID to DB (if column exists)
        await supabase.from('ktm_matches').update({ riot_match_id: foundRiotMatch.metadata.matchId }).eq('id', m.id);

        // Update champion names
        for (const p of m.ktm_match_participants) {
          const pPuuid = nameToPuuid[p.player_name];
          let riotP = null;
          
          if (pPuuid) {
            riotP = foundRiotMatch.info.participants.find((rp: any) => rp.puuid === pPuuid);
          } else {
             // Fallback to lane matching
             riotP = foundRiotMatch.info.participants.find((rp: any) => {
                const dbRole = p.role.toUpperCase();
                const rpLane = (rp.teamPosition || rp.lane).toUpperCase();
                if (dbRole === 'TOP' && rpLane.includes('TOP')) return true;
                if (dbRole === 'JG' && rpLane.includes('JUNGLE')) return true;
                if (dbRole === 'MID' && rpLane.includes('MIDDLE')) return true;
                if (dbRole === 'ADC' && rpLane.includes('BOTTOM')) return true;
                if (dbRole === 'SUP' && rpLane.includes('UTILITY')) return true;
                return false;
             });
          }

          if (riotP && riotP.championName) {
            let mappedRole = p.role;
            const tp = (riotP.teamPosition || riotP.lane || "").toUpperCase();
            if (tp.includes("TOP")) mappedRole = "TOP";
            else if (tp.includes("JUNGLE")) mappedRole = "JG";
            else if (tp.includes("MIDDLE") || tp.includes("MID")) mappedRole = "MID";
            else if (tp.includes("BOTTOM")) mappedRole = "ADC";
            else if (tp.includes("UTILITY")) mappedRole = "SUP";

            await supabase.from('ktm_match_participants').update({ 
              champion_name: riotP.championName,
              role: mappedRole
            }).eq('id', p.id);
            console.log(`    Updated ${p.player_name} -> ${riotP.championName} (${mappedRole})`);
          }
        }
      } else {
        console.log(`  Could not find matching Riot match.`);
      }

    } catch (e: any) {
       console.error(`  Error: ${e.message}`);
    }

    // Wait slightly
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("Smart Backfill complete!");
}

run().catch(console.error);
