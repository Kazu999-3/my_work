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

const channelId = '1558594325544308747'; // 🔒・おつまる-案内
const messageId = '1558594328081997997';

const portalUrl = 'https://my-work-8jbd.vercel.app';
const mypageUrl = `${portalUrl}/mypage`;

const newContent = `👋 **<@1406715024675967227> さん、KTMサーバーへようこそ！**

自己紹介をいただき、KTM名簿への登録が完了しました！✨

📋 **ご登録情報**:
・**LoL ID**: \`カンピロパクパク#食中毒\`
・**現在のランク**: \`BRONZE I\`（初期KTM MMR: \`1250\`）
・**希望レーン**: メイン \`JG\` / サブ \`TOP\`
・**カスタムNGレーン**: \`なし\`（※もし苦手・避けたいレーンがあれば、[マイページ](<${mypageUrl}>) からいつでも設定できます！）
・**初期所持コイン**: \`1,000 🪙\`

🎉 **付与されたロール**:
・\`🔰 初参加\`、\`🌱 初中級交流\`

🚀 **次の一歩！カスタム参加の目安**:
1️⃣ **週末定期カスタム（毎週土日 21:00〜）**:
   ・<#1528646515533287497> に募集案内が出ます。参加したい日のリアクション（スタンプ）を押すだけでエントリー完了！
   ・**初参加におすすめ**: 日曜日の「お祭りカスタム（戦績ノーカウント保護・練習歓迎）」や、土曜の「1戦だけ参加（⏱️）」から体験するのが気楽でおすすめです！
   ・チーム分けはバランサーが実力五分五分に自動調整するので「足を引っ張ったらどうしよう…」の心配は一切不要です👍
2️⃣ **Webポータル（戦績・カジノ・ショップ）**:
   ・Discordだけで試合はフル参加できます！試合の観戦中や合間には、ポータルで勝敗予想カジノやガチャも楽しめます。
   ・🌐 **KTMポータル**: <${portalUrl}>
   ・👤 **マイページ（レーン変更・所持コイン確認）**: <${mypageUrl}>

💡 **ここは運営との個別案内チャットです**
「当日の流れが分からない」「VC聞き専でもいい？」など、疑問や不安があれば何でもこの部屋でお気軽にメッセージしてくださいね！🤝`;

async function updateOtsumaruMessage() {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: newContent,
      flags: 4
    })
  });

  if (res.ok) {
    console.log('✅ おつまるさんの個別案内メッセージのURL埋め込みを非表示にしました！');
  } else {
    console.error('❌ 書き換えエラー:', res.status, await res.text());
  }
}

updateOtsumaruMessage();
