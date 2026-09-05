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

    // 3. リアルタイム投票統計（現在アクティブな未精算ベット状況）
    let blueAmount = 0;
    let redAmount = 0;
    let blueCount = 0;
    let redCount = 0;

    try {
      const { data: betTasks } = await supabase
        .from('edge_tasks')
        .select('payload')
        .eq('task_type', 'custom_bet')
        .eq('status', 'pending');

      if (betTasks && betTasks.length > 0) {
        const bets = betTasks.map((t: any) => t.payload).filter(Boolean);
        blueAmount = bets.filter((b: any) => b.team === 'BLUE').reduce((s: number, b: any) => s + (b.amount || 0), 0);
        redAmount = bets.filter((b: any) => b.team === 'RED').reduce((s: number, b: any) => s + (b.amount || 0), 0);
        blueCount = bets.filter((b: any) => b.team === 'BLUE').length;
        redCount = bets.filter((b: any) => b.team === 'RED').length;
      }
    } catch {}

    const totalAmount = blueAmount + redAmount;
    const blueRatio = totalAmount > 0 ? Math.round((blueAmount / totalAmount) * 100) : 50;
    const redRatio = totalAmount > 0 ? 100 - blueRatio : 50;

    const { getJackpotPool, addToJackpot } = await import('../../../lib/jackpot');
    const jackpot = await getJackpotPool();

    return NextResponse.json({
      success: true,
      userCoins,
      ranking,
      lastClaimDate,
      jackpot,
      betStats: {
        blueAmount,
        redAmount,
        blueCount,
        redCount,
        totalAmount,
        blueRatio,
        redRatio,
        jackpotAmount: jackpot.amount
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

    // 日本時間（JST = UTC+9）基準で今日の日付（YYYY-MM-DD）を取得
    const todayStr = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '-');

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

    // ⚔️ 出場選手（BLUE / RED チームメンバー）のベット禁止チェック
    try {
      const { data: latestPending } = await supabase
        .from('edge_tasks')
        .select('payload')
        .eq('task_type', 'balancer_pending')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const bResult = latestPending?.payload?.balanceResult;
      if (bResult) {
        const playingMembers = [...(bResult.teamBlue || []), ...(bResult.teamRed || [])];
        const isParticipant = playingMembers.some((p: any) => {
          const pName = (p.name || '').trim().toLowerCase();
          const pDiscord = p.discordId || p.discord_id;
          const targetName = (player.name || '').trim().toLowerCase();
          const targetDiscord = player.discord_id || discordId;
          return pName === targetName || (pDiscord && targetDiscord && pDiscord === targetDiscord);
        });

        if (isParticipant) {
          return NextResponse.json({
            error: '⚔️ 試合の出場選手はこの試合にベットすることはできません（公正な運用のための観戦者・非参加者限定機能です）。全力で勝利を目指してください🔥'
          }, { status: 403 });
        }
      }
    } catch (chkErr) {
      console.warn('[bet POST] Participant check warning:', chkErr);
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

    // ベートレコードを edge_tasks に保存（試合確定時の自動精算・配当払い戻し用）
    const effectiveOdds = Number(odds) > 0 ? Number(odds) : 2.0;
    try {
      await supabase
        .from('edge_tasks')
        .insert({
          task_type: 'custom_bet',
          status: 'pending',
          payload: {
            player_name: player.name,
            discord_id: player.discord_id || discordId || null,
            team: team.toUpperCase(),
            amount: betAmount,
            odds: effectiveOdds,
            created_at: new Date().toISOString()
          }
        });

      // 💎 ベット金額の 5% をサーバー共有ジャックポット金庫へ自動積立
      const { addToJackpot } = await import('../../../lib/jackpot');
      await addToJackpot(Math.max(1, Math.floor(betAmount * 0.05)));
    } catch (bErr) {
      console.warn('[bet POST] edge_tasks / jackpot insert warning:', bErr);
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
