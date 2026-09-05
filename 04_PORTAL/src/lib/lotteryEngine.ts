import { supabaseAdmin as supabase } from './supabaseAdmin';
import { getJackpotPool, addToJackpot } from './jackpot';
import { getPlayerCoins, getPlayerInventory, updatePlayerCoinsAndInventory } from './playerCoins';
import { sendShopNotification } from './discordNotify';

export interface LotteryResult {
  success: boolean;
  message?: string;
  totalTickets: number;
  totalParticipants: number;
  isFirstPrizeWon: boolean;
  firstPrizeWinner: string | null;
  firstPrizePayout: number;
  secondPrizeWinner: string | null;
  secondPrizePayout: number;
  refundTotal: number;
  nextJackpotAmount: number;
}

interface LotteryParticipant {
  player: any;
  ticketCount: number;
  remainingInventory: any[];
}

/**
 * 週末メガ宝くじ 抽選エンジン（等級分け＆キャリーオーバー方式）
 * 🥇 1等 (MEGA JACKPOT): 当選確率 8%（購入口数に応じて抽選） ➔ プール金全額総取り（外れは全額キャリーオーバー＋売上70%加算）
 * 🥈 2等 (ラッキー賞): 購入チケットの中から必ず1名当選 ➔ 1,000コイン
 * 🥉 3等 (参加還元賞): ハズレたチケット全口 ➔ 1口につき30コイン還元
 */
