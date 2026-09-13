import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { getAuthSession } from '@/lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '@/lib/playerCoins';

export const dynamic = 'force-dynamic';

/**
 * GET: 成立済みペア一覧の取得
 */
export async function GET() {
  try {
    const { data: matches, error } = await supabase
      .from('mentorship_matches')
      .select(`
        *,
        mentor:mentorship_profiles!mentorship_matches_mentor_profile_id_fkey(*),
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(*)
      `)
      .order('started_at', { ascending: false });

    if (error) {
      // フォールバック
      const { data: rawMatches } = await supabase
        .from('mentorship_matches')
        .select('*')
        .order('started_at', { ascending: false });
      return NextResponse.json({ ok: true, matches: rawMatches || [] });
    }

    return NextResponse.json({ ok: true, matches: matches || [] });
  } catch (err: any) {
    console.error('[mentorship/matches] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: 師弟コンビ成立（マッチング成立）
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
    const { targetProfileId, message = '' } = body;

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

    // マッチを作成
    const { data: match, error: mErr } = await supabase
      .from('mentorship_matches')
      .insert({
        mentor_profile_id: mentorId,
        pupil_profile_id: pupilId,
        mentor_discord_id: mentorDiscord,
        pupil_discord_id: pupilDiscord,
        status: 'ACTIVE',
        notes: message || 'Webポータルからの申請により成立',
      })
      .select()
      .single();

    if (mErr) throw mErr;

    // プロフィールのステータスを MATCHED に更新
    await supabase
      .from('mentorship_profiles')
      .update({ status: 'MATCHED' })
      .in('id', [mentorId, pupilId]);

    // 両者にボーナスコイン (+300コイン) を付与
    try {
      const mentorPlayer = await findOrCreatePlayer({ discordId: mentorDiscord });
      const pupilPlayer = await findOrCreatePlayer({ discordId: pupilDiscord });
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

    return NextResponse.json({ ok: true, match });
  } catch (err: any) {
    console.error('[mentorship/matches] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
