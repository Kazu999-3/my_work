import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raw = fs.readFileSync('d:/my_work/05_PILOT/.env.local', 'utf-8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: allPlayers, error: pErr } = await supabase.from('ktm_players').select('*');
  if (pErr) return console.error(pErr);

  // ktm_match_participants から参加履歴のある discord_id と player_name を抽出
  // レコード数が多い場合は全件取得
  let allParts = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data: partChunk, error: partErr } = await supabase
      .from('ktm_match_participants')
      .select('discord_id, player_name')
      .range(from, from + step - 1);
    if (partErr) {
      console.error(partErr);
      break;
    }
    allParts = allParts.concat(partChunk);
    if (partChunk.length < step) break;
    from += step;
  }

  const participatedDiscordIds = new Set();
  const participatedNames = new Set();
  allParts.forEach(p => {
    if (p.discord_id) participatedDiscordIds.add(p.discord_id);
    if (p.player_name) participatedNames.add(p.player_name.trim().toLowerCase());
  });

  console.log(`総登録者数: ${allPlayers.length}名`);
  console.log(`総試合参加レコード数: ${allParts.length}件`);

  const ranks = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'UNRANKED'];
  
  const participatedList = [];
  const unparticipatedList = [];

  for (const player of allPlayers) {
    const totalLaneGames = (player.games_top || 0) + (player.games_jg || 0) + (player.games_mid || 0) + (player.games_adc || 0) + (player.games_sup || 0);
    const hasMatchRecord = (player.discord_id && participatedDiscordIds.has(player.discord_id)) ||
                           (player.name && participatedNames.has(player.name.trim().toLowerCase()));
    
    const hasParticipated = totalLaneGames > 0 || hasMatchRecord;

    let rawRank = (player.highest_rank || '').toUpperCase();
    let normRank = ranks.find(r => rawRank.includes(r)) || 'UNRANKED';

    const info = {
      id: player.id,
      name: player.name,
      ign: player.ign,
      discord_id: player.discord_id,
      highest_rank: player.highest_rank || 'UNRANKED',
      normRank,
      mmr: player.mmr,
      totalLaneGames,
      hasMatchRecord,
      is_active: player.is_active
    };

    if (hasParticipated) {
      participatedList.push(info);
    } else {
      unparticipatedList.push(info);
    }
  }

  console.log(`\n【全体集計】`);
  console.log(`参加経験あり: ${participatedList.length}名`);
  console.log(`未参加（0試合）: ${unparticipatedList.length}名`);

  console.log(`\n【未参加者のランク分布】`);
  const unpartRankCount = {};
  unparticipatedList.forEach(p => {
    unpartRankCount[p.normRank] = (unpartRankCount[p.normRank] || 0) + 1;
  });
  ranks.forEach(r => {
    if (unpartRankCount[r]) {
      console.log(`  - ${r}: ${unpartRankCount[r]}名`);
    }
  });

  const lowRanks = ['IRON', 'BRONZE', 'SILVER', 'GOLD'];
  const unpartLow = unparticipatedList.filter(p => lowRanks.includes(p.normRank));
  const unpartUnranked = unparticipatedList.filter(p => p.normRank === 'UNRANKED');

  console.log(`\n【結論】`);
  console.log(`未参加 かつ ゴールド以下（IRON〜GOLD）: ${unpartLow.length}名`);
  console.log(`未参加 かつ UNRANKED: ${unpartUnranked.length}名`);
  console.log(`合計（UNRANKED含む）: ${unpartLow.length + unpartUnranked.length}名`);

  console.log(`\n【未参加 かつ ゴールド以下の一覧 (${unpartLow.length}名)】`);
  unpartLow.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.name} (${p.ign || 'IGN未登録'}) - ランク: ${p.highest_rank} (MMR: ${p.mmr})`);
  });

  if (unpartUnranked.length > 0) {
    console.log(`\n【未参加 かつ UNRANKED (${unpartUnranked.length}名)】`);
    unpartUnranked.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name} (${p.ign || 'IGN未登録'}) - ランク: ${p.highest_rank} (MMR: ${p.mmr})`);
    });
  }
}
run();
