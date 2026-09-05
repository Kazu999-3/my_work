import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

// ユーザーの所持コイン・ランキング・リアルタイム投票統計取得
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get('discordId');
    const name = searchParams.get('name');

    // 1. 所持コインランキング TOP 10
    let ranking: any[] = [];
    try {
      const { data: topPlayers } = await supabase
        .from('ktm_players')
        .select('name, discord_id, highest_rank, coins, role_preferences')
        .order('coins', { ascending: false })
        .limit(10);

      ranking = (topPlayers || []).map((p: any) => ({
        name: p.name,
        discordId: p.discord_id,
        rank: p.highest_rank || 'UNRANKED',
        coins: getPlayerCoins(p),
      }));
    } catch (rErr) {
      console.warn('[bet GET] Ranking query failed:', rErr);
    }

    // 2. 指定ユーザーの残高と履歴
    let userCoins = 1000;
    let lastClaimDate: string | null = null;

    if (discordId || name) {
      const player = await findOrCreatePlayer({
        discordId,
        name,
        autoCreate: false,
      });

      if (player) {
        userCoins = getPlayerCoins(player);
        lastClaimDate = player.role_preferences?.lastDailyClaim || null;
      }
    }

    // 3. リアルタイム投票統計（現在アクティブなベット状況）
    let blueAmount = 2800;
    let redAmount = 2200;
    let blueCount = 4;
    let redCount = 3;

    try {
      const { data: bets } = await supabase
        .from('ktm_bets')
        .select('team, amount')
        .order('created_at', { ascending: false })
        .limit(50);

      if (bets && bets.length > 0) {
        blueAmount = bets.filter((b: any) => b.team === 'BLUE').reduce((s: number, b: any) => s + (b.amount || 0), 0) || 2800;
        redAmount = bets.filter((b: any) => b.team === 'RED').reduce((s: number, b: any) => s + (b.amount || 0), 0) || 2200;
        blueCount = bets.filter((b: any) => b.team === 'BLUE').length || 4;
        redCount = bets.filter((b: any) => b.team === 'RED').length || 3;
      }
    } catch {}

    const totalAmount = blueAmount + redAmount;
    const blueRatio = totalAmount > 0 ? Math.round((blueAmount / totalAmount) * 100) : 50;
    const redRatio = 100 - blueRatio;

    return NextResponse.json({
      success: true,
      userCoins,
      ranking,
      lastClaimDate,
      betStats: {
        blueAmount,
        redAmount,
        blueCount,
        redCount,
        totalAmount,
        blueRatio,
        redRatio
      }
    });
  } catch (error: any) {
    console.error('Bet API GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// デイリーボーナス / 破産救済ボーナス受取
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, type } = body; // type: 'daily' | 'rescue'

    if (!discordId && !playerName) {
      return NextResponse.json({ error: 'ユーザー情報が不足しています。Discordログインを行ってください。' }, { status: 400 });
    }

    // プレイヤーを確実に特定・未登録なら自動初期化
    const player = await findOrCreatePlayer({
      discordId,
      name: playerName,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 404 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentCoins = getPlayerCoins(player);
    let addedCoins = 0;
    let successMessage = '';

    if (type === 'daily') {
      const lastClaim = player.role_preferences?.lastDailyClaim;
      if (lastClaim === todayStr) {
        return NextResponse.json({ error: '本日のデイリーボーナスは受取済みです！明日またお越しください🎁' }, { status: 400 });
      }
      addedCoins = 100;
      successMessage = '🎁 デイリーボーナス +100コイン を受け取りました！';
    } else if (type === 'rescue') {
      if (currentCoins >= 100) {
        return NextResponse.json({ error: '破産救済ボーナスは残高100コイン未満のときのみ利用可能です。' }, { status: 400 });
      }
      addedCoins = 300;
      successMessage = '💸 破産救済保険が発動！ +300コイン を獲得して復活しました！🔥';
    } else {
      return NextResponse.json({ error: '不正なボーナスタイプです。' }, { status: 400 });
    }

    const newCoins = currentCoins + addedCoins;
    const rolePreferencesUpdate = {
      ...(type === 'daily' ? { lastDailyClaim: todayStr } : {})
    };

    const updateRes = await updatePlayerCoinsAndInventory({
      player,
      newCoins,
      rolePreferencesUpdate,
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: 'コインの更新に失敗しました: ' + updateRes.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      remainingCoins: newCoins,
      message: successMessage
    });
  } catch (error: any) {
    console.error('Bonus claim error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ベット受付
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, team, amount, matchId, odds } = body;
    const parsedAmount = Math.floor(Number(amount));
    if (!team || !parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: 'チームと有効な賭け金（1コイン以上の整数）を指定してください。' }, { status: 400 });
    }

    if (!['BLUE', 'RED'].includes(team.toUpperCase())) {
      return NextResponse.json({ error: 'ベット対象は BLUE または RED です。' }, { status: 400 });
    }

    if (!discordId && !playerName) {
      return NextResponse.json({ error: 'プレイヤー情報が不足しています。' }, { status: 400 });
    }

    // 他者のコインを勝手に賭けないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(discordId || playerName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    // プレイヤーの特定（未登録なら初期化）
    const player = await findOrCreatePlayer({
      discordId,
      name: playerName,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ error: 'プレイヤーが見つかりません。名簿登録を行ってください。' }, { status: 404 });
    }

    const currentCoins = getPlayerCoins(player);
    const betAmount = Math.min(parsedAmount, currentCoins);
    if (betAmount <= 0 || currentCoins < betAmount) {
      return NextResponse.json({ error: `所持コインが足りません（現在: ${currentCoins}コイン）。` }, { status: 400 });
    }

    // コインを控除
    const newCoins = currentCoins - betAmount;
    const updateRes = await updatePlayerCoinsAndInventory({
      player,
      newCoins,
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: 'コインの控除に失敗しました。' }, { status: 500 });
    }

    // ktm_bets レコードをDBに保存（試合確定時の自動精算・配当払い戻し用）
    const effectiveOdds = Number(odds) > 0 ? Number(odds) : 2.0;
    try {
      await supabase
        .from('ktm_bets')
        .insert({
          player_name: player.name,
          discord_id: player.discord_id || discordId || null,
          team: team.toUpperCase(),
          amount: betAmount,
          odds: effectiveOdds,
          settled: false,
        });
    } catch (bErr) {
      console.warn('ktm_bets insert warning:', bErr);
    }

    const oddsText = odds ? ` (オッズ: x${odds}倍)` : '';

    return NextResponse.json({
      success: true,
      playerName: player.name,
      team: team.toUpperCase(),
      amount: betAmount,
      remainingCoins: newCoins,
      odds: effectiveOdds,
      message: `🎉 ${player.name} さんが 【${team.toUpperCase()} チーム】に ${betAmount}コイン をベットしました！${oddsText}（残り: ${newCoins}コイン）`,
    });
  } catch (error: any) {
    console.error('Bet API POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
