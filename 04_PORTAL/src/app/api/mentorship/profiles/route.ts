import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer } from '../../../../lib/playerCoins';

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
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

/**
 * GET: 師弟プロフィールの取得（ロール・レーン別絞り込み対応）
 */
export async function GET(request: Request) {
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

    const { data: profiles, error } = await query;

    if (error) {
      // テーブル未作成時などのフォールバック
      console.warn('[mentorship/profiles] select error:', error);
      return NextResponse.json({ ok: true, profiles: [] });
    }

    // セッション情報があれば自分のプロフィールIDも判定できるように返す
    const session = await getAuthSession();
    const myDiscordId = session?.discordId || null;

    return NextResponse.json({
      ok: true,
      profiles: profiles || [],
      myDiscordId,
    });
  } catch (err: any) {
    console.error('[mentorship/profiles] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: 自分の自己紹介プロフィールの作成または更新
 */
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'プロフィールを登録するにはDiscordログインが必要です。' },
        { status: 401 }
      );
    }

    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username || 'Player',
    });

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
    } = body;

    if (!role_type || !['PUPIL', 'MENTOR'].includes(role_type)) {
      return NextResponse.json(
        { ok: false, error: '役割（弟子/師匠）を選択してください。' },
        { status: 400 }
      );
    }

    const playerName = session.displayName || session.username || player?.name || 'Player';
    const finalCurrentRank = current_rank || player?.highest_rank || 'UNRANKED';

    // 既存のプロフィール（同一role_type）があるか確認
    const { data: existing } = await supabase
      .from('mentorship_profiles')
      .select('id')
      .eq('discord_id', session.discordId)
      .eq('role_type', role_type)
      .maybeSingle();

    let resultData;
    if (existing?.id) {
      // 更新
      const { data, error } = await supabase
        .from('mentorship_profiles')
        .update({
          player_name: playerName,
          lanes,
          champions,
          current_rank: finalCurrentRank,
          target_rank: role_type === 'PUPIL' ? target_rank : null,
          tags,
          bio,
          active_hours,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    } else {
      // 新規作成
      const { data, error } = await supabase
        .from('mentorship_profiles')
        .insert({
          player_id: player?.id || null,
          discord_id: session.discordId,
          player_name: playerName,
          role_type,
          lanes,
          champions,
          current_rank: finalCurrentRank,
          target_rank: role_type === 'PUPIL' ? target_rank : null,
          tags,
          bio,
          active_hours,
          status,
        })
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    }

    return NextResponse.json({ ok: true, profile: resultData });
  } catch (err: any) {
    console.error('[mentorship/profiles] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: 自分のプロフィールを削除
 */
export async function DELETE(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: '認証が必要です。' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Profile ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('mentorship_profiles')
      .delete()
      .eq('id', id)
      .eq('discord_id', session.discordId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[mentorship/profiles] DELETE error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
