import fs from 'fs';

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
  const content = fs.readFileSync(path, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || '').trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env1 = parseEnv('04_PORTAL/.env.local');
const env2 = parseEnv('.env');
const env3 = parseEnv('03_SYSTEMS/ktm_bot/.dev.vars');
const env = { ...env2, ...env1, ...env3 };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

async function fetchTable(table, query = '') {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  return await res.json();
}

async function updatePlayer(id, data) {
  const res = await fetch(`${supabaseUrl}/rest/v1/ktm_players?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  return res.ok;
}

async function main() {
  const players = await fetchTable('ktm_players', 'select=id,name,ign,coins,role_preferences,metadata&order=id.asc&limit=1000');
  
  console.log(`Starting Coin Restoration for ${players.length} players...`);
  let restoredCount = 0;

  for (const p of players) {
    let prefCoins = null;
    let metaCoins = null;
    try {
      const pref = typeof p.role_preferences === 'string' ? JSON.parse(p.role_preferences) : p.role_preferences;
      prefCoins = typeof pref?.coins === 'number' ? pref.coins : null;
    } catch (e) {}
    try {
      const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
      metaCoins = typeof meta?.coins === 'number' ? meta.coins : null;
    } catch (e) {}

    const colCoins = typeof p.coins === 'number' ? p.coins : 1000;
    
    // role_preferences または metadata に有効なコイン記録があればそれを取得（Prefを優先、なければMeta）
    let targetCoins = colCoins;
    if (prefCoins !== null && prefCoins !== 1000) {
      targetCoins = prefCoins;
    } else if (metaCoins !== null && metaCoins !== 1000) {
      targetCoins = metaCoins;
    } else if (prefCoins !== null) {
      targetCoins = prefCoins;
    } else if (metaCoins !== null) {
      targetCoins = metaCoins;
    }

    // 1000固定から本来の値へ復元が必要な場合
    if (targetCoins !== colCoins || colCoins === 1000) {
      const bestCoins = Math.max(targetCoins, prefCoins ?? 0, metaCoins ?? 0, 1000);
      // カジノ等で1000未満になった記録（gori:590, けんち:330）も正しく維持
      const finalCoins = (prefCoins !== null && prefCoins < 1000) ? prefCoins : bestCoins;

      if (finalCoins !== colCoins) {
        console.log(`[RESTORE] ID:${p.id} ${p.name}: ${colCoins} -> ${finalCoins} (Pref:${prefCoins}, Meta:${metaCoins})`);
        const ok = await updatePlayer(p.id, { coins: finalCoins });
        if (ok) restoredCount++;
      }
    }
  }

  console.log(`\nSuccessfully restored coins for ${restoredCount} players!`);
}

main().catch(console.error);
