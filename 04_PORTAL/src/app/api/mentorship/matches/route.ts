import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { MENTORSHIP_DURATIONS } from '../../../../lib/mentorshipConstants';
import { sendDiscordDirectMessage, sendErrorNotification } from '../../../../lib/discordNotify';
import { syncMentorshipDashboard, createMentorshipForumThread } from '../../../../lib/discordMentorship';

export const dynamic = 'force-dynamic';


export interface MatchMeta {
  durationKey: string;
  durationLabel: string;
  durationDays: number;
  commStyle?: string;
  autoRenew: boolean;
  message: string;
  fromDiscordId: string;
  cancelReason?: string;
  progressNotes?: string;
  targetRank?: string;
  threadId?: string;
  threadUrl?: string;
}

export function parseNotesMeta(notes: string | null): MatchMeta {
  const defaultMeta: MatchMeta = {
    durationKey: '14_DAYS',
    durationLabel: '🔥 2週間育成コース（14日・推奨）',
    durationDays: 14,
    commStyle: 'VC_ACTIVE',
    autoRenew: true,
    message: '',
    fromDiscordId: '',
    progressNotes: '',
    targetRank: '',
    threadId: '',
    threadUrl: '',
  };

  if (!notes) return defaultMeta;

  try {
    if (notes.startsWith('{') && notes.endsWith('}')) {
      const parsed = JSON.parse(notes);
      return { ...defaultMeta, ...parsed };
    }
  } catch (_) {}

  // 構造化タグ文字列のパース
  const fromMatch = notes.match(/\[FROM:([^\]]+)\]/);
  const durMatch = notes.match(/\[DURATION:([^\]]+)\]/);
  const renewMatch = notes.match(/\[AUTORENEW:([^\]]+)\]/);
  const cleanMsg = notes
    .replace(/\[FROM:[^\]]+\]/g, '')
    .replace(/\[DURATION:[^\]]+\]/g, '')
    .replace(/\[AUTORENEW:[^\]]+\]/g, '')
    .trim();

  const durKey = durMatch ? durMatch[1] : '14_DAYS';
  const durationInfo = MENTORSHIP_DURATIONS[durKey] || MENTORSHIP_DURATIONS['14_DAYS'];

  return {
    durationKey: durKey,
    durationLabel: durationInfo.label,
    durationDays: durationInfo.days,
    commStyle: 'VC_ACTIVE',
    autoRenew: renewMatch ? renewMatch[1] === 'true' : true,
    message: cleanMsg,
    fromDiscordId: fromMatch ? fromMatch[1] : '',
    progressNotes: '',
    targetRank: '',
  };
}

export function encodeNotesMeta(meta: Partial<MatchMeta>): string {
  const durKey = meta.durationKey || '14_DAYS';
  const durInfo = MENTORSHIP_DURATIONS[durKey] || MENTORSHIP_DURATIONS['14_DAYS'];
  const fullMeta: MatchMeta = {
    durationKey: durKey,
    durationLabel: durInfo.label,
    durationDays: durInfo.days,
    commStyle: meta.commStyle || 'VC_ACTIVE',
    autoRenew: meta.autoRenew !== undefined ? meta.autoRenew : true,
    message: meta.message || '',
    fromDiscordId: meta.fromDiscordId || '',
    cancelReason: meta.cancelReason || '',
    progressNotes: meta.progressNotes || '',
    targetRank: meta.targetRank || '',
    threadId: meta.threadId || '',
    threadUrl: meta.threadUrl || '',
  };
  return JSON.stringify(fullMeta);
}

/**
 * Discord への師弟ペア結成速報の通知ヘルパー（DM ＋ チャンネル通知 ＋ 専用チャットリンク）
 */
