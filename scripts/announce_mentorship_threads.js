const fs = require('fs');

const env = fs.readFileSync('d:/my_work/04_PORTAL/.env.local', 'utf8');
const tokenMatch = env.match(/DISCORD_BOT_TOKEN=([^\r\n]+)/);
const token = tokenMatch ? tokenMatch[1].trim() : null;

if (!token) {
  console.error('DISCORD_BOT_TOKEN not found');
  process.exit(1);
}

const threadIds = [
  '1550207944929575043',
  '1558332449249820713',
  '1560235873960857651',
  '1558426787564888147'
];

const embed = {
  title: '📢 【運営より】師弟活動の期間ルール更新と「卒業」のご案内',
  description: 
    '師弟活動へのご参加ありがとうございます！✨\n' +
    '先輩・後輩双方がより気兼ねなく、無理のないペースで続けられるよう、師弟活動の期間仕様をアップデートしました。\n\n' +
    '**💡 主な変更点:**\n' +
    '1. **「活動期間満了で一度キリよく終了（卒業）」へ統一**\n' +
    '   ・「いつ終わればいいか分からない」を防ぐため、目安期間が過ぎたら**一度キリよく円満終了（卒業）**とする仕様になりました。\n' +
    '2. **自動延長は撤廃 ➔ 継続は「再オファー制」へ**\n' +
    '   ・自動延長はなくなり、「もっと教えてもらいたい！」という場合は、卒業後に改めてポータル掲示板から【継続依頼（オファー）】を出す形となります。\n\n' +
    '───────────────\n\n' +
    '**🎯 現在ペア中の皆さまへ:**\n' +
    'お二人の活動開始からすでに十分な期間（2週間〜1ヶ月以上）が経過しております！\n\n' +
    '先輩・後輩どちらからでも構いませんので、**キリのいいタイミングでポータルのマイページから「卒業（完了）」ボタンを押して一度区切りをつけていただいて大丈夫**です！🎓\n' +
    '*（もちろん「あと1回だけカスタムやノーマルを一緒にやってから卒業したい」等があれば、そのタイミングでOKです！）*\n\n' +
    '卒業後、もしまた機会があればいつでも気軽に再オファーを送ってくださいね！🤝\n' +
    '引き続きよろしくお願いいたします！',
  color: 0x3b82f6,
  footer: {
    text: 'KTM Mentorship System | ポータルの師弟ハブよりご確認いただけます'
  }
};

const payload = {
  embeds: [embed],
  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: '🎓 ポータルで状況確認・卒業する',
          url: 'https://my-work-8jbd.vercel.app/mentorship'
        }
      ]
    }
  ]
};

async function postAnnounce() {
  for (const tid of threadIds) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${tid}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log('Thread:', tid, 'Status:', res.status, res.statusText);
      if (!res.ok) {
        console.error('Failed:', await res.text());
      }
    } catch (e) {
      console.error('Thread', tid, 'Error:', e.message);
    }
  }
}

postAnnounce();
