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

const updatedEmbed = {
  title: '📢 【運営より】師弟活動の期間ルール更新と「卒業 ＆ 継続（再オファー）」のご案内',
  description:
    '師弟活動へのご参加ありがとうございます！✨\n' +
    '先輩・後輩双方が気兼ねなく、メリハリをつけて続けられるよう、師弟活動の期間仕様をアップデートしました。\n\n' +
    '**💡 主な変更点:**\n' +
    '1. **「期間満了で一度キリよく終了（卒業）」へ統一**\n' +
    '   ・ダラダラ続いて辞め時を失うのを防ぐため、目安期間が過ぎたら**一度キリよく円満終了（卒業）**とする仕様になりました。\n' +
    '2. **自動延長は撤廃 ➔ 継続は「再オファー制」へ！**\n' +
    '   ・自動延長はありませんが、**「まだまだ教えてほしい！」「もっと続けたい！」という場合は、一度卒業した後に改めてポータル掲示板から【継続依頼（再オファー）】を送れば何度でも継続できます！**🔥\n\n' +
    '───────────────\n\n' +
    '**🎯 現在ペア中の皆さまへ:**\n' +
    'お二人の活動開始からすでに十分な期間（2週間〜1ヶ月以上）が経過しております！\n\n' +
    '先輩・後輩どちらからでも構いませんので、**キリのいいタイミングでポータルのマイページから「卒業（完了）」ボタンを押して一度区切りをつけていただいて大丈夫**です！🎓\n\n' +
    '**🔥 【重要】もっと続けたい・教わりたい後輩の方へ:**\n' +
    '**「まだまだこの先輩に教えてもらいたい！」「引き続き指導を受けたい！」という場合は、ぜひ遠慮なく卒業後にポータル掲示板からその先輩へ【継続依頼（再オファー）】を送信してください！**\n' +
    '一度キリよく卒業を挟むことで、先輩側も予定や負担を調整しながら安心して継続を引き受けられます🤝✨\n\n' +
    '*（もちろん「あと1回だけカスタムやノーマルを一緒にやってから卒業したい」等があれば、そのタイミングでOKです！）*\n\n' +
    '引き続きよろしくお願いいたします！',
  color: 0x3b82f6,
  footer: {
    text: 'KTM Mentorship System | ポータルの師弟ハブよりご確認いただけます'
  }
};

const payload = {
  embeds: [updatedEmbed],
  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: '🎓 マイページで卒業・状況確認',
          url: 'https://my-work-8jbd.vercel.app/mentorship'
        },
        {
          type: 2,
          style: 5,
          label: '🔄 掲示板で再オファーを送る',
          url: 'https://my-work-8jbd.vercel.app/mentorship'
        }
      ]
    }
  ]
};

async function updateAnnouncements() {
  for (const tid of threadIds) {
    try {
      // 直近のメッセージから Bot のアナウンスメッセージを探す
      const res = await fetch(`https://discord.com/api/v10/channels/${tid}/messages?limit=5`, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (!res.ok) {
        console.error(`Thread ${tid} fetch error:`, await res.text());
        continue;
      }
      const msgs = await res.json();
      const botMsg = msgs.find(m => m.embeds && m.embeds[0] && m.embeds[0].title && m.embeds[0].title.includes('運営より'));

      if (!botMsg) {
        console.warn(`Thread ${tid}: Announcement message not found. Posting new message...`);
        const postRes = await fetch(`https://discord.com/api/v10/channels/${tid}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        console.log(`Thread ${tid} post status:`, postRes.status);
      } else {
        const patchRes = await fetch(`https://discord.com/api/v10/channels/${tid}/messages/${botMsg.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        console.log(`Thread ${tid} update status:`, patchRes.status, patchRes.statusText);
        if (!patchRes.ok) {
          console.error(`Thread ${tid} update failed:`, await patchRes.text());
        }
      }
    } catch (e) {
      console.error(`Thread ${tid} Error:`, e.message);
    }
  }
}

updateAnnouncements();
