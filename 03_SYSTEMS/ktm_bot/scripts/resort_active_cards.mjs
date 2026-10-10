import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractEntryLines, parseEntryBreakdown } from '../src/utils/recruitmentStatus.js';
import { applyDayCardState } from '../src/ui/embeds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../../04_PORTAL/.env.local');
const dotenv = fs.readFileSync(envPath, 'utf8');
const tokenMatch = dotenv.match(/DISCORD_BOT_TOKEN=(.+)/);
if (!tokenMatch) {
  console.error('Bot Token not found in .env.local');
  process.exit(1);
}
const token = tokenMatch[1].trim().replace(/^['"]|['"]$/g, '');

const channelId = '1528646515533287497';
const messageConfigs = [
  { dayKey: 'sat', dayName: '土曜本戦', id: '1557226263897440287' },
  { dayKey: 'sun', dayName: '日曜お祭り', id: '1557226282595524649' }
];

async function updateCards() {
  for (const { dayKey, dayName, id } of messageConfigs) {
    console.log(`\n========================================`);
    console.log(`[${dayName}] メッセージID: ${id}`);
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${id}`, {
      headers: { Authorization: `Bot ${token}` }
    });
    if (!res.ok) {
      console.error(`取得失敗: ${res.status} ${await res.text()}`);
      continue;
    }
    const msg = await res.json();
    if (!msg.embeds || msg.embeds.length === 0) {
      console.log(`Embedが見つかりません`);
      continue;
    }

    const currentEmbed = msg.embeds[0];
    const fieldValue = currentEmbed.fields?.[0]?.value || '';
    const entryLines = extractEntryLines(fieldValue);
    console.log(`現在の参加者 (${entryLines.length}名):`);
    entryLines.forEach(l => console.log(`  ${l}`));

    const targetEmbed = { ...currentEmbed };
    applyDayCardState(targetEmbed, dayKey, entryLines);

    console.log(`\n更新後の名簿フィールド:`);
    console.log(targetEmbed.fields?.[0]?.value);

    const patchRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ embeds: [targetEmbed] })
    });

    if (patchRes.ok) {
      console.log(`✅ [${dayName}] Discord更新成功 (HTTP ${patchRes.status})`);
    } else {
      console.error(`❌ [${dayName}] Discord更新失敗: ${patchRes.status} ${await patchRes.text()}`);
    }
  }
}

updateCards().catch(err => {
  console.error('予期せぬエラー:', err);
  process.exit(1);
});
