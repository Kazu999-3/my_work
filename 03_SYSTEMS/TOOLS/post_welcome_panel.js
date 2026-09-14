const fs = require('fs');

async function main() {
  let token = process.env.DISCORD_TOKEN;
  if (!token && fs.existsSync('03_SYSTEMS/ktm_bot/.dev.vars')) {
    const envStr = fs.readFileSync('03_SYSTEMS/ktm_bot/.dev.vars', 'utf-8');
    const match = envStr.match(/DISCORD_TOKEN="?([^\r\n"]+)/);
    if (match) token = match[1];
  }

  const welcomeChannelId = '1485646544043642964'; // 📍はじめに
  const portalUrl = 'https://ktm-portal.vercel.app';

  const content = `# 👑 KTM LoL部 へようこそ！
> 仕事終わりのLoLに「心地よい熱狂」と「大人の語らい」を。
> 本サーバーは社会人のためのサードプレイスを目指しています！

---

### 🚀 はじめの3ステップ
1️⃣ **自己紹介をする**
   まずは <#1485646578621616209> でテンプレに沿って挨拶をお願いします！（確認次第、全チャンネルが開放されます）

2️⃣ **サモナー名 ＆ レーン希望を登録する**
   下のボタンから **「🎮 サモナー名 ＆ 希望レーン登録」** を行います。（チーム分けAIが希望を考慮）

3️⃣ **カスタム・募集に参加する**
   - **いつでも都度募集**: <#1485995531434987541> にて自由に募集・参加OK！
   - **定期カスタム**: 毎週土曜 21:00〜 <#1528646515533287497>（または画面上部「📅 イベント」）にて開催！

---

### ⚔️ 定期カスタムの開催基準（毎週土曜 21:00〜）
基本は **【シルバー以下】** と **【ゴルプラ】** の2グループに分けて募集します。

・**両方10人以上**: それぞれのランク帯で同時開催します。
・**片方のみ10人以上**: 集まったランク帯のみ開催します。
・**両方合わせて10人の場合**:
  👉 ゴルプラが多い場合：通常通りミックスでカスタムを開催。
  👉 シルバー以下が多い場合：ゴルプラの人に「苦手レーン」を担当してもらい開催。

※10人を超えた場合も、交代しながら全員で回しますので、人数を気にせず気軽にご参加ください！

---

### 🎮 Bot機能・ボタンの使い方
#### ◆ メンバー募集（「⚔️ メンバー募集開始」または /recruit）
<#1485995531434987541> で \`/recruit\` または下の「⚔️ メンバー募集開始」ボタンで募集を作成。
開始時刻やメモ、人数（カスタム10人 / ノマ・ARAM 5人）を自由に指定できます。
メンバーは「✋ 参加する」ボタンを押すだけでエントリー完了！

#### ◆ レーン設定（「🎮 サモナー名 ＆ 希望レーン登録」または /lane）
下の「🎮 サモナー名 ＆ 希望レーン登録」ボタンから、サモナー名と希望ポジションを一括設定。
未登録の方も自動で名簿登録・ランク同期が行われます。
※一度設定すれば保存され、チーム分けAIが自動で希望を最優先配置します。

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

  console.log(`Posting to channel ${welcomeChannelId} ...`);
  const res = await fetch(`https://discord.com/api/v10/channels/${welcomeChannelId}/messages`, {
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

  if (res.ok) {
    const msg = await res.json();
    console.log(`SUCCESS: Message posted to #はじめに (Message ID: ${msg.id})`);
  } else {
    console.error(`ERROR: ${res.status} ${await res.text()}`);
  }
}

main().catch(console.error);
