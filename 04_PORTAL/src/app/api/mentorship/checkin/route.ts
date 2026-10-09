import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { verifyBotSecret } from '../../../../lib/botAuth';
import { updatePlayerCoinsAndInventory, findOrCreatePlayer } from '../../../../lib/playerCoins';
import {
  parseNotesMeta,
  encodeNotesMeta,
  MentorshipCheckin,
} from '../matches/route';
import { sendDiscordDirectMessage } from '../../../../lib/discordNotify';

export const dynamic = 'force-dynamic';

/**
 * 師弟チェックイン通知・サマリーをDiscordへ送信するヘルパー
 */
async function sendDiscordCheckinSummary(
  threadId: string | undefined,
  mentorDiscordId: string | undefined,
  pupilDiscordId: string | undefined,
  mentorName: string,
  pupilName: string,
  checkin: MentorshipCheckin
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const portalUrl = 'https://my-work-8jbd.vercel.app/mentorship';

  const stars = '⭐'.repeat(checkin.pupilFeedback?.rating || 5);
  const embed = {
    title: '🎉 【成長カルテ】第1回 師弟中間チェックイン完了！',
    description: `👑 **師匠:** ${mentorName}\n🌱 **弟子:** ${pupilName}\n\nお互いの振り返りとアドバイスが出揃いました！✨\n継続ボーナスとして両名に **+100コイン** を進呈しました！🪙`,
    color: 0x10b981, // Emerald
    fields: [
      {
        name: `🌱 弟子の手応え＆目標 (${stars})`,
        value: `**実感:** ${checkin.pupilFeedback?.growthNote || '順調に成長中！'}\n**次の目標:** ${checkin.pupilFeedback?.challenges || 'さらなる勝率UP！'}`,
        inline: false,
      },
      {
        name: `👑 師匠の褒め＆アドバイス`,
        value: `**上達ポイント:** ${checkin.mentorFeedback?.praise || '素晴らしい成長ぶりです！'}\n**次の一歩:** ${checkin.mentorFeedback?.advice || 'この調子でいきましょう！'}`,
        inline: false,
      },
    ],
    footer: {
      text: 'KTM 師弟マッチング ＆ 成長カルテ',
    },
    timestamp: new Date().toISOString(),
  };

  // 1. スレッドへの投稿（優先）
  if (botToken && threadId) {
    try {
      await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `🎉 <@${mentorDiscordId}> 師匠 ＆ <@${pupilDiscordId}> 弟子の中間チェックインが完了しました！`,
          embeds: [embed],
        }),
      });
      return;
    } catch (e) {
      console.warn('[mentorship/checkin] Thread summary post failed:', e);
    }
  }

  // 2. スレッドがない場合は両名へDM
  if (mentorDiscordId) {
    sendDiscordDirectMessage(mentorDiscordId, { embeds: [embed] }).catch(() => {});
  }
  if (pupilDiscordId) {
    sendDiscordDirectMessage(pupilDiscordId, { embeds: [embed] }).catch(() => {});
  }
}

