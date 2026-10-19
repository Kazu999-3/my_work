// 勝敗予想（ベット）の締め切り。カジノ画面のカウントダウンと /api/bet の受付判定の両方がここを読む。
// 2026-10-19: 以前は画面だけが締め切りを見ており、API を直接呼ぶ（Bot の /bet を含む）と試合中・試合後でも賭けられた。

/** チーム分けの確定（承認待ちの保存）から何分で締め切るか */
export const BET_DEADLINE_MINUTES = 15;

/** 締め切りの時刻（ミリ秒）。createdAt はチーム分けの承認待ちが作られた時刻 */
export function betDeadlineMs(createdAt: string | number | Date): number {
  return new Date(createdAt).getTime() + BET_DEADLINE_MINUTES * 60 * 1000;
}
