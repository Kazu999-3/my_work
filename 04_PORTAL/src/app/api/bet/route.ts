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
      const { data: allPlayers, error: pErr } = await supabase
        .from('ktm_players')
        .select('name, discord_id, highest_rank, role_preferences, metadata, is_active');

      if (pErr) throw pErr;

      const activeList = (allPlayers || []).filter((p: any) => p.is_active !== false);

      ranking = activeList
        .map((p: any) => ({
          name: p.name,
          discordId: p.discord_id,
          rank: p.highest_rank || 'UNRANKED',
          coins: getPlayerCoins(p),
        }))
        .sort((a: { coins: number }, b: { coins: number }) => b.coins - a.coins)
        .slice(0, 10);
    } catch (rErr) {
      console.warn('[bet GET] Ranking query failed:', rErr);
    }

    // 2. 指定ユーザーの残高と履歴
    let userCoins = 1000;
    let lastClaimDate: string | null = null;
    let lastRescueMonth: string | null = null;
    let userStreak = 0;
    let userMaxStreak = 0;

    if (discordId || name) {
      const player = await findOrCreatePlayer({
        discordId,
        name,
        autoCreate: false,
      });

      if (player) {
        userCoins = getPlayerCoins(player);
        lastClaimDate = player.role_preferences?.lastDailyClaim || null;
        lastRescueMonth = player.role_preferences?.lastRescueMonth || null;
        userStreak = Number(player.role_preferences?.betStreak) || 0;
        userMaxStreak = Number(player.role_preferences?.maxBetStreak) || userStreak;
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
      lastRescueMonth,
      userStreak,
      userMaxStreak,
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
    const { type } = body; // type: 'daily' | 'rescue'

    // ⚠️ 2026-09-22 セキュリティ修正:
    // 以前は認証が無く、ボディに他人の識別子を書くだけで他人のデイリーボーナスや
    // 破産救済保険を勝手に消化できた（受取権の踏み倒し）。
    const { getAuthSession } = await import('../../../lib/authGuard');
    const session = await getAuthSession();
    if (!session || (!session.discordId && !session.displayName && !session.username)) {
      return NextResponse.json({ error: 'ボーナスの受取にはDiscordログインが必要です。' }, { status: 401 });
    }

    // プレイヤーはセッションから特定する（ボディの識別子は受け付けない）
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username,
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

    const currentMonth = todayStr.slice(0, 7); // 'YYYY-MM'

    let omikujiData: {
      tier: '大大吉' | '大吉' | '中吉' | '小吉';
      coins: number;
      icon: string;
      comment: string;
    } | null = null;

    if (type === 'daily') {
      const lastClaim = player.role_preferences?.lastDailyClaim;
      if (lastClaim === todayStr) {
        return NextResponse.json({ error: '本日のデイリーボーナスは受取済みです！明日またお越しください🎁' }, { status: 400 });
      }

      // 🎰 デイリーおみくじ抽選 (大大吉:10%, 大吉:25%, 中吉:40%, 小吉:25%)
      const rand = Math.random() * 100;
      if (rand < 10) {
        omikujiData = {
          tier: '大大吉',
          coins: 300,
          icon: '👑',
          comment: '超絶豪運！本日のカスタムで無双キャリー確定！？',
        };
      } else if (rand < 35) {
        omikujiData = {
          tier: '大吉',
          coins: 200,
          icon: '🌟',
          comment: '大幸運！ここぞという場面の判断が冴え渡る予感！',
        };
      } else if (rand < 75) {
        omikujiData = {
          tier: '中吉',
          coins: 150,
          icon: '🎯',
          comment: '好調！チームプレイと連携が光る充実の1日！',
        };
      } else {
        omikujiData = {
          tier: '小吉',
          coins: 100,
          icon: '🍀',
          comment: '堅実！コツコツ貯めて勝負どころに備えよう！',
        };
      }

      addedCoins = omikujiData.coins;
      successMessage = `${omikujiData.icon} 【${omikujiData.tier}】+${addedCoins}コイン を獲得しました！ ${omikujiData.comment}`;
    } else if (type === 'rescue') {
      const lastRescue = player.role_preferences?.lastRescueMonth;
      if (lastRescue === currentMonth) {
        return NextResponse.json({ error: '破産救済保険の受取は月1回までです。今月分はすでに利用済みです（来月1日以降に再度利用可能になります）。' }, { status: 400 });
      }
      if (currentCoins >= 100) {
        return NextResponse.json({ error: '破産救済ボーナスは残高100コイン未満のときのみ利用可能です。' }, { status: 400 });
      }
      addedCoins = 300;
      successMessage = '💸 破産救済保険が発動！ +300コイン を獲得して復活しました！🔥（※月1回限定）';
    } else {
      return NextResponse.json({ error: '不正なボーナスタイプです。' }, { status: 400 });
    }

    const newCoins = currentCoins + addedCoins;
    const rolePreferencesUpdate = {
      ...(type === 'daily' ? { lastDailyClaim: todayStr } : {}),
      ...(type === 'rescue' ? { lastRescueMonth: currentMonth } : {}),
    };

    const updateRes = await updatePlayerCoinsAndInventory({
      player,
      newCoins,
      rolePreferencesUpdate,
      reason: type === 'daily' ? 'daily_omikuji' : 'rescue_insurance',
      reasonMetadata: omikujiData ? { tier: omikujiData.tier } : undefined,
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: 'コインの更新に失敗しました: ' + updateRes.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      remainingCoins: newCoins,
      message: successMessage,
      omikuji: omikujiData,
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
    // ⚠️ body.odds は受け取らない。オッズはサーバーが算出した値のみを使う（下記参照）。
    const { discordId, playerName, team, amount, matchId } = body;
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

    // 他者のコインを勝手に賭けないよう本人・管理者検証。
    // KTM Bot（Discordの /bet モーダル）からも叩かれるが、Botはセッションcookieを持たず
    // X-Bot-Secret しか送らないため、Bot経由は verifyBotSecretStrict で許可する。
    // Discord Interaction は署名検証済みで discordId は詐称できないため、
    // Bot経由の場合に限りボディの識別子を正本として扱ってよい。
    const { verifyUserOrAdmin } = await import('../../../lib/authGuard');
    const { verifyBotSecretStrict } = await import('../../../lib/botAuth');
    const isBot = verifyBotSecretStrict(req).ok;

    let actorDiscordId = discordId;
    let actorName = playerName;

    if (!isBot) {
      const authCheck = await verifyUserOrAdmin({ discordId, playerName });
      if (!authCheck.ok || !authCheck.session) {
        return NextResponse.json({ error: authCheck.error || 'Discordログインが必要です。' }, { status: 403 });
      }
      // プレイヤーの特定はセッションの識別子を正本とする（ボディの値は信用しない）。
      // 管理者が代理でベットを入れる運用だけは従来どおりボディ指定を許可する。
      const session = authCheck.session;
      const actAsOther = session.isAdmin && (discordId || playerName);
      actorDiscordId = actAsOther ? discordId : (session.discordId || discordId);
      actorName = actAsOther ? playerName : (session.displayName || session.username || playerName);
    }

    const player = await findOrCreatePlayer({
      discordId: actorDiscordId,
      name: actorName,
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
      reason: 'bet_place',
      reasonMetadata: { team: team.toUpperCase(), amount: betAmount },
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: 'コインの控除に失敗しました。' }, { status: 500 });
    }

    // ベートレコードを edge_tasks に保存（試合確定時の自動精算・配当払い戻し用）
    // ⚠️ オッズは「このベットを投入する直前の投票状況」からサーバーが算出する。
    // クライアントが申告してきた odds は一切使わない（任意倍率の払い戻しを防ぐため）。
    const { calculateBetOdds, fetchPendingBetTotals } = await import('../../../lib/betOdds');
    const totalsBefore = await fetchPendingBetTotals(supabase);
    const serverOdds = calculateBetOdds(totalsBefore.blueAmount, totalsBefore.redAmount);
    const effectiveOdds = team.toUpperCase() === 'BLUE' ? serverOdds.blue : serverOdds.red;
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
            match_id: matchId || null,
            created_at: new Date().toISOString()
          }
        });

      // 💎 ベット金額の 5% をサーバー共有ジャックポット金庫へ自動積立
      const { addToJackpot } = await import('../../../lib/jackpot');
      await addToJackpot(Math.max(1, Math.floor(betAmount * 0.05)));
    } catch (bErr) {
      console.warn('[bet POST] edge_tasks / jackpot insert warning:', bErr);
    }

    const oddsText = ` (オッズ: x${effectiveOdds}倍)`;

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
