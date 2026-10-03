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
const kenchiDiscordId = '864797647072002059';

if (!botToken) {
  console.error('DISCORD_BOT_TOKEN not found');
  process.exit(1);
}

async function sendDM() {
  console.log(`Creating DM channel with user ${kenchiDiscordId}...`);
  // 1. DMチャンネルの作成/取得
  const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: kenchiDiscordId }),
  });

  if (!channelRes.ok) {
    const errText = await channelRes.text();
    throw new Error(`Failed to create DM channel: ${channelRes.status} ${errText}`);
  }

  const channel = await channelRes.json();
  console.log(`DM Channel ID: ${channel.id}`);

  // 2. メッセージ送信
  const messageContent = `【KTM運営より 週末メガ宝くじの当選結果に関するご案内】

けんちさん、いつもKTMをご利用いただきありがとうございます！

先週（9月27日）の週末メガ宝くじ抽選において、Discordチャンネル内の結果通知に「+1,000コイン」と誤った固定数値が表示されておりました。

実際のシステム仕様・計算では、
・**2等（ラッキー賞）**: 総売上の10%（70コイン）
・**3等（参加還元賞）**: ご購入3口分のキャッシュバック（90コイン）
の合計 **【160コイン】** が計算通りにアカウント残高へ付与されておりました。

通知メッセージの表記の不具合により、ご心配やご不便をおかけしてしまい誠に申し訳ございませんでした。
通知の表記バグにつきましては先ほど修正を完了いたしました。

なお、けんちさんが現在所持されている今週分の宝くじチケット（7口）につきましては、**今夜（日曜日）22:00** の定期抽選にて抽選が行われますので、引き続きよろしくお願いいたします！`;

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: messageContent }),
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`Failed to send DM: ${msgRes.status} ${errText}`);
  }

  const msg = await msgRes.json();
  console.log('✅ DM sent successfully! Message ID:', msg.id);
}

sendDM().catch(console.error);