async function sendDiscordPairAnnounce(
  mentorName: string,
  pupilName: string,
  durationLabel: string,
  mentorDiscordId?: string,
  pupilDiscordId?: string,
  threadUrl?: string
) {
  const portalUrl = 'https://ktm-portal.vercel.app/mypage';
  const threadLinkText = threadUrl
    ? `\n\n💬 **[🎓 Discord専用指導チャットはこちら](${threadUrl})**`
    : '';

  const embed = {
    title: '🎉 【KTM師弟ハブ】師弟ペアが結成されました！',
    description: `👑 **師匠:** ${mentorName}\n🌱 **弟子:** ${pupilName}\n⏱️ **活動期間:** ${durationLabel}\n\nお互いに楽しく上達していきましょう！キックオフガイドに沿ってまずは挨拶からスタート🤝\nマイページで目標ランク進捗と指導メモを共有できます。${threadLinkText}\n👉 **[マイページで確認する](${portalUrl})**`,
    color: 0x10b981, // エメラルドグリーン
    timestamp: new Date().toISOString(),
    footer: {
      text: 'KTM 師弟マッチング ＆ 自己紹介ハブ',
    },
  };

  // 1. 師匠・弟子の双方へDM送信
  if (mentorDiscordId) {
    sendDiscordDirectMessage(mentorDiscordId, { embeds: [embed] }).catch(() => {});
  }
  if (pupilDiscordId) {
    sendDiscordDirectMessage(pupilDiscordId, { embeds: [embed] }).catch(() => {});
  }

  // 2. 募集・活動チャンネルへもアナウンス
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_RECRUIT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.warn('[mentorship/matches] Discord announce error:', err);
  }
}

/**
 * Discord への師弟卒業・指導完了速報の通知ヘルパー（DM ＋ #🤝師弟募集チャンネル）
 */
