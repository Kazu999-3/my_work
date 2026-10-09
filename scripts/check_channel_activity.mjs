import fs from 'fs';

const envText = fs.readFileSync('04_PORTAL/.env.local', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const botToken = env.DISCORD_BOT_TOKEN;

async function checkActivity() {
  const guildId = '1485636149379858567';
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  const channels = await res.json();
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5); // TEXT, ANNOUNCE

  console.log(`Checking activity for ${textChannels.length} text channels...\n`);

  for (const c of textChannels) {
    try {
      const msgRes = await fetch(`https://discord.com/api/v10/channels/${c.id}/messages?limit=1`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (!msgRes.ok) {
        console.log(`[${c.name}] HTTP ${msgRes.status} (権限なし等)`);
        continue;
      }
      const msgs = await msgRes.json();
      if (msgs.length === 0) {
        console.log(`[${c.name}] メッセージなし (空)`);
      } else {
        const last = msgs[0];
        const date = new Date(last.timestamp);
        const jst = date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const author = last.author?.username || '不明';
        const isBot = last.author?.bot ? '🤖Bot' : '👤人';
        const snippet = (last.content || '').slice(0, 30).replace(/\n/g, ' ');
        console.log(`[${c.name}] 最終: ${jst} by ${isBot}(${author}) - "${snippet}"`);
      }
    } catch (err) {
      console.log(`[${c.name}] エラー: ${err.message}`);
    }
  }
}

checkActivity().catch(console.error);
