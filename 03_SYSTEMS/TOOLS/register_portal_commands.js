const fs = require('fs');

async function main() {
  let token = process.env.DISCORD_TOKEN;
  if (!token && fs.existsSync('03_SYSTEMS/ktm_bot/.dev.vars')) {
    const envStr = fs.readFileSync('03_SYSTEMS/ktm_bot/.dev.vars', 'utf-8');
    const match = envStr.match(/DISCORD_TOKEN="?([^\r\n"]+)/);
    if (match) token = match[1];
  }

  const meRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` }
  });
  const me = await meRes.json();
  const appId = me.id;
  const guildId = '1485636149379858567';

  const commandsToRegister = [
    {
      name: 'portal',
      description: 'KTM プレイヤーズハブ ＆ 統合コントロールパネルを表示します'
    },
    {
      name: 'welcome',
      description: '新規メンバー案内 ＆ 統合コントロールパネルを表示します'
    }
  ];

  for (const cmd of commandsToRegister) {
    console.log(`Registering /${cmd.name} to Guild ${guildId}...`);
    const res = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cmd)
    });
    const data = await res.json();
    console.log(`Result for /${cmd.name}:`, res.status, data.name || data);
  }
}

main().catch(console.error);
