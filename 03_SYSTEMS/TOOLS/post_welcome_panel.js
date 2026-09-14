const fs = require('fs');

async function main() {
  let token = process.env.DISCORD_TOKEN;
  if (!token && fs.existsSync('03_SYSTEMS/ktm_bot/.dev.vars')) {
    const envStr = fs.readFileSync('03_SYSTEMS/ktm_bot/.dev.vars', 'utf-8');
    const match = envStr.match(/DISCORD_TOKEN="?([^\r\n"]+)/);
    if (match) token = match[1];
  }

  const welcomeChannelId = '1485646544043642964'; // 📍はじめに
  const lastMessageId = '1549113148248817666'; // 直前の投稿
  const portalUrl = 'https://ktm-portal.vercel.app';

  const content = `# 👑 KTM LoL部 へようこそ！
> 仕事終わりのLoLに「心地よい熱狂」と「大人の語らい」を。
> 本サーバーは社会人のためのサードプレイスを目指しています！

---

### 🚀 はじめの3ステップ
1️⃣ **自己紹介をする**
   まずは <#1485646578621616209> でテンプレに沿って挨拶をお願いします！（確認次第、全チャンネルが開放されます）

2️⃣ **サモナー名 ＆ 希望レーンを登録する**
   下の **「🎮 サモナー名 ＆ 希望レーン登録」** ボタンから一括設定！（未登録の方も自動で名簿作成・初期MMR・ランク同期が行われます）

3️⃣ **カスタム・募集に参加する**
   - **都度募集**: <#1485995531434987541> にて自由に募集・参加OK！
   - **週末定期カスタム**: 毎週土日 21:00〜 <#1528646515533287497> にて開催！

---

### ⚔️ 週末定期カスタム（毎週土日 21:00〜）
- 🛡️ **土曜日（真剣勝負 / MMRあり）**
  【開催＆人数ルール】
  ・**20名〜**: 上位/下位の2部屋同時開催
  ・**10〜19名**: 1ティア差の10名で開催（他は観戦/2戦目交代）
  ・**当日19時時点で7名以下**: 中止
- 🎪 **日曜日（お祭りカスタム / MMR変動なし）**
  ランク不問・初心者歓迎！1戦だけのスポット参加や途中抜けも自由です。

---

### 📜 サーバールール
- 暴言・一方的な指摘は厳禁（親しき仲にも礼儀あり）
- 社会人としての良識を持って楽しくプレイ
- 試合後は「次はどうすれば楽しく勝てるか」を建設的に！`;

  const components = [
    {
      type: 1,
      components: [
        { type: 2, label: "🎮 サモナー名 ＆ 希望レーン登録", style: 3, custom_id: "portal_register" },
        { type: 2, label: "⚔️ メンバー募集開始", style: 1, custom_id: "portal_recruit" }
      ]
    },
    {
      type: 1,
      components: [
        { type: 2, label: "⚡ ノーマル5 即募集", style: 2, custom_id: "quick_recruit:ノーマル:5" },
        { type: 2, label: "⚡ カスタム10 即募集", style: 2, custom_id: "quick_recruit:カスタム:10" }
      ]
    },
    {
      type: 1,
      components: [
        { type: 2, label: "🔔 募集通知 (ON/OFF)", style: 2, custom_id: "toggle_recruit_notification" },
        { type: 2, label: "📖 詳しい機能・使い方はこちら", style: 5, url: `${portalUrl}/guide` }
      ]
    }
  ];

  console.log(`Updating message in #はじめに (${welcomeChannelId}) ...`);
  
  // まず直前のメッセージを編集更新してみる
  let res = await fetch(`https://discord.com/api/v10/channels/${welcomeChannelId}/messages/${lastMessageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: content,
      components: components
    })
  });

  if (res.ok) {
    console.log(`SUCCESS: Message edited successfully (Message ID: ${lastMessageId})`);
  } else {
    // 編集できなかった場合は新規投稿
    console.log(`Patch failed (${res.status}), posting as new message...`);
    res = await fetch(`https://discord.com/api/v10/channels/${welcomeChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content,
        components: components
      })
    });
    const msg = await res.json();
    console.log(`SUCCESS: New message posted (Message ID: ${msg.id})`);
  }
}

main().catch(console.error);
