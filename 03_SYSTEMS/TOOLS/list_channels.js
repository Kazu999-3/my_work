const fs = require('fs');

async function main() {
  let token = process.env.DISCORD_TOKEN;
  if (!token && fs.existsSync('03_SYSTEMS/ktm_bot/.dev.vars')) {
    const envStr = fs.readFileSync('03_SYSTEMS/ktm_bot/.dev.vars', 'utf-8');
    const match = envStr.match(/DISCORD_TOKEN="?([^\r\n"]+)/);
    if (match) token = match[1];
  }

  const guildId = '1485636149379858567';
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${token}` }
  });
  const channels = await res.json();
  if (Array.isArray(channels)) {
    console.log('=== Guild Channels ===');
    channels.forEach(ch => {
      console.log(`[${ch.type}] ${ch.name} (ID: ${ch.id})`);
    });
  } else {
    console.log(channels);
  }
}

main().catch(console.error);
