import { supabaseAdmin as supabase } from './supabaseAdmin';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const GAME_CATEGORY_ID = '1485646715716632787'; // 🎮 【Game】 カスタム・ゲーム
const CHANNEL_NAME = '🤝師弟募集';
export const DEFAULT_MENTORSHIP_CHANNEL_ID = '1550159520687325205';
export const DEFAULT_MENTORSHIP_FORUM_CHANNEL_ID = '1524740558550073496';
const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ktm-portal.vercel.app';

const DASHBOARD_TITLE = '🎯 KTM 師弟募集リアルタイム掲示板';

/**
 * 師弟募集用チャンネルを取得、存在しなければ自動作成
 */
export async function ensureMentorshipChannel(): Promise<string | null> {
  const customChannelId = process.env.DISCORD_MENTORSHIP_CHANNEL_ID || DEFAULT_MENTORSHIP_CHANNEL_ID;
  if (customChannelId) return customChannelId;

  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    console.warn('[discordMentorship] BOT Token or Guild ID is missing');
    return null;
  }

  try {
    // 1. チャンネル一覧を取得
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!res.ok) {
      console.warn('[discordMentorship] Failed to list guild channels:', await res.text());
      return null;
    }

    const channels: any[] = await res.json();
    const existing = channels.find(
      (c: any) => (c.name === CHANNEL_NAME || c.name === '師弟募集' || c.name === '🤝-師弟募集') && c.type === 0
    );

    if (existing) {
      return existing.id;
    }

    // 2. 存在しない場合は作成
    const createRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: CHANNEL_NAME,
        type: 0, // GUILD_TEXT
        parent_id: GAME_CATEGORY_ID,
        topic: '🤝 KTMポータルの師弟マッチング募集板です。募集の確認やオファー申請はWebポータルから行えます。',
      }),
    });

    if (!createRes.ok) {
      console.warn('[discordMentorship] Failed to create channel:', await createRes.text());
      return null;
    }

    const newChannel = await createRes.json();
    return newChannel.id;
  } catch (err) {
    console.error('[discordMentorship] Error in ensureMentorshipChannel:', err);
    return null;
  }
}

/**
 * 現在アクティブな全募集データを反映した「常駐ダッシュボード」をDiscordに同期（PATCH更新/新規作成）
 */
export async function syncMentorshipDashboard(): Promise<boolean> {
  const channelId = await ensureMentorshipChannel();
  if (!channelId || !DISCORD_BOT_TOKEN) return false;

  try {
    // 1. DBからアクティブな募集一覧を取得
    const { data: profiles, error } = await supabase
      .from('mentorship_profiles')
      .select('*')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mentors = (profiles || []).filter((p: any) => p.role_type === 'MENTOR');
    const pupils = (profiles || []).filter((p: any) => p.role_type === 'PUPIL');

    // 2. 師匠リストのテキスト整形
    let mentorFieldText = '';
    if (mentors.length === 0) {
      mentorFieldText = '現在募集中の師匠はいません。指導希望者はぜひポータルから立候補を！';
    } else {
      mentorFieldText = mentors
        .slice(0, 15) // 最大15件
        .map((m: any) => {
          const lanes = Array.isArray(m.lanes) && m.lanes.length > 0 ? m.lanes.join('/') : 'ALL';
          const rank = m.current_rank || 'UNRANKED';
          const tagList = Array.isArray(m.tags) && m.tags.length > 0 ? ` [${m.tags.slice(0, 2).join(', ')}]` : '';
          return `• **${m.player_name}** (${rank}) | 🛡️ \`${lanes}\`${tagList}`;
        })
        .join('\n');
      if (mentors.length > 15) {
        mentorFieldText += `\n*他 ${mentors.length - 15} 名の師匠が募集中*`;
      }
    }

    // 3. 弟子リストのテキスト整形
    let pupilFieldText = '';
    if (pupils.length === 0) {
      pupilFieldText = '現在募集中の弟子はいません。向上心あふれる弟子の参加を待っています！';
    } else {
      pupilFieldText = pupils
        .slice(0, 15) // 最大15件
        .map((p: any) => {
          const lanes = Array.isArray(p.lanes) && p.lanes.length > 0 ? p.lanes.join('/') : 'ALL';
          const rank = p.current_rank || 'UNRANKED';
          const target = p.target_rank ? ` ➔ 目標: **${p.target_rank}**` : '';
          return `• **${p.player_name}** (${rank}${target}) | 🛡️ \`${lanes}\``;
        })
        .join('\n');

      if (pupils.length > 15) {
        pupilFieldText += `\n*他 ${pupils.length - 15} 名の弟子が募集中*`;
      }
    }

    const nowJst = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());

    // 4. ダッシュボードEmbedの構築
    const dashboardEmbed = {
      title: DASHBOARD_TITLE,
      description:
        `👑 **KTMコミュニティ 師弟マッチングへようこそ！**\n` +
        `ランク向上を目指す弟子と、指導やコツを伝授する師匠をつなぐ常駐掲示板です。\n\n` +
        `👉 **[Webポータルで詳細を見る・オファーを送る](${PORTAL_BASE_URL}/mentorship)**\n` +
        `（ポータルから「オファー送信」を行うと、相手のDiscordへ自動DMが届きます）`,
      color: 0x6366f1, // Indigo
      fields: [
        {
          name: `🥋 指導受付中の師匠 (${mentors.length}名)`,
          value: mentorFieldText,
          inline: false,
        },
        {
          name: `🌱 修行・指導希望の弟子 (${pupils.length}名)`,
          value: pupilFieldText,
          inline: false,
        },
      ],
      footer: {
        text: `🔄 最終更新: ${nowJst} (JST) | KTM Mentorship Hub`,
      },
    };

    const payload = {
      embeds: [dashboardEmbed],
    };

    // 5. チャンネル内の既存ピン留めメッセージを探索
    const pinsRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/pins`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });

    let existingPinId: string | null = null;
    if (pinsRes.ok) {
      const pins: any[] = await pinsRes.json();
      const match = pins.find((p: any) => p.embeds?.[0]?.title === DASHBOARD_TITLE);
      if (match) existingPinId = match.id;
    }

    if (existingPinId) {
      // 既存ダッシュボードメッセージを上書き更新
      const patchRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${existingPinId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      return patchRes.ok;
    } else {
      // 新規メッセージを投稿し、ピン留め
      const postRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!postRes.ok) {
        console.warn('[discordMentorship] Failed to post dashboard message:', await postRes.text());
        return false;
      }

      const newMsg = await postRes.json();
      await fetch(`https://discord.com/api/v10/channels/${channelId}/pins/${newMsg.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      });

      return true;
    }
  } catch (err) {
    console.error('[discordMentorship] Error in syncMentorshipDashboard:', err);
    return false;
  }
}

