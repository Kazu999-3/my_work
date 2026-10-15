import { NextResponse } from 'next/server';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { sendShopNotification } from '../../../../lib/discordNotify';
import {
  calculatePlinkoDrop,
  PLINKO_ALLOWED_BETS,
  PLINKO_PAYOUT_TABLES,
  type PlinkoDropResult,
  type PlinkoRisk,
} from '../../../../lib/plinkoMath';

export const dynamic = 'force-dynamic';

export interface PlinkoApiResult extends PlinkoDropResult {
  newBalance: number;
  risk: PlinkoRisk;
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: 'カジノを遊ぶにはDiscordログインが必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const betAmount = parseInt(body.betAmount, 10);
    const risk: PlinkoRisk = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'medium';

    if (isNaN(betAmount) || !(PLINKO_ALLOWED_BETS as readonly number[]).includes(betAmount)) {
      return NextResponse.json({
        ok: false,
        error: `不正なベット額です (${PLINKO_ALLOWED_BETS.join(', ')}コインから選択してください)`,
      }, { status: 400 });
    }

    // プレイヤーと所持コインの取得
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ ok: false, error: 'プレイヤー情報の取得に失敗しました。' }, { status: 404 });
    }

    const currentCoins = getPlayerCoins(player);
    if (currentCoins < betAmount) {
      return NextResponse.json({
        ok: false,
        error: `コインが不足しています (所持: ${currentCoins}🪙 / 必要: ${betAmount}🪙)`,
      }, { status: 400 });
    }

    // 抽選実行 (サーバー側で公正に乱数生成)
    const outcome = calculatePlinkoDrop(betAmount, risk);
    const newBalance = currentCoins - betAmount + outcome.winCoins;

    // コイン残高の保存
    await updatePlayerCoinsAndInventory({
      player,
      newCoins: newBalance,
      reason: 'plinko',
      reasonMetadata: {
        betAmount,
        multiplier: outcome.multiplier,
        slotIndex: outcome.slotIndex,
        risk,
      },
    });

    // 20倍以上またはジャックポット時はDiscordへ祝賀通知
    if (outcome.multiplier >= 20.0) {
      const playerName = player.name || session.displayName || '名無し';
      const mention = session.discordId ? `<@${session.discordId}>` : `**${playerName}**`;
      sendShopNotification({
        content: `💣 **【ジグスPlinko大当たり！】** ${mention} さんが **${outcome.multiplier}倍** を叩き出しました！ (+${outcome.winCoins}🪙獲得)`,
        embeds: [
          {
            title: outcome.isJackpot ? '💥 【JACKPOT】ジグスの超特大バウンド爆弾！' : '🔥 【高配当】爆弾が端っこポケットに直撃！',
            description: `${mention} さんがジグスPlinko (${risk.toUpperCase()}モード) で **${betAmount}コイン** を投下し、見事 **${outcome.multiplier}倍** を獲得！\n\n獲得コイン: **+${outcome.winCoins}🪙**\nポケット位置: \`[ スロット ${outcome.slotIndex + 1} / 11 ]\``,
            color: outcome.isJackpot ? 0xef4444 : 0xf59e0b,
            footer: { text: 'KTM カジノ | Ziggs Bouncing Plinko' },
            timestamp: new Date().toISOString(),
          },
        ],
      }).catch(() => {});
    }

    const result: PlinkoApiResult = {
      ...outcome,
      newBalance,
      risk,
    };

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error('[api/bet/plinko] Error:', err);
    const { reportApiError } = await import('../../../../lib/apiHandler');
    reportApiError({ route: '/api/bet/plinko', error: err });
    return NextResponse.json({ ok: false, error: err.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
