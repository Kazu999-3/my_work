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

/** 宝くじ1口の価格。shop/route.ts の lottery_ticket.price と一致させること */
export const TICKET_PRICE = 100;

/**
 * 週末メガ宝くじ 抽選エンジン（等級分け＆キャリーオーバー方式）
 *
 * 賞金はすべて当週の売上（TICKET_PRICE × 口数）の内訳から拠出され、
 * 払い戻し総額が売上を超えることはない（コインの純粋な再分配）。
 * 🥇 1等 (MEGA JACKPOT): 当選確率 8%（購入口数に応じて抽選） ➔ 金庫全額総取り。外れたら売上の60%をキャリーオーバー
 * 🥈 2等 (ラッキー賞): 購入チケットの中から必ず1口当選 ➔ 売上の10%（上限1,000コイン）
 * 🥉 3等 (参加還元賞): 購入した全口 ➔ 1口につき30コイン（売上の30%）還元
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

  // ── 賞金原資の配分（2026-09-22 是正） ───────────────────────────────
  // 旧仕様は「1等リセット額10,000」と「2等1,000」をどこからも徴収せずに発行し、
  // 3等も全口へ30コイン還元していたため、1回の抽選あたりの期待収支が
  //   100T - (64.4T + 800 + 1000 + 30T) = 5.6T - 1800
  // となり、収支が釣り合うのは321口以上のときだけだった。
  // 総流通量が約15,000コインの経済では到達不可能で、開催のたびに約1,500〜1,700コインを
  // 新規発行し続ける「インフレ装置」になっていた。
  //
  // 現在は賞金をすべて売上（1口100コイン × 口数）の内訳から拠出する。
  //   3等（参加還元）: 売上の30% → 1口あたり30コイン（据え置き）
  //   2等（ラッキー賞）: 売上の10%（上限1,000コイン）
  //   1等原資（金庫積立）: 残り60%
  // これにより払い戻し総額が売上を超えなくなり、宝くじは純粋なコインの再分配になる。
  const ticketSales = totalTickets * TICKET_PRICE;
  const REFUND_PER_TICKET = 30;                                  // 売上の30%
  const totalRefund = totalTickets * REFUND_PER_TICKET;
  const SECOND_PRIZE_COINS = Math.floor(Math.min(1000, ticketSales * 0.10));
  const jackpotContribution = Math.max(0, ticketSales - totalRefund - SECOND_PRIZE_COINS);

  // 🥇 1等 (MEGA JACKPOT): 当選確率 8%
  const isFirstPrizeWon = Math.random() < 0.08;
  let firstPrizeWinner: any = null;
  let firstPrizePayout = 0;
  let nextJackpotAmount = curJackpotAmount;

  if (isFirstPrizeWon) {
    const winningTicket = flatTickets[Math.floor(Math.random() * flatTickets.length)];
    firstPrizeWinner = winningTicket.player;
    // 当選時は「前週までの金庫 ＋ 今回の売上からの積立」を総取りする
    firstPrizePayout = curJackpotAmount + jackpotContribution;
    coinGains.set(firstPrizeWinner.id, (coinGains.get(firstPrizeWinner.id) || 0) + firstPrizePayout);

    // 金庫はゼロから積み直す。
    // 旧実装はここで10,000コインを無条件に生成しており、これがインフレの主因だった。
    const RESET_JACKPOT = 0;
    nextJackpotAmount = RESET_JACKPOT;
    await supabase
      .from('ktm_settings')
      .upsert({
        key: 'casino_jackpot_pool',
        value: {
          amount: RESET_JACKPOT,
          lastWinner: firstPrizeWinner.name || firstPrizeWinner.ign || 'Anonymous',
          lastPayout: firstPrizePayout,
          lastWonAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
  } else {
    // キャリーオーバー！ 売上から3等・2等を差し引いた残りを金庫へ積み立て
    nextJackpotAmount = await addToJackpot(jackpotContribution);
  }

  // 🥈 2等 (ラッキー賞): 購入チケットの中から必ず1口選出（1,000コイン）
  // 複数人参加時は1等当選者以外の参加者チケットから優先選出（コミュニティへの公平分配）
  const eligibleSecondTickets = (isFirstPrizeWon && totalParticipants > 1)
    ? flatTickets.filter(t => t.player.id !== firstPrizeWinner?.id)
    : flatTickets;
  const poolForSecond = eligibleSecondTickets.length > 0 ? eligibleSecondTickets : flatTickets;

  const secondPrizeTicket = poolForSecond[Math.floor(Math.random() * poolForSecond.length)];
  const secondPrizeWinner = secondPrizeTicket.player;
  const secondPrizeWinnerName = secondPrizeWinner?.name || secondPrizeWinner?.ign || 'Anonymous';
  coinGains.set(secondPrizeWinner.id, (coinGains.get(secondPrizeWinner.id) || 0) + SECOND_PRIZE_COINS);

  // 🥉 3等 (参加還元賞): 購入口数 1口あたり 30コイン還元
  // ※コメントは長らく「ハズレ口数」だったが、実装は当初から1等・2等当選者を含む
  //   全口へ還元している。実装に合わせて表記を是正した（2026-09-22）。
  for (const pt of participants) {
    coinGains.set(pt.player.id, (coinGains.get(pt.player.id) || 0) + pt.ticketCount * REFUND_PER_TICKET);
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
    ? `🎉 **当選者誕生！！**\n👑 **${firstPrizeWinner?.name || firstPrizeWinner?.ign || 'Anonymous'}** さんが **\`${firstPrizePayout.toLocaleString()}\` コイン** を総取り獲得！おめでとうございます！`
    : `🔥 **当選者なし（キャリーオーバー発動！）**\n次週の賞金プールにチケット売上が加算され、さらに巨大化しました！\n💰 **次回キャリーオーバー額**: **\`${nextJackpotAmount.toLocaleString()}\` コイン**`;

  const embed = {
    title: '🎟️ 【週末メガ宝くじ】 当選結果速報！',
    description: `今週のメガ宝くじ抽選が完了いたしました！\n総購入口数: **${totalTickets} 口** （参加者: **${totalParticipants} 名**）\n\n━━━━━━━━━━━━━━━━━━━\n🥇 **1等: MEGA JACKPOT (総取り)**\n${firstPrizeText}\n\n🥈 **2等: ラッキー賞 (1,000 コイン)**\n🎯 当選者: **${secondPrizeWinnerName}** さん (+1,000コイン)\n\n🥉 **3等: 参加還元賞**\n🛡️ 参加者全員へ 1口につき **${REFUND_PER_TICKET} コイン** をキャッシュバック還元！\n━━━━━━━━━━━━━━━━━━━`,
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
    firstPrizeWinner: firstPrizeWinner?.name || firstPrizeWinner?.ign || null,
    firstPrizePayout,
    secondPrizeWinner: secondPrizeWinnerName,
    secondPrizePayout: SECOND_PRIZE_COINS,
    refundTotal: totalRefund,
    nextJackpotAmount,
  };
}
