import fs from 'fs';

const envText = fs.readFileSync('04_PORTAL/.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const channelId = '1485646544043642964';
const messageId = '1556984079570960386';

const newContent = `# 👑 KTM LoL部 へようこそ！
> 仕事終わりのLoLに「心地よい熱狂」と「大人の語らい」を。
> 本サーバーは社会人のためのサードプレイスを目指しています！

---

### 🚀 かんたん2ステップで参加完了！
1️⃣ **自己紹介をする（これだけで準備完了！）**
   <#1485646578621616209> でテンプレに沿って投稿するだけでOK！
   Botが自動で **LoL ID・ランク・希望レーン・NGレーン** を解析・登録し、あなた専用の個別案内チャットを作成します✨
   *(※登録後にレーンを変更したい場合は、下の「📍 レーン設定変更」ボタンからいつでも変更可能です)*

2️⃣ **カスタム・募集に参加する（スタンプを押すだけ！）**
   - **週末定期カスタム**: 毎週土日 21:00〜 <#1528646515533287497> にて開催！募集にリアクション（スタンプ）するだけでエントリー完了！
   - **都度募集**: <#1485995531434987541> にて自由に募集・参加OK！
   ※募集時の通知（メンション）を受け取りたい/止めたい場合は、下の **「🔔 募集通知 (ON/OFF)」** ボタンでいつでも切替可能です。

---

### ⚔️ 週末定期カスタム（毎週土日 21:00〜）
✨ **初心者・初参加の方も大歓迎！**
チーム戦力はバランサーが実力五分五分に自動調整するため、「足を引っ張ったらどうしよう…」の心配は一切不要です！

🔰 **初参加におすすめの参加方法**:
まずは気楽な **「日曜日（お祭りカスタム）」** や、**「土曜日の1戦のみ参加（⏱️）」** から雰囲気を体験してみるのがおすすめです！（見学・VC聞き専も大歓迎）

- 🎪 **日曜日（お祭りカスタム / 戦績ノーカウント保護）**
  ランク不問・初心者大歓迎！MMR変動なしでVCでワイワイ楽しむカジュアル枠（練習や初出しチャンプ等も自由！）。
- 🛡️ **土曜日（真剣勝負 / MMRあり）**
  実力伯仲の真剣マッチ！
  【開催＆人数ルール】
  ・**20名〜**: 上位/下位の2部屋同時開催（全員出場！）
  ・**10〜19名**: 1ティア差の10名で開催（他は観戦/2戦目交代）
  ・**当日19時時点で7名以下**: 中止（予定を立てやすくするため）
  ※土日ともに1戦のみ（⏱️）・途中参加（🌙）・途中抜けOK！

---

### 📜 サーバールール（大切なお約束）
- **暴言・一方的なダメ出しは厳禁**（アドバイスは相手から求められたときに優しく！）
- **ミスや不慣れプレイも笑ってナイスファイト！**（誰でも最初は初心者です✨）
- **試合後は「次はどうすれば楽しく勝てるか」を建設的に**（社会人の良識を持って楽しむ）`;

async function updateMessage() {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: newContent })
  });

  if (res.ok) {
    console.log('✅ #📍はじめに のメッセージを更新しました！');
  } else {
    console.error('❌ 更新エラー:', res.status, await res.text());
  }
}

updateMessage();
