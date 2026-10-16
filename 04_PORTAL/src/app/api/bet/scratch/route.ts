import { NextResponse } from 'next/server';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { verifyUserOrAdmin } from '../../../../lib/authGuard';
import { sendShopNotification } from '../../../../lib/discordNotify';

export const dynamic = 'force-dynamic';

const SCRATCH_PRICE = 150;

interface ScratchTier {
  name: string;
  prize: number;
  icon: string;
  chance: number; // 確率 (%)
  announce: boolean; // Discord通知を送るかどうか
}

// 確率テーブル（合計100%）
// 🥇 特等(1%): 3,000🪙 / 🥈 1等(4%): 800🪙 / 🥉 2等(15%): 250🪙 / 🎖️ 3等(40%): 80🪙 / 🍃 ハズレ(40%): 30🪙
// 期待値 143.5🪙/枚（還元率 約95.7%）。2026-10-17: 以前は特等5,000/1等1,000/2等300/3等100で還元率約125%
// （引くほどコインが増える設計）だったため、ユーザー判断で当選額を下げた。
const TIERS: ScratchTier[] = [
  { name: '🥇 特等（ジャックポット）', prize: 3000, icon: '🌟', chance: 1, announce: true },
  { name: '🥈 1等', prize: 800, icon: '🎉', chance: 4, announce: true },
  { name: '🥉 2等', prize: 250, icon: '✨', chance: 15, announce: false },
  { name: '🎖️ 3等', prize: 80, icon: '🪙', chance: 40, announce: false },
  { name: '🍃 参加賞', prize: 30, icon: '🍂', chance: 40, announce: false },
];

function drawScratchTier(): ScratchTier {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const tier of TIERS) {
    cumulative += tier.chance;
    if (rand < cumulative) {
      return tier;
    }
  }
  return TIERS[TIERS.length - 1];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName } = body;

    if (!discordId && !playerName) {
      return NextResponse.json({ error: 'Discordログインが必要です。' }, { status: 401 });
    }

    // 本人確認
    const authCheck = await verifyUserOrAdmin({ discordId, playerName });
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    const player = await findOrCreatePlayer({
      discordId,
      name: playerName,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 404 });
    }

    const currentCoins = getPlayerCoins(player);
    if (currentCoins < SCRATCH_PRICE) {
      return NextResponse.json({
        error: `コインが不足しています（現在: ${currentCoins.toLocaleString()}🪙 / 必要: ${SCRATCH_PRICE}🪙）。`
      }, { status: 400 });
    }

    // スクラッチ抽選
    const resultTier = drawScratchTier();
    const netChange = resultTier.prize - SCRATCH_PRICE;
    const newCoins = currentCoins - SCRATCH_PRICE + resultTier.prize;

    const updateRes = await updatePlayerCoinsAndInventory({
      player,
      newCoins,
      reason: 'scratch_card',
      reasonMetadata: {
        price: SCRATCH_PRICE,
        prize: resultTier.prize,
        tierName: resultTier.name,
      },
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: 'スクラッチ処理（コイン更新）に失敗しました。' }, { status: 500 });
    }

    // 高額当選時のDiscord通知
    if (resultTier.announce) {
      try {
        await sendShopNotification({
          embeds: [{
            title: `🥠【スクラッチ大当たり！】${player.name} さんが当選！`,
            description: `**🥠 闇のスクラッチくじ** を削った結果...\n\n**${resultTier.icon} ${resultTier.name} が当選しました！**\n🪙 **獲得賞金:** +${resultTier.prize.toLocaleString()}コイン！（残高: ${newCoins.toLocaleString()}🪙）`,
            color: resultTier.prize >= 3000 ? 0xf59e0b : 0x14b8a6,
            footer: { text: 'KTM Sovereign Casino' },
            timestamp: new Date().toISOString()
          }]
        });
      } catch (notifyErr) {
        console.warn('[scratch] Discord通知失敗（続行）:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      price: SCRATCH_PRICE,
      prize: resultTier.prize,
      tier: resultTier.name,
      icon: resultTier.icon,
      remainingCoins: newCoins,
      netChange,
    });
  } catch (error: any) {
    console.error('Scratch API error:', error);
    const { reportApiError } = await import('../../../../lib/apiHandler');
    reportApiError({ route: '/api/bet/scratch', error });
    return NextResponse.json({ error: '内部エラーが発生しました。' }, { status: 500 });
  }
}
