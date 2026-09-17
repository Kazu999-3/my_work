import { createClient } from '@supabase/supabase-js';

const botToken = process.env.DISCORD_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const forumChannelId = '1524740558550073496';

async function main() {
  if (!botToken || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. ACTIVEなマッチを取得
  const { data: matches, error } = await supabase
    .from('mentorship_matches')
    .select(`
      *,
      mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
      pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
    `)
    .eq('status', 'ACTIVE');

  if (error || !matches || matches.length === 0) {
    console.log('No active matches found or error:', error);
    return;
  }

  console.log(`Found ${matches.length} active matches.`);

  for (const match of matches) {
    let meta = {};
    try {
      meta = JSON.parse(match.notes || '{}');
    } catch (_) {}

    if (meta.threadUrl) {
      console.log(`Match ${match.id} already has thread: ${meta.threadUrl}`);
      continue;
    }

    console.log(`Creating thread for Match ${match.id}: ${match.mentor?.player_name} x ${match.pupil?.player_name}`);

    const mentorName = match.mentor?.player_name || '師匠';
    const pupilName = match.pupil?.player_name || '弟子';
    const mentorDiscordId = match.mentor_discord_id;
    const pupilDiscordId = match.pupil_discord_id;
    const durationLabel = meta.durationLabel || '2週間育成コース（14日・推奨）';
    const commStyle = meta.commStyle || 'VC_ACTIVE';

    const appliedTags = ['1524740838419202130']; // 🟢 質問・相談
    const laneTagMap = {
      TOP: '1524740905125544047',
      JG: '1524740942815297546',
      MID: '1524740992132186172',
      ADC: '1524741033831960587',
      SUP: '1524741097857745016',
      SUPPORT: '1524741097857745016',
      BOT: '1524741033831960587',
    };

    const lanes = [
      ...(Array.isArray(match.mentor?.lanes) ? match.mentor.lanes : []),
      ...(Array.isArray(match.pupil?.lanes) ? match.pupil.lanes : []),
    ];

    for (const l of lanes) {
      const upper = (l || '').toUpperCase();
      if (laneTagMap[upper] && !appliedTags.includes(laneTagMap[upper])) {
        appliedTags.push(laneTagMap[upper]);
      }
    }

    const threadTitle = `【師弟指導】${mentorName}(師匠) × ${pupilName}(弟子)`.slice(0, 100);
    const mentorMention = mentorDiscordId ? `<@${mentorDiscordId}>` : `**${mentorName}**`;
    const pupilMention = pupilDiscordId ? `<@${pupilDiscordId}>` : `**${pupilName}**`;

    const commStyleText =
      commStyle === 'VC_ACTIVE'
        ? '🎙️ VC重視（通話しながらのリアルタイム指導歓迎）'
        : commStyle === 'TEXT_ONLY'
        ? '💬 テキストチャット重視（空き時間の質問・添削中心）'
        : '⚖️ VC・テキスト柔軟対応';

    const embed = {
      title: '🤝 師弟専用指導ルームへようこそ！',
      description:
        `師弟マッチングの成立、おめでとうございます！🎉\n` +
        `こちらは **${mentorName} 師匠** と **${pupilName} 弟子** の専用指導チャットです。\n` +
        `日々の質問やアドバイス、試合の振り返り、VC予定の調整などにご自由にお使いください！\n\n` +
        `⏱️ **活動期間:** ${durationLabel}\n` +
        `🗣️ **希望スタイル:** ${commStyleText}\n\n` +
        `🎯 **おすすめのキックオフ手順:**\n` +
        `1. まずはご挨拶 ＆ プレイ可能時間帯のすり合わせ 🤝\n` +
        `2. 目標ランクや克服したい課題（CS精度、リコール判断、視界、集団戦等）のヒアリング 📝\n` +
        `3. Discord画面共有でのリプレイ鑑賞やKTMカスタムでの同チーム参加 🎮\n\n` +
        `🔗 **便利なポータルツール:**\n` +
        `• [マイページ（目標進捗・指導メモ共有）](https://ktm-portal.vercel.app/mypage)\n` +
        `• [戦績コーチング・リプレイ監査](https://ktm-portal.vercel.app/coach)`,
      color: 0x10b981,
      fields: [
        { name: '👑 師匠', value: `${mentorName} (${mentorMention})`, inline: true },
        { name: '🌱 弟子', value: `${pupilName} (${pupilMention})`, inline: true },
      ],
      footer: {
        text: 'KTM 師弟マッチングシステム | 🎓コーチング・質問',
      },
      timestamp: new Date().toISOString(),
    };

    const payload = {
      name: threadTitle,
      auto_archive_duration: 10080,
      applied_tags: appliedTags,
      message: {
        content: `${mentorMention} ${pupilMention} 🎉 **師弟マッチング成立！** お二人の専用指導チャットが作成されました！`,
        embeds: [embed],
      },
    };

    const res = await fetch(`https://discord.com/api/v10/channels/${forumChannelId}/threads`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('Failed to create thread:', res.status, await res.text());
      continue;
    }

    const threadData = await res.json();
    const threadId = threadData.id;
    const guildId = threadData.guild_id || '1485636149379858567';
    const threadUrl = `https://discord.com/channels/${guildId}/${threadId}`;

    console.log('SUCCESS! Created thread:', threadTitle, threadUrl);

    meta.threadId = threadId;
    meta.threadUrl = threadUrl;

    const { error: uErr } = await supabase
      .from('mentorship_matches')
      .update({ notes: JSON.stringify(meta) })
      .eq('id', match.id);

    if (uErr) {
      console.error('Failed to update match notes:', uErr);
    } else {
      console.log('Updated match in Supabase successfully.');
    }
  }
}

main();
