import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

function getTodayJST(): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\//g, '-');
}

/**
 * GET: プレイヤーの匿名評判タグ集計を取得
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('playerName');

    if (!playerName) {
      return NextResponse.json({ ok: false, error: 'playerName is required' }, { status: 400 });
    }

    const session = await getAuthSession();
    const myDiscordId = session?.discordId;
    const todayJST = getTodayJST();

    // 評判データの取得（通報フラグ is_report = false のもののみ公開集計）
    const { data: reps, error } = await supabase
      .from('player_reputations')
      .select('*')
      .eq('target_player_name', playerName)
      .eq('is_report', false);

    if (error) {
      console.warn('[player/reputation] select error (fallback):', error);
      return NextResponse.json({
        ok: true,
        tagCounts: {},
        totalKudos: 0,
        canSendToday: true,
      });
    }

    const tagCounts: Record<string, number> = {};
    let totalKudos = 0;

    (reps || []).forEach((r: any) => {
      totalKudos += 1;
      if (Array.isArray(r.tags)) {
        r.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // 自分が今日既にこのプレイヤーに送ったか判定
    let canSendToday = true;
    if (myDiscordId) {
      const { data: todaySent } = await supabase
        .from('player_reputations')
        .select('id')
        .eq('sender_discord_id', myDiscordId)
        .eq('target_player_name', playerName)
        .eq('date_key', todayJST)
        .maybeSingle();

      if (todaySent) {
        canSendToday = false;
      }
    }

    return NextResponse.json({
      ok: true,
      tagCounts,
      totalKudos,
      canSendToday,
    });
  } catch (err: any) {
    console.error('[player/reputation] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: プレイヤーへの匿名評判・Kudosを送信（1日1回制限、+50コイン付与）
 */
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    const body = await request.json();
    const { targetPlayerName, tags = [], message = '', isReport = false } = body;

    const effectiveDiscordId = session?.discordId || body.senderDiscordId;
    if (!effectiveDiscordId) {
      return NextResponse.json({ ok: false, error: '評判を送信するにはログインが必要です。' }, { status: 401 });
    }

    if (!targetPlayerName) {
      return NextResponse.json({ ok: false, error: '送信対象のプレイヤー名が必要です。' }, { status: 400 });
    }

    const todayJST = getTodayJST();

    // 1日1回制限チェック
    const { data: existing } = await supabase
      .from('player_reputations')
      .select('id')
      .eq('sender_discord_id', effectiveDiscordId)
      .eq('target_player_name', targetPlayerName)
      .eq('date_key', todayJST)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'このプレイヤーへの評判送信は1日1回までです。また明日送信できます！' },
        { status: 400 }
      );
    }

    // 保存
    const { error: insertErr } = await supabase.from('player_reputations').insert({
      sender_discord_id: effectiveDiscordId,
      target_player_name: targetPlayerName,
      tags: Array.isArray(tags) ? tags : [],
      message: message || '',
      is_report: Boolean(isReport),
      date_key: todayJST,
    });

    if (insertErr) throw insertErr;

    // 送信者にボーナスコイン (+50コイン) 付与
    let rewardCoins = 0;
    try {
      const player = await findOrCreatePlayer({
        discordId: effectiveDiscordId,
        name: session?.displayName || session?.username || 'Player',
      });
      if (player) {
        const currentCoins = getPlayerCoins(player);
        await updatePlayerCoinsAndInventory({
          player,
          newCoins: currentCoins + 50,
        });
        rewardCoins = 50;
      }
    } catch (coinErr) {
      console.warn('[player/reputation] Coin bonus error:', coinErr);
    }

    return NextResponse.json({
      ok: true,
      message: isReport
        ? '🛡️ 管理者へ匿名の相談・報告を送信しました。'
        : `🌟 匿名で称賛タグを贈りました！（+${rewardCoins}コイン獲得）`,
      rewardCoins,
    });
  } catch (err: any) {
    console.error('[player/reputation] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
