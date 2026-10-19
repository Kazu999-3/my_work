// 勝敗予想（ベット）の締め切り。カジノ画面のカウントダウンと /api/bet の受付判定の両方がここを読む。
// 2026-10-19: 以前は画面だけが締め切りを見ており、API を直接呼ぶと試合中・試合後でも賭けられた。
// またチーム分けをやり直すたびに締め切りが延びる不整合を防ぐため、初回保存時刻を基準に15分固定とする。

/** チーム分けの確定（初回承認待ちの保存）から何分で締め切るか */
export const BET_DEADLINE_MINUTES = 15;

/** 締め切りの時刻（ミリ秒）。createdAt はチーム分けの承認待ちが初回作成された時刻 */
export function betDeadlineMs(createdAt: string | number | Date): number {
  return new Date(createdAt).getTime() + BET_DEADLINE_MINUTES * 60 * 1000;
}