export async function executeLotteryDraw(): Promise<LotteryResult> {
  const currentPool = await getJackpotPool();
  const curJackpotAmount = currentPool.amount;

  if (!supabase) {
    throw new Error('Supabase admin is not configured');
  }

  // 1. 全プレイヤーを取得
  const { data: players, error: fetchErr } = await supabase
    .from('ktm_players')
    .select('*');

  if (fetchErr || !players) {
    throw new Error(`Failed to fetch players: ${fetchErr?.message}`);
  }

  // 2. 宝くじチケット（lottery_ticket）を所持しているプレイヤーを集計
  const participants: LotteryParticipant[] = [];
  const flatTickets: Array<{ player: any; ticketIdx: number }> = [];

  for (const p of players) {
    const inv = getPlayerInventory(p);
    const tickets = inv.filter((item: any) => item.id === 'lottery_ticket');
    const nonTickets = inv.filter((item: any) => item.id !== 'lottery_ticket');

    if (tickets.length > 0) {
      participants.push({
        player: p,
        ticketCount: tickets.length,
        remainingInventory: nonTickets,
      });

      for (let i = 0; i < tickets.length; i++) {
        flatTickets.push({ player: p, ticketIdx: i });
      }
    }
  }

  const totalTickets = flatTickets.length;
  const totalParticipants = participants.length;

  // 参加者が0人の場合
  if (totalTickets === 0) {
    const embed = {
      title: '🎟️ 【週末メガ宝くじ】 抽選結果発表',
      description: `今週は宝くじの購入者がいなかったため、**ジャックポットは全額次週へキャリーオーバー**されます！\n\n💰 **現在のキャリーオーバー金庫**: **\`${curJackpotAmount.toLocaleString()}\` コイン**\n\n次週の抽選に向けて、カジノショップ（1口 100コイン）で購入して夢のジャックポット総取りを狙おう！`,
      color: 0xf59e0b,
      footer: { text: 'KTM 週末メガ宝くじ • 毎週日曜 22:00 定期抽選' },
      timestamp: new Date().toISOString(),
    };

    await sendShopNotification({ embeds: [embed] });

    return {
      success: true,
      message: 'No participants this week. Jackpot carried over.',
      totalTickets: 0,
      totalParticipants: 0,
      isFirstPrizeWon: false,
      firstPrizeWinner: null,
      firstPrizePayout: 0,
      secondPrizeWinner: null,
      secondPrizePayout: 0,
      refundTotal: 0,
      nextJackpotAmount: curJackpotAmount,
    };
  }

  // 3. 抽選ロジック
  const coinGains: Map<number, number> = new Map();
  participants.forEach(pt => coinGains.set(pt.player.id, 0));

  // 🥇 1等 (MEGA JACKPOT): 当選確率 8%
  const isFirstPrizeWon = Math.random() < 0.08;
  let firstPrizeWinner: any = null;
  let firstPrizePayout = 0;
  let nextJackpotAmount = curJackpotAmount;

  if (isFirstPrizeWon) {
    const winningTicket = flatTickets[Math.floor(Math.random() * flatTickets.length)];
    firstPrizeWinner = winningTicket.player;
    firstPrizePayout = curJackpotAmount;
    coinGains.set(firstPrizeWinner.id, (coinGains.get(firstPrizeWinner.id) || 0) + firstPrizePayout);

    // 金庫を初期値へリセット
    const RESET_JACKPOT = 10000;
    nextJackpotAmount = RESET_JACKPOT;
    await supabase
      .from('ktm_settings')
      .upsert({
        key: 'casino_jackpot_pool',
        value: {
          amount: RESET_JACKPOT,
          lastWinner: firstPrizeWinner.name || 'Anonymous',
          lastPayout: firstPrizePayout,
          lastWonAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
  } else {
    // キャリーオーバー！ チケット売上（1口100コイン × 口数）の70%を金庫へ積み立て
    const poolAddition = Math.floor(totalTickets * 100 * 0.7);
    nextJackpotAmount = await addToJackpot(poolAddition);
  }

  // 🥈 2等 (ラッキー賞): 購入チケットの中から必ず1口選出（1,000コイン）
  const secondPrizeTicket = flatTickets[Math.floor(Math.random() * flatTickets.length)];
  const secondPrizeWinner = secondPrizeTicket.player;
  const SECOND_PRIZE_COINS = 1000;
  coinGains.set(secondPrizeWinner.id, (coinGains.get(secondPrizeWinner.id) || 0) + SECOND_PRIZE_COINS);

  // 🥉 3等 (参加還元賞): ハズレ口数 1口あたり 30コイン還元
  const REFUND_PER_TICKET = 30;
  let totalRefund = 0;
  for (const pt of participants) {
    const refund = pt.ticketCount * REFUND_PER_TICKET;
    totalRefund += refund;
    coinGains.set(pt.player.id, (coinGains.get(pt.player.id) || 0) + refund);
  }

  // 4. DB更新（チケット消費 & コイン加算）
  for (const pt of participants) {
    const curCoins = getPlayerCoins(pt.player);
    const addedCoins = coinGains.get(pt.player.id) || 0;
    const newCoins = curCoins + addedCoins;

    await updatePlayerCoinsAndInventory({
      player: pt.player,
      newCoins,
      newInventory: pt.remainingInventory,
    });
  }

  // 5. Discord `#ショップ通知` へ豪華Embedアナウンス送信
  const firstPrizeText = isFirstPrizeWon
    ? `🎉 **当選者誕生！！**\n👑 **${firstPrizeWinner.name}** さんが **\`${firstPrizePayout.toLocaleString()}\` コイン** を総取り獲得！おめでとうございます！`
    : `🔥 **当選者なし（キャリーオーバー発動！）**\n次週の賞金プールにチケット売上が加算され、さらに巨大化しました！\n💰 **次回キャリーオーバー額**: **\`${nextJackpotAmount.toLocaleString()}\` コイン**`;

  const embed = {
    title: '🎟️ 【週末メガ宝くじ】 当選結果速報！',
    description: `今週のメガ宝くじ抽選が完了いたしました！\n総購入口数: **${totalTickets} 口** （参加者: **${totalParticipants} 名**）\n\n━━━━━━━━━━━━━━━━━━━\n🥇 **1等: MEGA JACKPOT (総取り)**\n${firstPrizeText}\n\n🥈 **2等: ラッキー賞 (1,000 コイン)**\n🎯 当選者: **${secondPrizeWinner.name}** さん (+1,000コイン)\n\n🥉 **3等: 参加還元賞**\n🛡️ 参加者全員へ 1口につき **${REFUND_PER_TICKET} コイン** をキャッシュバック還元！\n━━━━━━━━━━━━━━━━━━━`,
    color: isFirstPrizeWon ? 0x10b981 : 0xec4899,
    fields: [
      {
        name: '🎟️ 次回の宝くじ',
        value: 'カジノショップ（1口 100コイン）で今すぐ次週分のチケットを購入できます！',
        inline: false,
      },
    ],
    footer: { text: 'KTM 週末メガ宝くじ • 毎週日曜 22:00 定期抽選' },
    timestamp: new Date().toISOString(),
  };

  await sendShopNotification({ embeds: [embed] });

  return {
    success: true,
    totalTickets,
    totalParticipants,
    isFirstPrizeWon,
    firstPrizeWinner: firstPrizeWinner?.name || null,
    firstPrizePayout,
    secondPrizeWinner: secondPrizeWinner.name,
    secondPrizePayout: SECOND_PRIZE_COINS,
    refundTotal: totalRefund,
    nextJackpotAmount,
  };
}