async function sendDiscordGraduationAnnounce(
  mentorName: string,
  pupilName: string,
  durationLabel: string,
  mentorDiscordId?: string,
  pupilDiscordId?: string
) {
  const portalUrl = 'https://ktm-portal.vercel.app/mentorship';
  const embed = {
    title: '🎓 【祝・師弟卒業】指導期間が無事に修了しました！🎉',
    description: `👑 **師匠:** ${mentorName}\n🌱 **弟子:** ${pupilName}\n⏱️ **完走コース:** ${durationLabel}\n\n特訓完走おめでとうございます！✨\n両名に卒業ボーナス **+200コイン** を進呈しました！🪙\n引き続きKTMカスタムやソロキューで切磋琢磨していきましょう！\n\n👉 **[師弟ハブで新たな仲間を探す](${portalUrl})**`,
    color: 0xf59e0b, // Hextechゴールド
    timestamp: new Date().toISOString(),
    footer: {
      text: 'KTM 師弟マッチング ＆ 自己紹介ハブ',
    },
  };

  // 1. 師匠・弟子へ個別祝賀DM
  if (mentorDiscordId) {
    sendDiscordDirectMessage(mentorDiscordId, { embeds: [embed] }).catch(() => {});
  }
  if (pupilDiscordId) {
    sendDiscordDirectMessage(pupilDiscordId, { embeds: [embed] }).catch(() => {});
  }

  // 2. #🤝師弟募集 チャンネルへBot直接投稿 (優先) または Webhook
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const mentorshipChannelId = process.env.DISCORD_MENTORSHIP_CHANNEL_ID || '1550159520687325205';

  if (botToken && mentorshipChannelId) {
    try {
      await fetch(`https://discord.com/api/v10/channels/${mentorshipChannelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `🎓 **【祝・師弟卒業】** <@${mentorDiscordId}> 師匠 ＆ <@${pupilDiscordId}> 弟子ペアが指導を完走しました！お疲れ様でした！✨`,
          embeds: [embed],
        }),
      });
      return;
    } catch (e) {
      console.warn('[mentorship/matches] Bot channel graduation announce failed:', e);
    }
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_RECRUIT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    } catch (err) {
      console.warn('[mentorship/matches] Discord graduation announce error:', err);
    }
  }
}

/**
 * Discord へのオファー着信速報通知ヘルパー（DM直接通知 ＋ フォールバック）
 */
async function sendDiscordOfferNotification(
  fromName: string,
  toName: string,
  toDiscordId: string,
  durationLabel: string,
  message: string
) {
  const portalUrl = 'https://ktm-portal.vercel.app/mentorship';
  const embed = {
    title: '📩 【KTM師弟ハブ】新たな師弟オファーが届きました！',
    description: `👤 **申請者:** ${fromName}\n🎯 **対象:** ${toName}\n⏱️ **希望コース:** ${durationLabel}\n💬 **メッセージ:**\n> ${message}\n\nポータル画面を開いて [承諾] すると正式にペア結成となります！\n👉 **[ポータルで確認・承諾する](${portalUrl})**`,
    color: 0x3b82f6, // ブルー
    timestamp: new Date().toISOString(),
    footer: {
      text: 'KTM 師弟マッチング ＆ 自己紹介ハブ',
    },
  };

  // 1. まず相手本人へBot経由でDM送信を試行
  if (toDiscordId) {
    const dmSuccess = await sendDiscordDirectMessage(toDiscordId, { embeds: [embed] });
    if (dmSuccess) {
      console.log(`[mentorship/matches] Successfully sent DM offer notification to ${toDiscordId}`);
      return;
    }
  }

  // 2. DMが拒否設定等の場合はWebhook（チャンネル通知）へフォールバック
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_RECRUIT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const payload = {
      content: toDiscordId ? `<@${toDiscordId}> 宛てに師弟オファーが届きました！` : undefined,
      embeds: [embed],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[mentorship/matches] Discord offer notification error:', err);
  }
}



/**
 * GET: 成立済みペア一覧 ＆ ログインユーザーの申請一覧（受信/送信）の取得
 */
export async function GET() {
  let myDiscordId: string | undefined = undefined;
  try {
    const session = await getAuthSession();
    myDiscordId = session?.discordId;

    // 1. 成立済み・卒業済みペア一覧 (ACTIVE or COMPLETED)
    const { data: rawMatches } = await supabase
      .from('mentorship_matches')
      .select(`
        *,
        mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
      `)
      .in('status', ['ACTIVE', 'COMPLETED'])
      .order('started_at', { ascending: false });

    // メタデータの展開と残り日数の計算
    const parsedMatches = (rawMatches || []).map((m: any) => {
      const meta = parseNotesMeta(m.notes);
      const started = m.started_at ? new Date(m.started_at) : new Date(m.created_at);
      const expiresAt = m.completed_at && m.status === 'COMPLETED'
        ? new Date(m.completed_at)
        : new Date(started.getTime() + (meta.durationDays || 14) * 24 * 60 * 60 * 1000);

      const now = new Date();
      const diffTime = expiresAt.getTime() - now.getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = remainingDays <= 0 && m.status === 'ACTIVE';

      return {
        ...m,
        meta,
        expiresAt: expiresAt.toISOString(),
        remainingDays,
        isExpired,
      };
    });

    // 2. ログインユーザー宛の受信申請 / 送信申請 (PENDING)
    let pendingReceived: any[] = [];
    let pendingSent: any[] = [];

    if (myDiscordId) {
      const { data: pendingData } = await supabase
        .from('mentorship_matches')
        .select(`
          *,
          mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
          pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
        `)
        .eq('status', 'PENDING')
        .or(`mentor_discord_id.eq.${myDiscordId},pupil_discord_id.eq.${myDiscordId}`);

      if (pendingData) {
        pendingData.forEach((m: any) => {
          const meta = parseNotesMeta(m.notes);
          const item = { ...m, meta };
          if (meta.fromDiscordId === myDiscordId) {
            pendingSent.push(item);
          } else {
            pendingReceived.push(item);
          }
        });
      }
    }

    return NextResponse.json({
      ok: true,
      matches: parsedMatches,
      pendingReceived,
      pendingSent,
      myDiscordId: myDiscordId || null,
      isAdmin: !!session?.isAdmin,
    });
  } catch (err: any) {
    console.error('[mentorship/matches] GET error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/matches',
      method: 'GET',
      error: err,
      statusCode: 500,
      userId: myDiscordId,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: 師弟ペア・申請の削除（管理者専用または本人による申請キャンセル）
 */
export async function DELETE(request: Request) {
  let session: any = null;
  try {
    session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '認証が必要です。' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) {
      return NextResponse.json({ ok: false, error: 'Match IDが必要です。' }, { status: 400 });
    }

    const { data: match, error: mErr } = await supabase
      .from('mentorship_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (mErr || !match) {
      return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
    }

    const isMine = match.mentor_discord_id === session.discordId || match.pupil_discord_id === session.discordId;

    // 管理者または関係者本人のみ削除可能
    if (!session.isAdmin && !isMine) {
      return NextResponse.json({ ok: false, error: '削除権限がありません。' }, { status: 403 });
    }

    // マッチを削除
    const { error } = await supabase
      .from('mentorship_matches')
      .delete()
      .eq('id', matchId);

    if (error) throw error;

    // もしペア中だった場合はプロフィールステータスを OPEN に戻す
    if (match.status === 'ACTIVE') {
      await supabase
        .from('mentorship_profiles')
        .update({ status: 'OPEN' })
        .in('id', [match.mentor_profile_id, match.pupil_profile_id]);
    }

    return NextResponse.json({ ok: true, message: '師弟ペア/申請を削除しました。' });
  } catch (err: any) {
    console.error('[mentorship/matches] DELETE error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/matches',
      method: 'DELETE',
      error: err,
      statusCode: 500,
      userId: session?.discordId,
      userName: session?.displayName,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}


/**
 * POST: 師弟マッチング操作 (APPLY / ACCEPT / REJECT / EXTEND / COMPLETE / CANCEL)
 */
export async function POST(request: Request) {
  let session: any = null;
  let body: any = null;
  try {
    session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'オファーを行うにはDiscordログインが必要です。' },
        { status: 401 }
      );
    }

    body = await request.json();
    const {
      action = 'APPLY',
      targetProfileId,
      matchId,
      message = '',
      durationKey = '14_DAYS',
      commStyle = 'VC_ACTIVE',
      autoRenew = true,
      extendDays,
      reason = '円満解散（スケジュール都合・合意済み）',
    } = body;


    // ==========================================
    // 1. 期間延長 / そのまま実行 (EXTEND)
    // ==========================================
    if (action === 'EXTEND') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '対象のマッチIDが必要です。' }, { status: 400 });
      }

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
      }

      const currentMeta = parseNotesMeta(match.notes);
      const addDays = extendDays || currentMeta.durationDays || 14;
      const newDurationDays = currentMeta.durationDays + addDays;

      const newMeta: MatchMeta = {
        ...currentMeta,
        durationDays: newDurationDays,
        durationLabel: `🔥 継続中（計${newDurationDays}日間）`,
      };

      await supabase
        .from('mentorship_matches')
        .update({
          notes: JSON.stringify(newMeta),
          status: 'ACTIVE',
        })
        .eq('id', matchId);

      return NextResponse.json({
        ok: true,
        message: `⚡ 師弟期間を ${addDays} 日間そのまま延長しました！引き続き共闘をお楽しみください。`,
      });
    }

    // ==========================================
    // 2. 卒業・指導完了 (COMPLETE)
    // ==========================================
    if (action === 'COMPLETE') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '対象のマッチIDが必要です。' }, { status: 400 });
      }

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select(`
          *,
          mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
          pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
        `)
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
      }

      // 既に完了済みの場合は二重処理をスキップ
      if (match.status === 'COMPLETED') {
        return NextResponse.json({ ok: true, message: '既に卒業・指導完了済みです。' });
      }

      await supabase
        .from('mentorship_matches')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      // プロフィールステータスを OPEN に戻す（再募集・新規ペア結成可能に）
      await supabase
        .from('mentorship_profiles')
        .update({ status: 'OPEN' })
        .in('id', [match.mentor_profile_id, match.pupil_profile_id]);

      // 卒業ボーナス (+200コイン) を両者に付与
      try {
        const mentorPlayer = await findOrCreatePlayer({ discordId: match.mentor_discord_id });
        const pupilPlayer = await findOrCreatePlayer({ discordId: match.pupil_discord_id });
        if (mentorPlayer) {
          await updatePlayerCoinsAndInventory({
            player: mentorPlayer,
            newCoins: getPlayerCoins(mentorPlayer) + 200,
          });
        }
        if (pupilPlayer) {
          await updatePlayerCoinsAndInventory({
            player: pupilPlayer,
            newCoins: getPlayerCoins(pupilPlayer) + 200,
          });
        }
      } catch (coinErr) {
        console.warn('[mentorship/matches] Complete bonus coin warning:', coinErr);
      }

      // Discordへ卒業祝賀アナウンス送信 (#🤝師弟募集 ＆ 双方DM)
      const meta = parseNotesMeta(match.notes);
      sendDiscordGraduationAnnounce(
        match.mentor?.player_name || '師匠',
        match.pupil?.player_name || '弟子',
        meta.durationLabel,
        match.mentor_discord_id,
        match.pupil_discord_id
      ).catch(() => {});

      syncMentorshipDashboard().catch(() => {});

      return NextResponse.json({
        ok: true,
        message: '🎓 師弟ペアの目標達成・円満卒業が完了しました！(+200コイン獲得)',
      });
    }



    // ==========================================
    // 3. 円満解散・リセット (CANCEL / DISBAND)
    // ==========================================
    if (action === 'CANCEL') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '対象のマッチIDが必要です。' }, { status: 400 });
      }

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
      }

      const currentMeta = parseNotesMeta(match.notes);
      const newMeta: MatchMeta = {
        ...currentMeta,
        cancelReason: reason,
      };

      await supabase
        .from('mentorship_matches')
        .update({
          status: 'CANCELLED',
          completed_at: new Date().toISOString(),
          notes: JSON.stringify(newMeta),
        })
        .eq('id', matchId);

      // プロフィールステータスを OPEN に戻す（即座に再募集可能）
      await supabase
        .from('mentorship_profiles')
        .update({ status: 'OPEN' })
        .in('id', [match.mentor_profile_id, match.pupil_profile_id]);

      syncMentorshipDashboard().catch(() => {});

      return NextResponse.json({
        ok: true,
        message: '🍃 師弟ペアを円満解散しました。プロフィールが再公開され、新たな相手を探せます。',
      });
    }

    // ==========================================
    // 4. 申請承諾 (ACCEPT)
    // ==========================================
    if (action === 'ACCEPT') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '承諾するマッチIDが必要です。' }, { status: 400 });
      }

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select(`
          *,
          mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
          pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
        `)
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: '申請が見つかりません。' }, { status: 404 });
      }

      // 既に成立済みの場合は二重処理（多重DM・多重コイン付与）を完全にスキップ
      if (match.status === 'ACTIVE') {
        return NextResponse.json({ ok: true, message: '既に師弟ペアが成立しています。' });
      }

      await supabase
        .from('mentorship_matches')
        .update({
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      // 弟子側は1対1専任のため MATCHED に更新
      await supabase
        .from('mentorship_profiles')
        .update({ status: 'MATCHED' })
        .eq('id', match.pupil_profile_id);

      // 師匠側は受入枠上限（max_pupils）をチェック
      const mentorMaxPupils = match.mentor?.max_pupils !== undefined && match.mentor?.max_pupils !== null
        ? match.mentor.max_pupils
        : 3;

      const { count: activeMentorMatchesCount } = await supabase
        .from('mentorship_matches')
        .select('id', { count: 'exact', head: true })
        .eq('mentor_profile_id', match.mentor_profile_id)
        .eq('status', 'ACTIVE');

      const currentMentorActive = activeMentorMatchesCount || 1;
      const newMentorStatus = currentMentorActive >= mentorMaxPupils ? 'MATCHED' : 'OPEN';

      await supabase
        .from('mentorship_profiles')
        .update({ status: newMentorStatus })
        .eq('id', match.mentor_profile_id);

      // 両者に成立ボーナス (+300コイン) を付与
      try {
        const mentorPlayer = await findOrCreatePlayer({ discordId: match.mentor_discord_id });
        const pupilPlayer = await findOrCreatePlayer({ discordId: match.pupil_discord_id });
        if (mentorPlayer) {
          await updatePlayerCoinsAndInventory({
            player: mentorPlayer,
            newCoins: getPlayerCoins(mentorPlayer) + 300,
          });
        }
        if (pupilPlayer) {
          await updatePlayerCoinsAndInventory({
            player: pupilPlayer,
            newCoins: getPlayerCoins(pupilPlayer) + 300,
          });
        }
      } catch (coinErr) {
        console.warn('[mentorship/matches] Coin reward warning:', coinErr);
      }

      // 🎓 指定のフォーラムチャンネル (1524740558550073496) に専用指導スレッドを作成
      const meta = parseNotesMeta(match.notes);
      let threadResult: { threadId: string; threadUrl: string } | null = null;
      try {
        threadResult = await createMentorshipForumThread({
          mentorName: match.mentor?.player_name || '師匠',
          pupilName: match.pupil?.player_name || '弟子',
          durationLabel: meta.durationLabel,
          mentorDiscordId: match.mentor_discord_id,
          pupilDiscordId: match.pupil_discord_id,
          lanes: [
            ...(Array.isArray(match.mentor?.lanes) ? match.mentor.lanes : []),
            ...(Array.isArray(match.pupil?.lanes) ? match.pupil.lanes : []),
          ],
          commStyle: meta.commStyle,
        });
      } catch (thErr) {
        console.warn('[mentorship/matches] Failed to create mentorship forum thread:', thErr);
      }

      if (threadResult) {
        meta.threadId = threadResult.threadId;
        meta.threadUrl = threadResult.threadUrl;
        await supabase
          .from('mentorship_matches')
          .update({ notes: JSON.stringify(meta) })
          .eq('id', matchId);
      }

      // Discord通知を非同期送信（師匠・弟子の双方へDM + 募集チャンネル）
      sendDiscordPairAnnounce(
        match.mentor?.player_name || '師匠',
        match.pupil?.player_name || '弟子',
        meta.durationLabel,
        match.mentor_discord_id,
        match.pupil_discord_id,
        threadResult?.threadUrl
      ).catch(() => {});

      syncMentorshipDashboard().catch(() => {});

      return NextResponse.json({
        ok: true,
        message: '師弟ペアが正式に成立しました！専用指導チャットを作成しました(+300コイン付与)',
        threadUrl: threadResult?.threadUrl,
      });
    }

    // ==========================================
    // 4.5 専用Discordスレッド作成 (CREATE_THREAD)
    // ==========================================
    if (action === 'CREATE_THREAD') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '対象のマッチIDが必要です。' }, { status: 400 });
      }

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select(`
          *,
          mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
          pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
        `)
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
      }

      const meta = parseNotesMeta(match.notes);
      const threadResult = await createMentorshipForumThread({
        mentorName: match.mentor?.player_name || '師匠',
        pupilName: match.pupil?.player_name || '弟子',
        durationLabel: meta.durationLabel,
        mentorDiscordId: match.mentor_discord_id,
        pupilDiscordId: match.pupil_discord_id,
        lanes: [
          ...(Array.isArray(match.mentor?.lanes) ? match.mentor.lanes : []),
          ...(Array.isArray(match.pupil?.lanes) ? match.pupil.lanes : []),
        ],
        commStyle: meta.commStyle,
      });

      if (!threadResult) {
        return NextResponse.json({ ok: false, error: 'スレッド作成に失敗しました。' }, { status: 500 });
      }

      meta.threadId = threadResult.threadId;
      meta.threadUrl = threadResult.threadUrl;

      await supabase
        .from('mentorship_matches')
        .update({ notes: JSON.stringify(meta) })
        .eq('id', matchId);

      return NextResponse.json({
        ok: true,
        message: '専用指導スレッドを作成しました！',
        threadUrl: threadResult.threadUrl,
      });
    }

    // ==========================================
    // 5. 指導メモ・進捗更新 (UPDATE_PROGRESS)
    // ==========================================
    if (action === 'UPDATE_PROGRESS') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '対象のマッチIDが必要です。' }, { status: 400 });
      }

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
      }

      // 本人確認 (mentor または pupil または admin)
      const isParticipant =
        match.mentor_discord_id === session.discordId ||
        match.pupil_discord_id === session.discordId ||
        session.isAdmin;

      if (!isParticipant) {
        return NextResponse.json({ ok: false, error: '参加者のみがメモを更新できます。' }, { status: 403 });
      }

      const currentMeta = parseNotesMeta(match.notes);
      const newMeta: MatchMeta = {
        ...currentMeta,
        progressNotes: body.progressNotes !== undefined ? body.progressNotes : currentMeta.progressNotes,
        targetRank: body.targetRank !== undefined ? body.targetRank : currentMeta.targetRank,
      };

      await supabase
        .from('mentorship_matches')
        .update({
          notes: JSON.stringify(newMeta),
        })
        .eq('id', matchId);

      return NextResponse.json({
        ok: true,
        message: '📝 指導メモ・目標進捗を更新しました！',
        meta: newMeta,
      });
    }

    // ==========================================
    // 6. 申請辞退 (REJECT)
    // ==========================================
    if (action === 'REJECT') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '辞退するマッチIDが必要です。' }, { status: 400 });
      }

      await supabase
        .from('mentorship_matches')
        .update({ status: 'REJECTED' })
        .eq('id', matchId);

      return NextResponse.json({ ok: true, message: '申請を見送りました。' });
    }

    // ==========================================
    // 6. 申請送信 (APPLY)
    // ==========================================

    if (!targetProfileId) {
      return NextResponse.json({ ok: false, error: '相手のプロフィールIDが必要です。' }, { status: 400 });
    }

    const { data: targetProfile, error: tErr } = await supabase
      .from('mentorship_profiles')
      .select('*')
      .eq('id', targetProfileId)
      .single();

    if (tErr || !targetProfile) {
      return NextResponse.json({ ok: false, error: '対象のプロフィールが見つかりません。' }, { status: 404 });
    }

    if (targetProfile.discord_id === session.discordId) {
      return NextResponse.json({ ok: false, error: '自分自身のカードには申請できません。' }, { status: 400 });
    }

    const myRoleType = targetProfile.role_type === 'PUPIL' ? 'MENTOR' : 'PUPIL';
    let { data: myProfile } = await supabase
      .from('mentorship_profiles')
      .select('*')
      .eq('discord_id', session.discordId)
      .eq('role_type', myRoleType)
      .maybeSingle();

    if (!myProfile) {
      const myPlayer = await findOrCreatePlayer({
        discordId: session.discordId,
        name: session.displayName || session.username || 'Player',
      });
      const { data: createdProfile } = await supabase
        .from('mentorship_profiles')
        .insert({
          player_id: myPlayer?.id || null,
          discord_id: session.discordId,
          player_name: session.displayName || session.username || myPlayer?.name || 'Player',
          role_type: myRoleType,
          current_rank: myPlayer?.highest_rank || 'UNRANKED',
          status: 'OPEN',
        })
        .select()
        .single();
      myProfile = createdProfile;
    }

    const mentorId = targetProfile.role_type === 'MENTOR' ? targetProfile.id : myProfile.id;
    const pupilId = targetProfile.role_type === 'PUPIL' ? targetProfile.id : myProfile.id;
    const mentorDiscord = targetProfile.role_type === 'MENTOR' ? targetProfile.discord_id : session.discordId;
    const pupilDiscord = targetProfile.role_type === 'PUPIL' ? targetProfile.discord_id : session.discordId;

    // 既に PENDING または ACTIVE な関係があるかチェック
    const { data: existingMatch } = await supabase
      .from('mentorship_matches')
      .select('*')
      .eq('mentor_profile_id', mentorId)
      .eq('pupil_profile_id', pupilId)
      .in('status', ['PENDING', 'ACTIVE'])
      .maybeSingle();

    if (existingMatch) {
      return NextResponse.json(
        { ok: false, error: '既に申請中またはペアが成立しています。' },
        { status: 400 }
      );
    }

    const durObj = MENTORSHIP_DURATIONS[durationKey] || MENTORSHIP_DURATIONS['14_DAYS'];
    const notesJson = encodeNotesMeta({
      durationKey,
      durationLabel: durObj.label,
      durationDays: durObj.days,
      commStyle,
      autoRenew: !!autoRenew,
      message: message.trim() || 'よろしくお願いします！',
      fromDiscordId: session.discordId,
    });

    const { data: match, error: mErr } = await supabase
      .from('mentorship_matches')
      .insert({
        mentor_profile_id: mentorId,
        pupil_profile_id: pupilId,
        mentor_discord_id: mentorDiscord,
        pupil_discord_id: pupilDiscord,
        status: 'PENDING',
        notes: notesJson,
      })
      .select()
      .single();

    if (mErr) throw mErr;

    // Discordへオファー速報を非同期送信（案3）
    sendDiscordOfferNotification(
      session.displayName || session.username || 'メンバー',
      targetProfile.player_name,
      targetProfile.discord_id,
      durObj.label,
      message.trim() || 'よろしくお願いします！'
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: `${targetProfile.player_name} さんへ「${durObj.label}」の申請を送信しました！相手が承諾すると正式にペア結成となります。`,
      match,
    });

  } catch (err: any) {
    console.error('[mentorship/matches] POST error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/matches',
      method: 'POST',
      error: err,
      statusCode: 500,
      userId: session?.discordId,
      userName: session?.displayName,
      context: {
        body: body || undefined,
      },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}


