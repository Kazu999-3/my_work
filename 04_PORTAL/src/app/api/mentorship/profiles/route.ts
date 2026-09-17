import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer } from '../../../../lib/playerCoins';
import { sendErrorNotification } from '../../../../lib/discordNotify';

export const dynamic = 'force-dynamic';

export interface MentorshipProfile {
  id: string;
  player_id: number | null;
  discord_id: string;
  player_name: string;
  role_type: 'PUPIL' | 'MENTOR';
  lanes: string[];
  champions: string[];
  current_rank: string;
  target_rank?: string;
  tags: string[];
  bio: string;
  active_hours: string;
  status: 'OPEN' | 'MATCHED' | 'PAUSED';
  max_pupils?: number; // 師匠の最大受入人数（デフォルト: 3）
  active_pupils_count?: number; // 現在進行中の弟子数
  active_pupil_names?: string[]; // 現在進行中の弟子たちの名前
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

/**
 * GET: 師弟プロフィールの取得（ロール・レーン別絞り込み対応）
 */
export async function GET(request: Request) {
  let myDiscordId: string | undefined = undefined;
  try {
    const { searchParams } = new URL(request.url);
    const roleType = searchParams.get('roleType'); // 'PUPIL' | 'MENTOR' | null
    const lane = searchParams.get('lane'); // 'TOP' | 'JUNGLE' | 'MID' | 'BOT' | 'SUPPORT' | null
    const status = searchParams.get('status') || 'OPEN';

    let query = supabase
      .from('mentorship_profiles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (roleType) {
      query = query.eq('role_type', roleType);
    }
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    if (lane && lane !== 'ALL') {
      query = query.contains('lanes', [lane]);
    }

    const { data: rawProfiles, error } = await query;

    if (error) {
      // テーブル未作成時などのフォールバック
      console.warn('[mentorship/profiles] select error:', error);
      return NextResponse.json({ ok: true, profiles: [] });
    }

    // 進行中（ACTIVE）のマッチを取得して各師匠の弟子数・名前を集計
    const { data: activeMatches } = await supabase
      .from('mentorship_matches')
      .select(`
        mentor_profile_id,
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(player_name)
      `)
      .eq('status', 'ACTIVE');

    const mentorActiveMap: Record<string, string[]> = {};
    if (activeMatches) {
      activeMatches.forEach((m: any) => {
        if (m.mentor_profile_id) {
          if (!mentorActiveMap[m.mentor_profile_id]) {
            mentorActiveMap[m.mentor_profile_id] = [];
          }
          const pName = m.pupil?.player_name;
          if (pName) {
            mentorActiveMap[m.mentor_profile_id].push(pName);
          }
        }
      });
    }

    const profiles: MentorshipProfile[] = (rawProfiles || []).map((p: any) => {
      const activePupils = mentorActiveMap[p.id] || [];
      const maxPupils = p.max_pupils !== undefined && p.max_pupils !== null ? p.max_pupils : 3;
      return {
        ...p,
        max_pupils: maxPupils,
        active_pupils_count: activePupils.length,
        active_pupil_names: activePupils,
      };
    });

    // セッション情報があれば自分のプロフィールIDおよび管理者権限も返す
    const session = await getAuthSession();
    myDiscordId = session?.discordId;
    const isAdmin = !!session?.isAdmin;

    return NextResponse.json({
      ok: true,
      profiles,
      myDiscordId: myDiscordId || null,
      isAdmin,
    });
  } catch (err: any) {
    console.error('[mentorship/profiles] GET error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/profiles',
      method: 'GET',
      error: err,
      statusCode: 500,
      userId: myDiscordId,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}


/**
 * POST: 自分の自己紹介プロフィールの作成または更新
 */
export async function POST(request: Request) {
  let session: any = null;
  try {
    session = await getAuthSession();
    const body = await request.json();
    const {
      role_type,
      lanes = [],
      champions = [],
      current_rank,
      target_rank,
      tags = [],
      bio = '',
      active_hours = '',
      status = 'OPEN',
      max_pupils = 3,
      discord_id: bodyDiscordId,
      player_name: bodyPlayerName,
    } = body;

    // Discord OAuth セッションがあれば優先、なければリクエストボディのフォールバックを使用
    const effectiveDiscordId = session?.discordId || bodyDiscordId || (bodyPlayerName ? `local_${bodyPlayerName}` : null);
    const effectivePlayerName = session?.displayName || session?.username || bodyPlayerName || 'Player';

    if (!effectiveDiscordId) {
      return NextResponse.json(
        { ok: false, error: 'プロフィールを登録するにはDiscordログインまたはプレイヤー選択が必要です。' },
        { status: 401 }
      );
    }

    const player = await findOrCreatePlayer({
      discordId: effectiveDiscordId,
      name: effectivePlayerName,
    });

    if (!role_type || !['PUPIL', 'MENTOR'].includes(role_type)) {
      return NextResponse.json(
        { ok: false, error: '役割（弟子/師匠）を選択してください。' },
        { status: 400 }
      );
    }

    const playerName = effectivePlayerName || player?.name || 'Player';
    const finalCurrentRank = current_rank || player?.highest_rank || 'UNRANKED';
    const finalMaxPupils = role_type === 'MENTOR' ? Math.min(Math.max(Number(max_pupils) || 3, 1), 5) : 1;

    // 既存のプロフィール（同一role_type）があるか確認
    const { data: existing } = await supabase
      .from('mentorship_profiles')
      .select('id')
      .eq('discord_id', effectiveDiscordId)
      .eq('role_type', role_type)
      .maybeSingle();

    let resultData;
    let isFirstTimeBonus = false;
    let updatedCoins = 1000;

    const basePayload: Record<string, any> = {
      player_name: playerName,
      lanes,
      champions,
      current_rank: finalCurrentRank,
      target_rank: role_type === 'PUPIL' ? target_rank : null,
      tags,
      bio,
      active_hours,
      status,
    };

    if (existing?.id) {
      // 更新（まず max_pupils カラムを含めて実行）
      let { data, error } = await supabase
        .from('mentorship_profiles')
        .update({
          ...basePayload,
          max_pupils: finalMaxPupils,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      // DB側に max_pupils カラムが未追加の場合の自動フォールバック
      if (error && (error.message?.includes('max_pupils') || error.code === 'PGRST204')) {
        console.warn('[mentorship/profiles] max_pupils カラム未検出のため除外して再試行:', error.message);
        const retry = await supabase
          .from('mentorship_profiles')
          .update({
            ...basePayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      resultData = data;
    } else {
      // 過去に他のロールでもプロフィールを作成したことがあるか確認
      const { count } = await supabase
        .from('mentorship_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('discord_id', effectiveDiscordId);

      const isFirstCreationEver = (count || 0) === 0;

      // 新規作成（まず max_pupils カラムを含めて実行）
      const insertBase: Record<string, any> = {
        player_id: player?.id || null,
        discord_id: effectiveDiscordId,
        role_type,
        ...basePayload,
      };

      let { data, error } = await supabase
        .from('mentorship_profiles')
        .insert({
          ...insertBase,
          max_pupils: finalMaxPupils,
        })
        .select()
        .single();

      // DB側に max_pupils カラムが未追加の場合の自動フォールバック
      if (error && (error.message?.includes('max_pupils') || error.code === 'PGRST204')) {
        console.warn('[mentorship/profiles] max_pupils カラム未検出のため除外して再試行:', error.message);
        const retry = await supabase
          .from('mentorship_profiles')
          .insert(insertBase)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      resultData = data;

      // 初回作成ボーナス（+500pt）を付与
      if (isFirstCreationEver && player) {
        const { getPlayerCoins, updatePlayerCoinsAndInventory } = await import('../../../../lib/playerCoins');
        const currentCoins = getPlayerCoins(player);
        const newCoins = currentCoins + 500;
        await updatePlayerCoinsAndInventory({
          player,
          newCoins,
        });
        isFirstTimeBonus = true;
        updatedCoins = newCoins;
      }
    }

    return NextResponse.json({
      ok: true,
      profile: resultData,
      isFirstTimeBonus,
      bonusCoins: isFirstTimeBonus ? 500 : 0,
      newCoins: updatedCoins,
    });
  } catch (err: any) {
    console.error('[mentorship/profiles] POST error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/profiles',
      method: 'POST',
      error: err,
      statusCode: 500,
      userId: session?.discordId,
      userName: session?.displayName,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: プロフィールを削除（本人のカードまたは管理者は全カード削除可能）
 */
export async function DELETE(request: Request) {
  let session: any = null;
  try {
    session = await getAuthSession();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const paramDiscordId = searchParams.get('discordId');

    const effectiveDiscordId = session?.discordId || paramDiscordId;
    const isAdmin = !!session?.isAdmin;

    if (!effectiveDiscordId && !isAdmin) {
      return NextResponse.json({ ok: false, error: '認証が必要です。' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Profile ID is required' }, { status: 400 });
    }

    let deleteQuery = supabase
      .from('mentorship_profiles')
      .delete()
      .eq('id', id);

    // 管理者でない場合は本人のカードのみ削除可能に制限
    if (!isAdmin && effectiveDiscordId) {
      deleteQuery = deleteQuery.eq('discord_id', effectiveDiscordId);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    return NextResponse.json({ ok: true, message: 'カードを削除しました。' });
  } catch (err: any) {
    console.error('[mentorship/profiles] DELETE error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/profiles',
      method: 'DELETE',
      error: err,
      statusCode: 500,
      userId: session?.discordId,
      userName: session?.displayName,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