/**
 * GET: 特定ペアのチェックイン一覧またはアクティブペアのチェックイン状況
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
    }

    const { data: match, error } = await supabase
      .from('mentorship_matches')
      .select(`
        *,
        mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
      `)
      .eq('id', matchId)
      .single();

    if (error || !match) {
      return NextResponse.json({ ok: false, error: 'ペアが見つかりません。' }, { status: 404 });
    }

    const meta = parseNotesMeta(match.notes);
    return NextResponse.json({
      ok: true,
      matchId: match.id,
      status: match.status,
      checkins: meta.checkins || [],
    });
  } catch (err: any) {
    console.error('[mentorship/checkin] GET Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: チェックインの回答送信、またはトリガー発火
 */
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    const hasBotSecret = request.headers.has('x-bot-secret') && verifyBotSecret(request).ok;

    const body = await request.json().catch(() => ({}));
    const { matchId, role, feedback, action } = body;

    // 🤖 1. 全自動チェックイン発火トリガー（7日経過 または 3戦消化）
    if (action === 'trigger_check') {
      const { data: activeMatches } = await supabase
        .from('mentorship_matches')
        .select(`
          *,
          mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
          pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
        `)
        .eq('status', 'ACTIVE');

      const triggered: string[] = [];

      for (const m of (activeMatches || [])) {
        const meta = parseNotesMeta(m.notes);
        const checkins = meta.checkins || [];

        // 既に完了または保留中のチェックインがある場合はスキップ
        if (checkins.length > 0) continue;

        const started = m.started_at ? new Date(m.started_at) : new Date(m.created_at);
        const now = new Date();
        const daysDiff = (now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24);

        // KTMカスタム参加試合数の確認（結成日以降に弟子が参加した試合数）
        const pupilPlayerId = m.pupil?.player_id;
        let matchCount = 0;
        if (pupilPlayerId) {
          const { count } = await supabase
            .from('ktm_matches')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', started.toISOString())
            .or(`blue_player_ids.cs.{${pupilPlayerId}},red_player_ids.cs.{${pupilPlayerId}}`);
          matchCount = count || 0;
        }

        // 条件: 7日経過 または 3戦消化
        let triggerType: 'DAYS_7' | 'MATCHES_3' | null = null;
        if (daysDiff >= 7) {
          triggerType = 'DAYS_7';
        } else if (matchCount >= 3) {
          triggerType = 'MATCHES_3';
        }

        if (triggerType) {
          const newCheckin: MentorshipCheckin = {
            id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            trigger: triggerType,
            triggeredAt: new Date().toISOString(),
            status: 'PENDING',
          };

          meta.checkins = [newCheckin];
          await supabase
            .from('mentorship_matches')
            .update({ notes: encodeNotesMeta(meta) })
            .eq('id', m.id);

          // Discord専用スレッドまたはDMへ通知
          await sendDiscordCheckinPrompt(m, triggerType, newCheckin.id);
          triggered.push(m.id);
        }
      }

      return NextResponse.json({
        ok: true,
        triggeredCount: triggered.length,
        triggeredIds: triggered,
      });
    }

    // 📝 2. チェックイン回答の送信
    if (!matchId || !role || !feedback) {
      return NextResponse.json({ ok: false, error: 'matchId, role, feedback are required' }, { status: 400 });
    }

    const { data: match, error } = await supabase
      .from('mentorship_matches')
      .select(`
        *,
        mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
      `)
      .eq('id', matchId)
      .single();

    if (error || !match) {
      return NextResponse.json({ ok: false, error: '対象のペアが見つかりません。' }, { status: 404 });
    }

    // 権限検証（ログインユーザー本人 or Bot認証）
    const myDiscordId = session?.discordId;
    if (!hasBotSecret && myDiscordId) {
      const isMentor = match.mentor?.discord_id === myDiscordId;
      const isPupil = match.pupil?.discord_id === myDiscordId;
      if (role === 'mentor' && !isMentor) {
        return NextResponse.json({ ok: false, error: '師匠のみ回答可能です。' }, { status: 403 });
      }
      if (role === 'pupil' && !isPupil) {
        return NextResponse.json({ ok: false, error: '弟子のみ回答可能です。' }, { status: 403 });
      }
    }

    const meta = parseNotesMeta(match.notes);
    const checkins = meta.checkins || [];

    // 最新のPENDINGチェックインを探す（無ければ自動生成）
    let currentCheckin = checkins.find((c) => c.status === 'PENDING');
    if (!currentCheckin) {
      currentCheckin = {
        id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        trigger: 'DAYS_7',
        triggeredAt: new Date().toISOString(),
        status: 'PENDING',
      };
      checkins.unshift(currentCheckin);
    }

    const nowIso = new Date().toISOString();

    if (role === 'pupil') {
      currentCheckin.pupilFeedback = {
        rating: Math.min(5, Math.max(1, Number(feedback.rating) || 5)),
        growthNote: String(feedback.growthNote || '').trim(),
        challenges: String(feedback.challenges || '').trim(),
        submittedAt: nowIso,
      };
    } else if (role === 'mentor') {
      currentCheckin.mentorFeedback = {
        praise: String(feedback.praise || '').trim(),
        advice: String(feedback.advice || '').trim(),
        submittedAt: nowIso,
      };
    }

    // 両者の回答が揃ったか判定
    const isCompleted = !!(currentCheckin.pupilFeedback && currentCheckin.mentorFeedback);
    if (isCompleted) {
      currentCheckin.status = 'COMPLETED';

      // 🎁 継続ボーナス付与: 師匠・弟子に各+100コイン
      const mentorDiscordId = match.mentor?.discord_id;
      const pupilDiscordId = match.pupil?.discord_id;

      if (mentorDiscordId) {
        const mPlayer = await findOrCreatePlayer({
          discordId: mentorDiscordId,
          name: match.mentor?.player_name,
        });
        if (mPlayer) {
          await updatePlayerCoinsAndInventory({
            player: mPlayer,
            newCoins: (mPlayer.coins ?? 1000) + 100,
            reason: 'mentorship_checkin',
            reasonMetadata: { role: 'mentor', matchId: match.id },
          });
        }
      }

      if (pupilDiscordId) {
        const pPlayer = await findOrCreatePlayer({
          discordId: pupilDiscordId,
          name: match.pupil?.player_name,
        });
        if (pPlayer) {
          await updatePlayerCoinsAndInventory({
            player: pPlayer,
            newCoins: (pPlayer.coins ?? 1000) + 100,
            reason: 'mentorship_checkin',
            reasonMetadata: { role: 'pupil', matchId: match.id },
          });
        }
      }

      // DiscordスレッドまたはDMへ完成サマリーを投稿
      await sendDiscordCheckinSummary(
        meta.threadId,
        match.mentor?.discord_id,
        match.pupil?.discord_id,
        match.mentor?.player_name || '師匠',
        match.pupil?.player_name || '弟子',
        currentCheckin
      );
    }

    meta.checkins = checkins;
    await supabase
      .from('mentorship_matches')
      .update({ notes: encodeNotesMeta(meta) })
      .eq('id', match.id);

    return NextResponse.json({
      ok: true,
      completed: isCompleted,
      checkin: currentCheckin,
      message: isCompleted
        ? '中間チェックインが完了し、両名に+100コインが進呈されました！🎉'
        : '振り返りが保存されました。相手の回答をお待ちください。',
    });
  } catch (err: any) {
    console.error('[mentorship/checkin] POST Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * 師弟チェックインの回答を促すメッセージをDiscordへ送信する
 */
async function sendDiscordCheckinPrompt(
  match: any,
  triggerType: 'DAYS_7' | 'MATCHES_3',
  checkinId: string
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const meta = parseNotesMeta(match.notes);
  const threadId = meta.threadId;

  const triggerLabel = triggerType === 'MATCHES_3' ? 'KTMカスタム3戦消化' : '結成7日経過';
  const embed = {
    title: '🎒 【中間チェックイン】師弟活動の振り返り時期です！',
    description:
      `👑 **師匠:** ${match.mentor?.player_name}\n🌱 **弟子:** ${match.pupil?.player_name}\n⏱️ **契機:** ${triggerLabel}\n\n` +
      `活動開始から順調に進んでいますか？✨\n下のボタンから **1分でサクッと** 振り返りを記入してみましょう！\n` +
      `両者の回答が揃うと **成長カルテ** が生成され、両名に **+100コイン** が進呈されます！🪙`,
    color: 0x6366f1, // Indigo
    footer: {
      text: 'KTM 師弟マッチング ＆ 成長カルテ',
    },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 1, // PRIMARY
          custom_id: `mentorship_checkin_pupil_${match.id}_${checkinId}`,
          label: '📝 弟子の振り返りを記入',
          emoji: { name: '🌱' },
        },
        {
          type: 2, // BUTTON
          style: 2, // SECONDARY
          custom_id: `mentorship_checkin_mentor_${match.id}_${checkinId}`,
          label: '🧑‍🏫 師匠のアドバイスを記入',
          emoji: { name: '👑' },
        },
      ],
    },
  ];

  // 1. スレッドへの投稿（優先）
  if (botToken && threadId) {
    try {
      await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `🎒 <@${match.mentor?.discord_id}> 師匠 ＆ <@${match.pupil?.discord_id}> 弟子への中間チェックイン案内です！`,
          embeds: [embed],
          components,
        }),
      });
      return;
    } catch (e) {
      console.warn('[mentorship/checkin] Thread prompt send failed:', e);
    }
  }

  // 2. スレッドがない場合は両名へDM
  if (match.mentor?.discord_id) {
    sendDiscordDirectMessage(match.mentor.discord_id, { embeds: [embed], components }).catch(() => {});
  }
  if (match.pupil?.discord_id) {
    sendDiscordDirectMessage(match.pupil.discord_id, { embeds: [embed], components }).catch(() => {});
  }
}
