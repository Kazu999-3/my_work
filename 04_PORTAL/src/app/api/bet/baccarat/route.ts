import { NextResponse } from 'next/server';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

// ============================================================
// カード定義
// ============================================================
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // バカラ点数（10/J/Q/K=0, A=1, 2-9は面値）
}

export type BetTarget = 'PLAYER' | 'BANKER' | 'TIE';
export type GameResult = 'PLAYER' | 'BANKER' | 'TIE';

// ============================================================
// カードの生成・シャッフル
// ============================================================
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getBaccaratValue(rank: Rank): number {
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 0;
  if (rank === 'A') return 1;
  return parseInt(rank);
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: getBaccaratValue(rank) });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  // 8デッキ分作成してFisher-Yatesシャッフル
  const megaDeck: Card[] = [];
  for (let i = 0; i < 8; i++) megaDeck.push(...createDeck());
  for (let i = megaDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [megaDeck[i], megaDeck[j]] = [megaDeck[j], megaDeck[i]];
  }
  return megaDeck;
}

// ============================================================
// バカラスコア計算（下一桁）
// ============================================================
function calcScore(cards: Card[]): number {
  const total = cards.reduce((s, c) => s + c.value, 0);
  return total % 10;
}

// ============================================================
// バカラ本格ルール：3枚目ドロー判定
// https://en.wikipedia.org/wiki/Baccarat#Drawing_rules
// ============================================================
function shouldPlayerDraw(playerScore: number): boolean {
  return playerScore <= 5;
}

function shouldBankerDraw(bankerScore: number, playerDrew: boolean, playerThirdCardValue?: number): boolean {
  if (!playerDrew) {
    // PLAYERがドローしなかった場合: BANKERは0〜5でドロー
    return bankerScore <= 5;
  }
  // PLAYERがドローした場合: BANKERの3枚目はPLAYERの3枚目の値で決定（標準テーブル）
  const p3 = playerThirdCardValue ?? 0;
  if (bankerScore <= 2) return true;
  if (bankerScore === 3) return p3 !== 8;
  if (bankerScore === 4) return p3 >= 2 && p3 <= 7;
  if (bankerScore === 5) return p3 >= 4 && p3 <= 7;
  if (bankerScore === 6) return p3 === 6 || p3 === 7;
  return false; // bankerScore >= 7: ドローなし
}

// ============================================================
// 配当テーブル
// ============================================================
const PAYOUTS: Record<BetTarget, number> = {
  PLAYER: 1.95, // 5%ハウスエッジ
  BANKER: 1.95, // 5%ハウスエッジ（本物はBANKERのみ5%コミッションだが、KTMは統一）
  TIE: 8.0,
};

// ============================================================
// POST /api/bet/baccarat — バカラゲーム実行
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, bet, amount } = body;

    // ── バリデーション ──
    const cleanAmount = Math.floor(Number(amount));
    if (!cleanAmount || isNaN(cleanAmount) || cleanAmount < 10) {
      return NextResponse.json({ error: '最低10コイン以上でベットしてください。' }, { status: 400 });
    }

    const cleanBet = String(bet).toUpperCase() as BetTarget;
    if (!['PLAYER', 'BANKER', 'TIE'].includes(cleanBet)) {
      return NextResponse.json({ error: 'ベット対象はPLAYER / BANKER / TIEのいずれかです。' }, { status: 400 });
    }

    if (!discordId && !playerName) {
      return NextResponse.json({ error: 'プレイヤー情報が不足しています。' }, { status: 400 });
    }

    // ── プレイヤー取得 ──
    const player = await findOrCreatePlayer({
      discordId,
      name: playerName,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ error: 'プレイヤーの取得に失敗しました。' }, { status: 404 });
    }

    const currentCoins = getPlayerCoins(player);
    if (currentCoins < cleanAmount) {
      return NextResponse.json({
        error: `コインが不足しています（所持: ${currentCoins}コイン / 必要: ${cleanAmount}コイン）。`,
      }, { status: 400 });
    }

    // ── カードを配る ──
    const deck = shuffleDeck([]);
    let deckIdx = 0;
    const draw = (): Card => deck[deckIdx++];

    // 最初の2枚ずつ
    const playerCards: Card[] = [draw(), draw()];
    const bankerCards: Card[] = [draw(), draw()];

    let playerScore = calcScore(playerCards);
    let bankerScore = calcScore(bankerCards);

    // ナチュラル判定（8 or 9）→ 3枚目なし
    const isNatural = playerScore >= 8 || bankerScore >= 8;

    let playerThirdCard: Card | null = null;
    let bankerThirdCard: Card | null = null;

    if (!isNatural) {
      // PLAYERの3枚目判定
      const playerDrew = shouldPlayerDraw(playerScore);
      if (playerDrew) {
        playerThirdCard = draw();
        playerCards.push(playerThirdCard);
        playerScore = calcScore(playerCards);
      }

      // BANKERの3枚目判定
      const bankerDrew = shouldBankerDraw(bankerScore, playerDrew, playerThirdCard?.value);
      if (bankerDrew) {
        bankerThirdCard = draw();
        bankerCards.push(bankerThirdCard);
        bankerScore = calcScore(bankerCards);
      }
    }

    // ── 勝敗判定 ──
    let result: GameResult;
    if (playerScore > bankerScore) result = 'PLAYER';
    else if (bankerScore > playerScore) result = 'BANKER';
    else result = 'TIE';

    // ── コイン計算 ──
    const isWin = cleanBet === result;
    const isTieWin = cleanBet === 'TIE' && result === 'TIE';
    const isPush = (cleanBet === 'PLAYER' || cleanBet === 'BANKER') && result === 'TIE';
    // TIE時はPLAYER/BANKERベットは掛け金返還（プッシュ）

    let payout = 0;
    let newCoins: number;
    let resultMessage: string;

    if (isTieWin) {
      payout = Math.floor(cleanAmount * PAYOUTS.TIE);
      newCoins = currentCoins + payout;
      resultMessage = `🎊 TIE！ ${cleanAmount}コイン → +${payout}コイン 獲得！`;
    } else if (isPush) {
      // プッシュ（引き分けで PLAYER/BANKER ベット）→ 掛け金返還
      payout = 0;
      newCoins = currentCoins; // 変動なし
      resultMessage = `🤝 TIE（引き分け）！ 掛け金 ${cleanAmount}コインを返還します。`;
    } else if (isWin) {
      payout = Math.floor(cleanAmount * PAYOUTS[cleanBet]);
      newCoins = currentCoins + payout;
      resultMessage = `🎉 ${result} 勝利！ ${cleanAmount}コイン → +${payout}コイン 獲得！`;
    } else {
      payout = -cleanAmount;
      newCoins = currentCoins - cleanAmount;
      resultMessage = `😞 ${result} 勝利… ${cleanAmount}コイン を失いました。`;
    }

    // ── コイン更新 ──
    if (!isPush) {
      await updatePlayerCoinsAndInventory({ player, newCoins });
    }

    return NextResponse.json({
      success: true,
      result,
      bet: cleanBet,
      isWin: isWin || isTieWin,
      isPush,
      playerCards,
      bankerCards,
      playerScore,
      bankerScore,
      isNatural,
      payout,
      prevCoins: currentCoins,
      remainingCoins: newCoins,
      message: resultMessage,
    });
  } catch (error: any) {
    console.error('[baccarat POST] error:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
