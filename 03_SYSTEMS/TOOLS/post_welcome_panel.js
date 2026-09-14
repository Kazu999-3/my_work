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
  const portalUrl = 'https://my-work-8jbd.vercel.app';

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
   ※募集時の通知（メンション）を受け取りたい/止めたい場合は、下の **「🔔 募集通知 (ON/OFF)」** ボタンでいつでもワンタップ切替可能です。

---

### ⚔️ 週末定期カスタム（毎週土日 21:00〜）
💡 **土日ともに1戦のみのスポット参加・途中参加・途中抜けOK！**（10名を超えた場合も交代しながら全員で回します）

- 🛡️ **土曜日（真剣勝負 / MMRあり）**
  【開催＆人数ルール】
  ・**20名〜**: 上位/下位の2部屋同時開催
  ・**10〜19名**: 1ティア差の10名で開催（他は観戦/2戦目交代）
  ・**当日19時時点で7名以下**: 中止
- 🎪 **日曜日（お祭りカスタム / MMR変動なし）**
  ランク不問・初心者歓迎！VCでワイワイ楽しむカジュアルカスタム。

---

### 📜 サーバールール
- 暴言・一方的な指摘は厳禁（親しき仲にも礼儀あり）
- 社会人としての良識を持って楽しくプレイ
- 試合後は「次はどうすれば楽しく勝てるか」を建設的に！`;

  // コンポーネント (Row 1〜4)
  const components = [
    {
      type: 1,
      components: [
        { type: 2, label: "🎮 サモナー名 ＆ 希望レーン登録", style: 3, custom_id: "portal_register" },
        { type: 2, label: "⚔️ メンバー募集開始", style: 1, custom_id: "portal_recruit" },
        { type: 2, label: "📊 マイ戦績確認", style: 2, custom_id: "portal_stats" }
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
        { type: 2, label: "📝 サモナー名変更", style: 2, custom_id: "portal_ign" },
        { type: 2, label: "📍 レーン設定変更", style: 2, custom_id: "portal_lane" },
        { type: 2, label: "🔔 募集通知 (ON/OFF)", style: 2, custom_id: "toggle_recruit_notification" }
      ]
    },
    {
      type: 1,
      components: [
        { type: 2, label: "📖 初心者・機能ガイド", style: 5, url: `${portalUrl}/guide` },
        { type: 2, label: "🌐 Webポータル (バランサー)", style: 5, url: `${portalUrl}/balancer` }
      ]
    }
  ];

  console.log(`Updating message with notification button note in #はじめに (${welcomeChannelId}) ...`);
  
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
    console.log(`SUCCESS: Message updated successfully (Message ID: ${lastMessageId})`);
  } else {
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
