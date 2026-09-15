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

async function main() {
  const players = await fetchTable('ktm_players', 'select=id,name,ign,discord_id,coins,role_preferences,metadata&order=id.asc&limit=1000');
  
  console.log('=== Coin Restoration Audit ===');
  const updates = [];

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
    
    // 過去のJSONに保存されていた実際のコイン値（1000以外の記録があればそれを優先）
    const legacyCoins = metaCoins !== null ? metaCoins : (prefCoins !== null ? prefCoins : null);
    
    const trueCoins = Math.max(colCoins, metaCoins ?? 0, prefCoins ?? 0, 1000);
    // もし過去に1000より少ない値（カジノ等で負けて減った記録）があればそれも考慮
    const actualRestored = legacyCoins !== null ? legacyCoins : colCoins;

    if (actualRestored !== colCoins) {
      console.log(`[RESTORE CANDIDATE] ID:${p.id} ${p.name} (ign:${p.ign}): Current Col=${colCoins} -> Legacy (Meta:${metaCoins}, Pref:${prefCoins}) => Restoring to: ${actualRestored}`);
      updates.push({ id: p.id, name: p.name, current: colCoins, restored: actualRestored });
    }
  }

  console.log(`\nFound ${updates.length} players who lost their coin records due to column default overwrite.`);
}

main().catch(console.error);
