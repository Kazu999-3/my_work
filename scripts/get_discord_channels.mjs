import fs from 'fs';

// 04_PORTAL/.env.local から BOT トークンを取得
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
if (!botToken) {
  console.error('DISCORD_BOT_TOKEN not found');
  process.exit(1);
}

async function getChannelTree() {
  const seedChannelId = '1528646515533287497'; // #定期カスタム募集
  console.log(`Resolving Guild ID from seed channel ${seedChannelId}...`);
  const seedRes = await fetch(`https://discord.com/api/v10/channels/${seedChannelId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!seedRes.ok) {
    throw new Error(`Failed to fetch seed channel: ${seedRes.status} ${await seedRes.text()}`);
  }
  const seedChannel = await seedRes.json();
  const guildId = seedChannel.guild_id;
  console.log(`Guild ID: ${guildId}`);

  // サーバー情報取得
  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  const guildData = await guildRes.json();
  console.log(`Guild Name: ${guildData.name}`);

  // 全チャンネル取得
  const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!channelsRes.ok) {
    throw new Error(`Failed to fetch channels: ${channelsRes.status} ${await channelsRes.text()}`);
  }
  const channels = await channelsRes.json();

  // type定義
  // 0: GUILD_TEXT
  // 2: GUILD_VOICE
  // 4: GUILD_CATEGORY
  // 5: GUILD_ANNOUNCEMENT
  // 15: GUILD_FORUM
  const typeMap = {
    0: '💬 TEXT',
    2: '🔊 VOICE',
    4: '📁 CATEGORY',
    5: '📢 ANNOUNCE',
    13: 'ステージ',
    15: '💡 FORUM',
  };

  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const uncategorized = channels.filter((c) => !c.parent_id && c.type !== 4).sort((a, b) => a.position - b.position);

  console.log(`\n=== サーバー: ${guildData.name} (全 ${channels.length} チャンネル) ===\n`);

  if (uncategorized.length > 0) {
    console.log(`【カテゴリなし】`);
    for (const c of uncategorized) {
      console.log(`  - [${typeMap[c.type] || c.type}] ${c.name} (ID: ${c.id})`);
    }
    console.log('');
  }

  for (const cat of categories) {
    console.log(`📁 【${cat.name}】 (ID: ${cat.id}, pos: ${cat.position})`);
    const children = channels.filter((c) => c.parent_id === cat.id).sort((a, b) => a.position - b.position);
    if (children.length === 0) {
      console.log(`  (チャンネルなし)`);
    } else {
      for (const child of children) {
        console.log(`  - [${typeMap[child.type] || child.type}] ${child.name} (ID: ${child.id})`);
      }
    }
    console.log('');
  }
}

getChannelTree().catch(console.error);
