import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

/**
 * GET: 成立済みペア一覧 ＆ ログインユーザーの申請一覧（受信/送信）の取得
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    const myDiscordId = session?.discordId;

    // 1. 成立済みペア一覧 (ACTIVE)
    const { data: rawMatches } = await supabase
      .from('mentorship_matches')
      .select(`
        *,
        mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
      `)
      .eq('status', 'ACTIVE')
      .order('started_at', { ascending: false });

    // 2. ログインユーザー宛の受信申請 (PENDING)
    let pendingReceived: any[] = [];
    let pendingSent: any[] = [];

    if (myDiscordId) {
      const { data: received } = await supabase
        .from('mentorship_matches')
        .select(`
          *,
          mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
          pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
        `)
        .eq('status', 'PENDING')
        .or(`mentor_discord_id.eq.${myDiscordId},pupil_discord_id.eq.${myDiscordId}`);

      if (received) {
        // 自分が受信者か送信者かを判定
        // notes 内に applicant_id があるか、または mentor/pupil で判定
        pendingReceived = received.filter((m: any) => {
          const isSender = (m.notes?.includes(`[FROM:${myDiscordId}]`));
          return !isSender;
        });
        pendingSent = received.filter((m: any) => {
          const isSender = (m.notes?.includes(`[FROM:${myDiscordId}]`));
          return isSender;
        });
      }
    }

    return NextResponse.json({
      ok: true,
      matches: rawMatches || [],
      pendingReceived,
      pendingSent,
    });
  } catch (err: any) {
    console.error('[mentorship/matches] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: 師弟マッチング操作 (APPLY: 申請 / ACCEPT: 承諾 / REJECT: 辞退)
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
    const { action = 'APPLY', targetProfileId, matchId, message = '' } = body;

    // ==========================================
    // 1. 申請承諾 (ACCEPT)
    // ==========================================
    if (action === 'ACCEPT') {
      if (!matchId) {
        return NextResponse.json({ ok: false, error: '承諾するマッチIDが必要です。' }, { status: 400 });
      }

      // マッチ情報を取得
      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ ok: false, error: '申請が見つかりません。' }, { status: 404 });
      }

      // ステータスを ACTIVE に更新
      await supabase
        .from('mentorship_matches')
        .update({
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      // 両プロフィールのステータスを MATCHED に更新
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

      return NextResponse.json({ ok: true, message: '師弟ペアが正式に成立しました！(+300コイン付与)' });
    }

    // ==========================================
    // 2. 申請辞退 (REJECT)
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
    // 3. 申請送信 (APPLY)
    // ==========================================
    if (!targetProfileId) {
      return NextResponse.json({ ok: false, error: '相手のプロフィールIDが必要です。' }, { status: 400 });
    }

    // 相手のプロフィールを取得
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

    // 自分のプロフィールを取得（相手と逆のロール）
    const myRoleType = targetProfile.role_type === 'PUPIL' ? 'MENTOR' : 'PUPIL';
    let { data: myProfile } = await supabase
      .from('mentorship_profiles')
      .select('*')
      .eq('discord_id', session.discordId)
      .eq('role_type', myRoleType)
      .maybeSingle();

    // 自分のプロフィールがまだ無ければ自動作成
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

    // 申請（PENDING）を作成
    const cleanMsg = message.trim() || 'よろしくお願いします！';
    const notesPayload = `[FROM:${session.discordId}] ${cleanMsg}`;

    const { data: match, error: mErr } = await supabase
      .from('mentorship_matches')
      .insert({
        mentor_profile_id: mentorId,
        pupil_profile_id: pupilId,
        mentor_discord_id: mentorDiscord,
        pupil_discord_id: pupilDiscord,
        status: 'PENDING',
        notes: notesPayload,
      })
      .select()
      .single();

    if (mErr) throw mErr;

    return NextResponse.json({
      ok: true,
      message: `${targetProfile.player_name} さんへ申請を送信しました！相手が承諾すると正式にペア結成となります。`,
      match,
    });
  } catch (err: any) {
    console.error('[mentorship/matches] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
