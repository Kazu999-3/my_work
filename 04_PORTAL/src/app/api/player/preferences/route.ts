import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { getAuthSession } from '@/lib/authGuard';
import { findOrCreatePlayer } from '@/lib/playerCoins';

export const dynamic = 'force-dynamic';

/**
 * GET: ログイン中のユーザーのプロフィール＆レーン設定を取得
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'Discordログインが必要です。' },
        { status: 401 }
      );
    }

    // プレイヤーを取得（なければ自動作成）
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username || 'Player',
    });

    if (!player) {
      return NextResponse.json(
        { ok: false, error: 'プレイヤー情報の取得に失敗しました。' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      player: {
        id: player.id,
        discord_id: player.discord_id,
        name: player.name,
        ign: player.ign || '',
        highest_rank: player.highest_rank || 'UNRANKED',
        coins: player.coins ?? player.role_preferences?.coins ?? 1000,
        role_preferences: player.role_preferences || { primary: 'FILL', secondary: 'FILL', ng_roles: [] },
        ng_lane_1: player.ng_lane_1 || null,
        ng_lane_2: player.ng_lane_2 || null,
        stats: player.stats || { total: { g: 0, w: 0 }, roles: {} },
        mmr: player.mmr || 1200,
        avatar: session.avatar,
        isAdmin: session.isAdmin || false,
      },
    });
  } catch (err: any) {
    console.error('[player/preferences GET] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST / PATCH: ログイン中のユーザー自身が希望レーン・NGレーン・IGNを更新
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'Discordログインが必要です。' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { primary, secondary, ng_roles, ign, mentorship } = body;

    // 既存プレイヤーを取得
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username || 'Player',
    });

    if (!player) {
      return NextResponse.json(
        { ok: false, error: 'プレイヤー情報が見つかりません。' },
        { status: 404 }
      );
    }

    // ロール希望・師弟データの安全なマージ
    const currentPrefs = player.role_preferences || {};
    const updatedPrefs = {
      ...currentPrefs,
      primary: primary !== undefined ? primary : (currentPrefs.primary || 'FILL'),
      secondary: secondary !== undefined ? secondary : (currentPrefs.secondary || 'FILL'),
      ng_roles: Array.isArray(ng_roles) ? ng_roles : (currentPrefs.ng_roles || []),
      mentorship: mentorship !== undefined ? mentorship : (currentPrefs.mentorship || { type: 'NONE', lane: 'ALL', comment: '' }),
    };

    const updatePayload: any = {
      role_preferences: updatedPrefs,
    };

    // NGレーン個別カラム（互換用）
    if (Array.isArray(ng_roles)) {
      updatePayload.ng_lane_1 = ng_roles[0] || null;
      updatePayload.ng_lane_2 = ng_roles[1] || null;
    }

    // IGN更新（指定がある場合）
    if (typeof ign === 'string') {
      updatePayload.ign = ign.trim();
    }

    const { data: updated, error } = await supabase
      .from('ktm_players')
      .update(updatePayload)
      .eq('id', player.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      message: 'レーン設定を保存しました。',
      player: {
        id: updated.id,
        discord_id: updated.discord_id,
        name: updated.name,
        ign: updated.ign || '',
        role_preferences: updated.role_preferences,
        ng_lane_1: updated.ng_lane_1,
        ng_lane_2: updated.ng_lane_2,
      },
    });
  } catch (err: any) {
    console.error('[player/preferences POST] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
