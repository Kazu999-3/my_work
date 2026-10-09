import fs from 'fs';
const envText = fs.readFileSync('04_PORTAL/.env.local', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').replace(/^"|"$/g, '').trim();
}
const res = await fetch('https://discord.com/api/v10/guilds/1485636149379858567', {
  headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN }
});
const g = await res.json();
console.log('Guild features:', g.features);
console.log('Is COMMUNITY:', g.features.includes('COMMUNITY'));