/**
 * 新規募集または大幅更新時に個別の紹介カードEmbedをDiscordに速報投稿
 */
export async function notifyNewMentorshipProfile(params: {
  profile: any;
  isUpdate?: boolean;
}): Promise<boolean> {
  const { profile, isUpdate } = params;
  const channelId = await ensureMentorshipChannel();
  if (!channelId || !DISCORD_BOT_TOKEN) return false;

  try {
    const isMentor = profile.role_type === 'MENTOR';
    const roleLabel = isMentor ? '師匠（指導者）' : '弟子（修行希望）';
    const icon = isMentor ? '🥋' : '🌱';
    const color = isMentor ? 0xf59e0b : 0x10b981; // 師匠: Gold, 弟子: Emerald

    const mention = profile.discord_id ? `<@${profile.discord_id}>` : `**${profile.player_name}**`;
    const lanes = Array.isArray(profile.lanes) && profile.lanes.length > 0 ? profile.lanes.join(', ') : '未指定';
    const champs =
      Array.isArray(profile.champions) && profile.champions.length > 0 ? profile.champions.join(', ') : '全般';
    const tags =
      Array.isArray(profile.tags) && profile.tags.length > 0
        ? profile.tags.map((t: string) => `\`#${t}\``).join(' ')
        : 'なし';

    const actionText = isUpdate ? '募集内容を更新しました！' : '新しい募集を開始しました！';

    const embed = {
      title: `${icon} 【${roleLabel}募集】${profile.player_name} さんが${actionText}`,
      description: profile.bio ? `> ${profile.bio.replace(/\n/g, '\n> ')}` : '*自己PRの登録はありません*',
      color,
      fields: [
        {
          name: '👤 プレイヤー',
          value: `${profile.player_name} (${mention})`,
          inline: true,
        },
        {
          name: isMentor ? '📈 現在のランク' : '📈 ランク / 目標',
          value: isMentor
            ? `**${profile.current_rank || 'UNRANKED'}**`
            : `現在: **${profile.current_rank || 'UNRANKED'}**\n目標: **${profile.target_rank || '未設定'}**`,
          inline: true,
        },
        {
          name: isMentor ? '🛡️ 指導可能レーン' : '🛡️ 希望レーン',
          value: `\`${lanes}\``,
          inline: true,
        },
        {
          name: isMentor ? '🏆 得意チャンピオン' : '🎯 練習中チャンピオン',
          value: champs,
          inline: true,
        },
        {
          name: '🏷️ 特徴・タグ',
          value: tags,
          inline: true,
        },
        {
          name: '⏰ 活動可能時間帯',
          value: profile.active_hours || '指定なし',
          inline: true,
        },
      ],
      footer: {
        text: 'KTM Mentorship Hub | ポータルからオファーを送ると相手に直接DMが届きます',
      },
    };

    const content = `📢 **${roleLabel}の新着募集！** ${mention} さんが掲示板にエントリーしました！\n👉 [ポータルでプロフィールを見る・オファーを送る](${PORTAL_BASE_URL}/mentorship)`;

    const postRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        embeds: [embed],
      }),
    });

    return postRes.ok;
  } catch (err) {
    console.error('[discordMentorship] Error in notifyNewMentorshipProfile:', err);
    return false;
  }
}

