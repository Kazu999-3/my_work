import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { MENTORSHIP_DURATIONS } from '../../../../lib/mentorshipConstants';

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
  };
  return JSON.stringify(fullMeta);
}

/**
 * Discord への師弟ペア結成速報の通知ヘルパー
 */
async function sendDiscordPairAnnounce(mentorName: string, pupilName: string, durationLabel: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_RECRUIT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const payload = {
      embeds: [
        {
          title: '🎉 【KTM師弟ハブ】新たな師弟ペアが結成されました！',
          description: `👑 **師匠:** ${mentorName}\n🌱 **弟子:** ${pupilName}\n⏱️ **活動期間:** ${durationLabel}\n\nお互いに楽しく上達していきましょう！キックオフガイドに沿ってまずは挨拶からスタート🤝`,
          color: 0x10b981, // エメラルドグリーン
          timestamp: new Date().toISOString(),
          footer: {
            text: 'KTM 師弟マッチング ＆ 自己紹介ハブ',
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[mentorship/matches] Discord announce error:', err);
  }
}

/**
 * GET: 成立済みペア一覧 ＆ ログインユーザーの申請一覧（受信/送信）の取得
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    const myDiscordId = session?.discordId;

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
    });
  } catch (err: any) {
    console.error('[mentorship/matches] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: 師弟マッチング操作 (APPLY / ACCEPT / REJECT / EXTEND / COMPLETE / CANCEL)
 */
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'オファーを行うにはDiscordログインが必要です。' },
        { status: 401 }
      );
    }

    const body = await request.json();
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
        .select('*')
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: 'マッチが見つかりません。' }, { status: 404 });
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

      await supabase
        .from('mentorship_matches')
        .update({
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      await supabase
        .from('mentorship_profiles')
        .update({ status: 'MATCHED' })
        .in('id', [match.mentor_profile_id, match.pupil_profile_id]);

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

      // Discord通知を非同期送信
      const meta = parseNotesMeta(match.notes);
      sendDiscordPairAnnounce(
        match.mentor?.player_name || '師匠',
        match.pupil?.player_name || '弟子',
        meta.durationLabel
      ).catch(() => {});

      return NextResponse.json({ ok: true, message: '師弟ペアが正式に成立しました！(+300コイン付与)' });
    }

    // ==========================================
    // 5. 申請辞退 (REJECT)
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

    return NextResponse.json({
      ok: true,
      message: `${targetProfile.player_name} さんへ「${durObj.label}」の申請を送信しました！相手が承諾すると正式にペア結成となります。`,
      match,
    });
  } catch (err: any) {
    console.error('[mentorship/matches] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}


