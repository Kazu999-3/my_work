const fs = require('fs');

async function main() {
  let token = process.env.DISCORD_TOKEN;
  if (!token && fs.existsSync('03_SYSTEMS/ktm_bot/.dev.vars')) {
    const envStr = fs.readFileSync('03_SYSTEMS/ktm_bot/.dev.vars', 'utf-8');
    const match = envStr.match(/DISCORD_TOKEN="?([^\r\n"]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    console.error('No token found');
    return;
  }

  const meRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` }
  });
  const me = await meRes.json();
  console.log(`Bot: ${me.username} (AppId: ${me.id})`);
  const appId = me.id;

  // Global commands
  const glbRes = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    headers: { Authorization: `Bot ${token}` }
  });
  const glb = await glbRes.json();
  console.log('\n=== Global Slash Commands ===');
  if (Array.isArray(glb)) {
    glb.forEach(c => console.log(`/${c.name} - ${c.description}`));
  } else {
    console.log(glb);
  }

  // Guilds
  const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bot ${token}` }
  });
  const guilds = await guildsRes.json();
  if (Array.isArray(guilds)) {
    for (const g of guilds) {
      const gCmdRes = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${g.id}/commands`, {
        headers: { Authorization: `Bot ${token}` }
      });
      const gCmds = await gCmdRes.json();
      console.log(`\n=== Guild Commands for ${g.name} (${g.id}) ===`);
      if (Array.isArray(gCmds)) {
        gCmds.forEach(c => console.log(`/${c.name} - ${c.description}`));
      } else {
        console.log(gCmds);
      }
    }
  }
}

main().catch(console.error);
