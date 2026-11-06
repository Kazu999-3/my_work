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
  const { data: allPlayers } = await supabase.from('ktm_players').select('*');
  
  // 参加者の直近試合日と総試合数を調べる
  let allParts = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data: chunk } = await supabase.from('ktm_match_participants').select('discord_id, player_name, created_at').range(from, from + step - 1);
    if (!chunk || chunk.length === 0) break;
    allParts = allParts.concat(chunk);
    if (chunk.length < step) break;
    from += step;
  }

  // プレイヤーごとの試合数と最終参加日
  const statsByDiscordId = {};
  const statsByName = {};

  allParts.forEach(p => {
    if (p.discord_id) {
      if (!statsByDiscordId[p.discord_id]) statsByDiscordId[p.discord_id] = { count: 0, lastDate: p.created_at };
      statsByDiscordId[p.discord_id].count++;
      if (p.created_at > statsByDiscordId[p.discord_id].lastDate) statsByDiscordId[p.discord_id].lastDate = p.created_at;
    }
    if (p.player_name) {
      const nameKey = p.player_name.trim().toLowerCase();
      if (!statsByName[nameKey]) statsByName[nameKey] = { count: 0, lastDate: p.created_at };
      statsByName[nameKey].count++;
      if (p.created_at > statsByName[nameKey].lastDate) statsByName[nameKey].lastDate = p.created_at;
    }
  });

  const now = new Date('2026-11-04T00:00:00Z');
  const daysAgo = (dateStr) => {
    if (!dateStr) return 999;
    return Math.floor((now - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  };

  const categories = {
    never_low: 0,      // 未参加・ゴールド以下 (22名)
    never_plat: 0,     // 未参加・プラチナ (8名)
    rare_players: 0,   // 通算1〜3試合のみ (お試し離脱層)
    dormant_players: 0,// 過去に参加したが直近30日以上参加なし (休眠層)
    active_core: 0     // 直近30日以内に参加している現役層
  };

  const listRare = [];
  const listDormant = [];

  allPlayers.forEach(p => {
    const sId = p.discord_id ? statsByDiscordId[p.discord_id] : null;
    const sName = p.name ? statsByName[p.name.trim().toLowerCase()] : null;
    const count = Math.max(sId?.count || 0, sName?.count || 0, (p.games_top||0)+(p.games_jg||0)+(p.games_mid||0)+(p.games_adc||0)+(p.games_sup||0));
    const lastDate = sId?.lastDate || sName?.lastDate || null;
    const days = daysAgo(lastDate);

    const rank = (p.highest_rank || '').toUpperCase();
    const isLow = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'UNRANKED'].some(r => rank.includes(r)) || !rank;

    if (count === 0) {
      if (isLow) categories.never_low++;
      else categories.never_plat++;
    } else {
      if (days > 30) {
        categories.dormant_players++;
        listDormant.push({ name: p.name, rank: p.highest_rank, count, days });
      } else {
        categories.active_core++;
      }
      if (count <= 3) {
        categories.rare_players++;
        listRare.push({ name: p.name, rank: p.highest_rank, count, days });
      }
    }
  });

  console.log('集計結果:', categories);
  console.log('休眠層（30日以上未参加）件数:', listDormant.length);
  console.log('お試し層（通算1〜3試合）件数:', listRare.length);
}
run();
