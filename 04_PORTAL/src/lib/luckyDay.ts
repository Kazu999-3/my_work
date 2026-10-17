// 🍀 ラッキーデー（毎月 7・17・27 日、日本時間）。2026-10-17 ユーザー判断で導入（案A＋C）。
// - A: カジノの各ゲーム（スロット・Plinko・ブッシュ・スカウト・バカラ・スクラッチ）の払い戻しを +3%
//      （還元率は 95〜98% 前後 → 98〜101% 程度。月3日だけなのでコイン総量への影響は小さい）
// - C: デイリーおみくじの報酬を 2 倍
// サーバー（払い戻しの計算）と画面（バナー表示）の両方から使う。外部依存なし。

export const LUCKY_DAYS = [7, 17, 27] as const;
export const LUCKY_PAYOUT_RATE = 1.03;
export const LUCKY_OMIKUJI_MULTIPLIER = 2;

/** 日本時間で 7・17・27 日か */
export function isLuckyDay(now: Date = new Date()): boolean {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return (LUCKY_DAYS as readonly number[]).includes(jst.getUTCDate());
}

/** ラッキーデーなら払い戻し（賭け金を含む受取額）を +3%。0 以下（負け）はそのまま */
export function applyLuckyBonus(payout: number, now: Date = new Date()): number {
  return payout > 0 && isLuckyDay(now) ? Math.floor(payout * LUCKY_PAYOUT_RATE) : payout;
}
