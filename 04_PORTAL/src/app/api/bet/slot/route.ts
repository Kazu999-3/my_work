import { NextResponse } from 'next/server';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { sendShopNotification } from '../../../../lib/discordNotify';

export const dynamic = 'force-dynamic';

export type SlotSymbol = 'gem' | 'baron' | 'dragon' | 'sword' | 'poro' | 'minion' | 'potion';

export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  payoutMultiplier: number;
  winCoins: number;
  betAmount: number;
  newBalance: number;
  isJackpot: boolean;
  message: string;
}

const SYMBOL_DISPLAY: Record<SlotSymbol, { name: string; emoji: string }> = {
  gem: { name: 'Hextechジェム', emoji: '💎' },
  baron: { name: 'バロンナッシャー', emoji: '👾' },
  dragon: { name: 'ドラゴン', emoji: '🐉' },
  sword: { name: 'ドランブレード', emoji: '🗡️' },
  poro: { name: 'ポロ', emoji: '🐹' },
  minion: { name: 'ミニオン', emoji: '🧙' },
  potion: { name: '体力ポーション', emoji: '🧪' },
};

/**
 * スロット抽選ロジック (RTP 約93.0%, ハウスエッジ 7.0%)
 */
function spinReels(): { reels: [SlotSymbol, SlotSymbol, SlotSymbol]; multiplier: number; isJackpot: boolean; message: string } {
  const rand = Math.random();

  // 1. 💎 Gem x3 (50倍 ジャックポット! 確率 0.2%)
  if (rand < 0.002) {
    return { reels: ['gem', 'gem', 'gem'], multiplier: 50, isJackpot: true, message: '🎉 超大当たり！Hextechジェム3つ揃い (50倍)！' };
  }
  // 2. 👾 Baron x3 (15倍 確率 1.0%)
  if (rand < 0.012) {
    return { reels: ['baron', 'baron', 'baron'], multiplier: 15, isJackpot: false, message: '🔥 大当たり！バロン3つ揃い (15倍)！' };
  }
  // 3. 🐉 Dragon x3 (5倍 確率 3.0%)
  if (rand < 0.042) {
    return { reels: ['dragon', 'dragon', 'dragon'], multiplier: 5, isJackpot: false, message: '✨ 中当たり！ドラゴン3つ揃い (5倍)！' };
  }
  // 4. 🗡️ Sword x3 (3倍 確率 7.0%)
  if (rand < 0.112) {
    return { reels: ['sword', 'sword', 'sword'], multiplier: 3, isJackpot: false, message: '⚔️ 当たり！ドランブレード3つ揃い (3倍)！' };
  }
  // 5. 🐹 Poro x3 (2倍 確率 12.0%)
  if (rand < 0.232) {
    return { reels: ['poro', 'poro', 'poro'], multiplier: 2, isJackpot: false, message: '🐹 当たり！ポロ3つ揃い (2倍)！' };
  }
  // 6. 💎 Gem x2 (1.5倍 確率 2.0%)
  if (rand < 0.252) {
    const dummy: SlotSymbol[] = ['minion', 'potion', 'sword', 'poro'];
    const other = dummy[Math.floor(Math.random() * dummy.length)];
    return { reels: ['gem', 'gem', other], multiplier: 1.5, isJackpot: false, message: '💎 惜しい！ジェム2つ揃い (1.5倍)！' };
  }
  // 7. 🐹 Poro x2 (1.0倍 元返し 確率 5.0%)
  if (rand < 0.302) {
    const dummy: SlotSymbol[] = ['minion', 'potion', 'sword'];
    const other = dummy[Math.floor(Math.random() * dummy.length)];
    return { reels: ['poro', 'poro', other], multiplier: 1.0, isJackpot: false, message: '🐹 ポロ2つ揃い！ベット額返還 (1倍)！' };
  }

  // 8. ハズレ (不揃いリール生成)
  const pool: SlotSymbol[] = ['minion', 'potion', 'sword', 'poro', 'dragon', 'baron'];
  let r1 = pool[Math.floor(Math.random() * pool.length)];
  let r2 = pool[Math.floor(Math.random() * pool.length)];
  let r3 = pool[Math.floor(Math.random() * pool.length)];

  // 万一揃ってしまったら1つズラす
  if (r1 === r2 && r2 === r3) {
    r3 = r3 === 'potion' ? 'minion' : 'potion';
  }

  return { reels: [r1, r2, r3], multiplier: 0, isJackpot: false, message: '残念…ハズレ！次は当たるかも！？' };
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: 'カジノを遊ぶにはDiscordログインが必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const betAmount = parseInt(body.betAmount, 10);

    const ALLOWED_BETS = [100, 500, 1000];
    if (isNaN(betAmount) || !ALLOWED_BETS.includes(betAmount)) {
      return NextResponse.json({ ok: false, error: '不正なベット額です (100, 500, 1000コインから選択してください)' }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: `コインが不足しています (所持: ${currentCoins}🪙 / 必要: ${betAmount}🪙)` }, { status: 400 });
    }

    // 抽選実行
    const outcome = spinReels();
    const winCoins = Math.floor(betAmount * outcome.multiplier);
    const newBalance = currentCoins - betAmount + winCoins;

    // コイン残高の保存
    await updatePlayerCoinsAndInventory({
      player,
      newCoins: newBalance,
      reason: 'slot',
      reasonMetadata: { betAmount, multiplier: outcome.multiplier, reels: outcome.reels },
    });

    // 15倍以上またはジャックポット時はDiscordへ祝賀通知
    if (outcome.multiplier >= 15) {
      const playerName = player.name || session.displayName || '名無し';
      const mention = session.discordId ? `<@${session.discordId}>` : `**${playerName}**`;
      sendShopNotification({
        content: `🎰 **【KTMスロット大当たり！】** ${mention} さんが **${outcome.multiplier}倍** を引き当てました！ (+${winCoins}🪙獲得)`,
        embeds: [
          {
            title: outcome.isJackpot ? '💎 【JACKPOT】Hextechスロット特大ジャックポット！' : '👾 【大当たり】バロン揃い大勝利！',
            description: `${mention} さんがスロットで **${betAmount}コイン** を賭けて、見事 **${outcome.multiplier}倍** を獲得！\n\n獲得コイン: **+${winCoins}🪙**\nリール結果: \`[ ${outcome.reels.map((r) => SYMBOL_DISPLAY[r].emoji).join(' ')} ]\``,
            color: outcome.isJackpot ? 0x6366f1 : 0xf59e0b,
            footer: { text: 'KTM カジノ | Hextech Slots' },
            timestamp: new Date().toISOString(),
          },
        ],
      }).catch(() => {});
    }

    const result: SlotResult = {
      reels: outcome.reels,
      payoutMultiplier: outcome.multiplier,
      winCoins,
      betAmount,
      newBalance,
      isJackpot: outcome.isJackpot,
      message: outcome.message,
    };

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error('[api/bet/slot] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
