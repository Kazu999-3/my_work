import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// ユーザーの所持コイン・ランキング・リアルタイム投票統計取得
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get('discordId');
    const name = searchParams.get('name');

    // 1. 所持コインランキング TOP 10
    const { data: topPlayers } = await supabase
      .from('ktm_players')
      .select('name, discord_id, rank, coins')
      .order('coins', { ascending: false })
      .limit(10);

    const ranking = (topPlayers || []).map((p: any) => ({
      name: p.name,
      discordId: p.discord_id,
      rank: p.rank,
      coins: p.coins ?? 1000,
    }));

    // 2. 指定ユーザーの残高と履歴
    let userCoins = 1000;
    let userBets: any[] = [];
    let lastClaimDate: string | null = null;

    if (discordId || name) {
      let query = supabase.from('ktm_players').select('coins, name, discord_id, role_preferences');
      if (discordId) {
        query = query.eq('discord_id', discordId);
      } else if (name) {
        query = query.eq('name', name);
      }
      const { data: userData } = await query.single();
      if (userData) {
        userCoins = userData.coins ?? 1000;
        lastClaimDate = userData.role_preferences?.lastDailyClaim || null;
      }
    }

    // 3. リアルタイム投票統計（現在アクティブなベット状況）
    // 擬似または直近アクティブベットの集計
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

    let query = supabase.from('ktm_players').select('name, discord_id, coins, role_preferences');
    if (discordId) query = query.eq('discord_id', discordId);
    else if (playerName) query = query.eq('name', playerName);
    const { data: player, error: pError } = await query.single();

    if (pError || !player) {
      return NextResponse.json({ error: 'プレイヤーが見つかりません。' }, { status: 404 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentCoins = player.coins ?? 1000;
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
    const updatedPreferences = {
      ...(player.role_preferences || {}),
      ...(type === 'daily' ? { lastDailyClaim: todayStr } : {})
    };

    await supabase.from('ktm_players').update({
      coins: newCoins,
      role_preferences: updatedPreferences
    }).eq('name', player.name);

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

    if (!team || !amount || amount <= 0) {
      return NextResponse.json({ error: 'チームと有効な賭け金（1コイン以上）を指定してください。' }, { status: 400 });
    }

    if (!['BLUE', 'RED'].includes(team.toUpperCase())) {
      return NextResponse.json({ error: 'ベット対象は BLUE または RED です。' }, { status: 400 });
    }

    // プレイヤーの所持コイン確認
    let query = supabase.from('ktm_players').select('name, discord_id, coins');
    if (discordId) {
      query = query.eq('discord_id', discordId);
    } else if (playerName) {
      query = query.eq('name', playerName);
    } else {
      return NextResponse.json({ error: 'プレイヤー情報が不足しています。' }, { status: 400 });
    }

    // 他者のコインを勝手に賭けないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(discordId || playerName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    const { data: player, error: pError } = await query.single();
    if (pError || !player) {
      return NextResponse.json({ error: 'プレイヤーが見つかりません。名簿登録を行ってください。' }, { status: 404 });
    }

    const currentCoins = player.coins ?? 1000;
    const betAmount = Math.min(amount, currentCoins);
    if (betAmount <= 0 || currentCoins < betAmount) {
      return NextResponse.json({ error: `所持コインが足りません（現在: ${currentCoins}コイン）。` }, { status: 400 });
    }

    // コインを控除
    const newCoins = currentCoins - betAmount;
    await supabase
      .from('ktm_players')
      .update({ coins: newCoins })
      .eq('name', player.name);

    const oddsText = odds ? ` (オッズ: x${odds}倍)` : '';

    return NextResponse.json({
      success: true,
      playerName: player.name,
      team: team.toUpperCase(),
      amount: betAmount,
      remainingCoins: newCoins,
      odds,
      message: `🎉 ${player.name} さんが 【${team.toUpperCase()} チーム】に ${betAmount}コイン をベットしました！${oddsText}（残り: ${newCoins}コイン）`,
    });
  } catch (error: any) {
    console.error('Bet API POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
