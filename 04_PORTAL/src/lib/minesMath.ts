/**
 * ブッシュ・スカウト（Mines型ミニゲーム）の配当計算。
 *
 * サーバー（api/bet/mines）とクライアント（KtmMinesGame）の両方から読むため、
 * ここには副作用のない純粋関数だけを置く。DBアクセスや乱数は入れないこと
 * （盤面の生成はサーバー側だけの責務）。
 *
 * 【配当の考え方】
 * 25マス中 mineCount マスが地雷。n マスを無事に開ける確率は
 *   P(n) = Π[i=0..n-1] (25 - mineCount - i) / (25 - i)
 * なので、賭け金の期待値が変わらない「公平倍率」はその逆数
 *   fair(n) = 1 / P(n) = Π[i=0..n-1] (25 - i) / (25 - mineCount - i)
 * になる。これに RTP 0.95 を掛けたものを配当倍率とする。
 *
 * どのマス数でやめても期待値は常に「賭け金 × 0.95」で一定になるため、
 * 「何マスで引き返すのが得か」という最適戦略は存在しない（＝どこでやめても不利にならない）。
 */

/** 盤面のマス数（5×5） */
export const MINES_GRID_SIZE = 25;

/** 還元率。スロット93% / バカラ約99% の間に収めてある */
export const MINES_RTP = 0.95;

/** 選べる地雷の数 */
export const MINES_ALLOWED_MINE_COUNTS = [1, 3, 5, 10] as const;
export type MinesMineCount = (typeof MINES_ALLOWED_MINE_COUNTS)[number];

/** 選べるベット額（スロット・バカラと揃える） */
export const MINES_ALLOWED_BETS = [100, 500, 1000] as const;

/**
 * 1ラウンドの払い戻し上限（ベット額を含む総額）。
 *
 * 倍率は理論上いくらでも伸びる（地雷10個で15マス全開けなら300万倍）ため、上限が無いと
 * コイン総供給（約15,000枚規模）を1ラウンドで破壊しうる。スロットの最大配当
 * （50倍 × 最大ベット1000 = 50,000）と同じ天井に揃えることで、カジノ全体の
 * 最大発行額を増やさないようにしている。
 *
 * 上限に届いた時点で自動的に利確となるため、上限で頭打ちになって損をすることはない。
 * ベット額が小さいほど高い倍率まで伸ばせる（100コインなら500倍まで）。
 */
export const MINES_MAX_PAYOUT = 50000;

/**
 * n マスを無事に開けられる確率。
 */
export function survivalProbability(mineCount: number, revealCount: number): number {
  const safeTiles = MINES_GRID_SIZE - mineCount;
  if (revealCount <= 0) return 1;
  if (revealCount > safeTiles) return 0;

  let p = 1;
  for (let i = 0; i < revealCount; i++) {
    p *= (safeTiles - i) / (MINES_GRID_SIZE - i);
  }
  return p;
}

/**
 * 公平倍率（ハウスエッジを乗せる前の、期待値が変わらない倍率）。
 */
export function fairMultiplier(mineCount: number, revealCount: number): number {
  const p = survivalProbability(mineCount, revealCount);
  return p > 0 ? 1 / p : 0;
}

/**
 * 実際に支払う配当倍率。小数第2位で切り捨てる。
 *
 * 切り捨てにしているのは、表示した倍率より多く払う（＝RTPが95%を超える）ことを避けるため。
 * この丸めのぶん実効RTPは95%をわずかに下回る（実測値は rules ページに記載）。
 */
export function payoutMultiplier(mineCount: number, revealCount: number): number {
  if (revealCount <= 0) return 0;
  const raw = MINES_RTP * fairMultiplier(mineCount, revealCount);
  const floored = Math.floor(raw * 100) / 100;
  // 地雷1個で1マスだけ開けた場合、素の計算では 0.98倍 になり「当てたのに賭け金より減る」
  // という表示になってしまう。プレイヤーから見て理解できない動きなので、下限を元返し(1.00倍)
  // に切り上げる。この1ケースだけ還元率がわずかに上がるが、利益は出ない（＝悪用できない）。
  return Math.max(1, floored);
}

/**
 * 払い戻し額（ベット額を含む総額）。上限でクランプする。
 */
export function payoutCoins(betAmount: number, mineCount: number, revealCount: number): number {
  const raw = Math.floor(betAmount * payoutMultiplier(mineCount, revealCount));
  return Math.min(raw, MINES_MAX_PAYOUT);
}

/**
 * このベット額・地雷数で開けられる最大マス数。
 *
 * 「払い戻しが上限を超えない範囲」かつ「安全マスの数」で決まる。ここに達したラウンドは
 * それ以上めくれず、自動で利確となる。
 */
export function maxRevealCount(mineCount: number, betAmount: number): number {
  const safeTiles = MINES_GRID_SIZE - mineCount;
  let last = 0;
  for (let n = 1; n <= safeTiles; n++) {
    const coins = Math.floor(betAmount * payoutMultiplier(mineCount, n));
    if (coins > MINES_MAX_PAYOUT) break;
    last = n;
  }
  // ベット額が大きすぎて1マスも開けられない組み合わせは作らない（最低1マスは保証する）
  return Math.max(1, last);
}

/**
 * 倍率表（1マスめから最大マス数まで）。UI のペイアウト表示に使う。
 */
export function multiplierTable(
  mineCount: number,
  betAmount: number
): Array<{ revealCount: number; multiplier: number; payout: number }> {
  const max = maxRevealCount(mineCount, betAmount);
  const rows = [];
  for (let n = 1; n <= max; n++) {
    rows.push({
      revealCount: n,
      multiplier: payoutMultiplier(mineCount, n),
      payout: payoutCoins(betAmount, mineCount, n),
    });
  }
  return rows;
}

/** 入力値の検証（サーバー・クライアント共用） */
export function isValidMineCount(v: unknown): v is MinesMineCount {
  return typeof v === 'number' && (MINES_ALLOWED_MINE_COUNTS as readonly number[]).includes(v);
}

export function isValidBetAmount(v: unknown): boolean {
  return typeof v === 'number' && (MINES_ALLOWED_BETS as readonly number[]).includes(v);
}

export function isValidTileIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < MINES_GRID_SIZE;
}