export interface CreateMentorshipThreadParams {
  mentorName: string;
  pupilName: string;
  durationLabel: string;
  mentorDiscordId?: string;
  pupilDiscordId?: string;
  mentorLanes?: string[];
  pupilLanes?: string[];
  lanes?: string[];
  commStyle?: string;
}

export interface MentorshipThreadResult {
  threadId: string;
  threadUrl: string;
}

/**
 * 🎓 指定のフォーラムチャンネル (1524740558550073496 / 🎓コーチング・質問) に師弟専用指導スレッドを作成
 */
export async function createMentorshipForumThread(
  params: CreateMentorshipThreadParams
): Promise<MentorshipThreadResult | null> {
  const forumChannelId = process.env.DISCORD_MENTORSHIP_FORUM_CHANNEL_ID || DEFAULT_MENTORSHIP_FORUM_CHANNEL_ID;
  if (!DISCORD_BOT_TOKEN || !forumChannelId) {
    console.warn('[discordMentorship] BOT Token or Forum Channel ID is missing');
    return null;
  }

  const {
    mentorName,
    pupilName,
    durationLabel,
    mentorDiscordId,
    pupilDiscordId,
    mentorLanes = [],
    pupilLanes = [],
    lanes = [],
    commStyle = 'VC_ACTIVE',
  } = params;

  // 1. 基本タグ: 「📝 コーチング」をデフォルトで付与 (質問・相談ではなくコーチング)
  const COACHING_TAG_ID = '1550294121330114762';
  const appliedTags: string[] = [COACHING_TAG_ID];

  // 2. レーンタグ判定: コーチと弟子の共通レーンのみを抽出
  const laneTagMap: Record<string, string> = {
    TOP: '1524740905125544047',
    JG: '1524740942815297546',
    MID: '1524740992132186172',
    ADC: '1524741033831960587',
    SUP: '1524741097857745016',
    SUPPORT: '1524741097857745016',
    BOT: '1524741033831960587',
  };

  const normalizeLane = (lane: string): string => {
    const upper = (lane || '').toUpperCase().trim();
    if (upper === 'SUPPORT') return 'SUP';
    if (upper === 'BOT') return 'ADC';
    return upper;
  };

  const mLanes = (mentorLanes.length > 0 ? mentorLanes : lanes).map(normalizeLane);
  const pLanes = (pupilLanes.length > 0 ? pupilLanes : lanes).map(normalizeLane);

  let commonLanes: string[] = [];
  if (mLanes.includes('ALL') || mLanes.includes('FILL')) {
    commonLanes = pLanes.filter((l) => l !== 'ALL' && l !== 'FILL');
  } else if (pLanes.includes('ALL') || pLanes.includes('FILL')) {
    commonLanes = mLanes.filter((l) => l !== 'ALL' && l !== 'FILL');
  } else {
    commonLanes = mLanes.filter((l) => pLanes.includes(l));
  }

  // 共通レーンが空（完全不一致等）の場合は、弟子の希望レーン（指導対象レーン）を優先
  if (commonLanes.length === 0) {
    commonLanes = pLanes.length > 0 ? pLanes : mLanes;
  }

  for (const l of commonLanes) {
    const tagId = laneTagMap[l];
    if (tagId && !appliedTags.includes(tagId)) {
      appliedTags.push(tagId);
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
      `• [マイページ（目標進捗・指導メモ共有）](${PORTAL_BASE_URL}/mypage)\n` +
      `• [戦績コーチング・リプレイ監査](${PORTAL_BASE_URL}/coach)`,
    color: 0x10b981, // エメラルドグリーン
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
    auto_archive_duration: 10080, // 7日間 (最大)
    // Discord Forumチャンネルのapplied_tagsは最大5件までのため、
    // コーチングタグ+レーンタグ合計が6件以上になるケース(5レーン共通時)を安全に切り詰める。
    applied_tags: appliedTags.slice(0, 5),
    message: {
      content: `${mentorMention} ${pupilMention} 🎉 **師弟マッチングが成立しました！** お二人の専用指導チャットが作成されました！`,
      embeds: [embed],
    },
  };

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${forumChannelId}/threads`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[discordMentorship] Forum thread create failed (${res.status}):`, errText);
      return null;
    }

    const threadData = await res.json();
    const threadId = threadData.id;
    const guildId = threadData.guild_id || DISCORD_GUILD_ID || '1485636149379858567';
    const threadUrl = `https://discord.com/channels/${guildId}/${threadId}`;

    return { threadId, threadUrl };
  } catch (err) {
    console.error('[discordMentorship] Exception in createMentorshipForumThread:', err);
    return null;
  }
}

