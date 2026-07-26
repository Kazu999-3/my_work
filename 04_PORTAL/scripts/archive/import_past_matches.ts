import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// .env.local をロード
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const filePath = path.join(__dirname, 'past_matches.tsv');
  const tsv = fs.readFileSync(filePath, 'utf-8');
  
  const lines = tsv.trim().split('\n');
  const header = lines[0].split('\t');
  const dataLines = lines.slice(1);

  let successCount = 0;

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = line.split('\t');

    let rawDate = cols[0];
    // "3/27" のようなフォーマットを "2026-03-27T00:00:00" などに変換
    if (rawDate.match(/^\d{1,2}\/\d{1,2}$/)) {
      rawDate = `2026/${rawDate} 00:00:00`;
    }
    const createdAt = new Date(rawDate).toISOString();
    
    const winningTeam = cols[1]; // "BLUE" or "RED"
    
    // 1. Matchesにインサート
    const { data: matchData, error: mError } = await supabase
      .from('ktm_matches')
      .insert({
        winning_team: winningTeam,
        created_at: createdAt,
        game_duration: 0
      })
      .select('id')
      .single();

    if (mError || !matchData) {
      console.error(`Failed to insert match at ${createdAt}:`, mError?.message);
      continue;
    }

    const matchId = matchData.id;

    // カラムマッピング
    // [2]=TOP(B) [3]=KDA [4]=増減
    // [5]=TOP(R) [6]=KDA [7]=増減
    // [8]=JG(B)  [9]=KDA [10]=増減
    // [11]=JG(R) [12]=KDA [13]=増減
    // [14]=MID(B) [15]=KDA [16]=増減
    // [17]=MID(R) [18]=KDA [19]=増減
    // [20]=ADC(B) [21]=KDA [22]=増減
    // [23]=ADC(R) [24]=KDA [25]=増減
    // [26]=SUP(B) [27]=KDA [28]=増減
    // [29]=SUP(R) [30]=KDA [31]=増減

    const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
    const participants = [];

    for (let i = 0; i < 5; i++) {
      const baseIdxB = 2 + (i * 6);
      const baseIdxR = 5 + (i * 6);

      // BLUE
      participants.push({
        match_id: matchId,
        team: 'BLUE',
        role: roles[i],
        player_name: cols[baseIdxB],
        kda_score: parseFloat(cols[baseIdxB + 1]) || 0,
        mmr_delta: parseInt(cols[baseIdxB + 2].replace('+', '')) || 0,
        kills: 0, deaths: 0, assists: 0, vision_score: 0
      });

      // RED
      participants.push({
        match_id: matchId,
        team: 'RED',
        role: roles[i],
        player_name: cols[baseIdxR],
        kda_score: parseFloat(cols[baseIdxR + 1]) || 0,
        mmr_delta: parseInt(cols[baseIdxR + 2].replace('+', '')) || 0,
        kills: 0, deaths: 0, assists: 0, vision_score: 0
      });
    }

    // 2. Participantsにインサート
    const { error: pError } = await supabase
      .from('ktm_match_participants')
      .insert(participants);
      
    if (pError) {
      console.error(`Failed to insert participants for match ${matchId}:`, pError.message);
    } else {
      successCount++;
      console.log(`Inserted match at ${createdAt} (${winningTeam} WIN) with 10 participants.`);
    }
  }

  console.log(`\nImport complete! Successfully imported ${successCount} matches.`);
}

main().catch(console.error);
