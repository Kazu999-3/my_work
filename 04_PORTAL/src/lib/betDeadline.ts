// 勝敗予想（ベット）の締め切り。カジノ画面のカウントダウンと /api/bet の受付判定の両方がここを読む。
// 2026-10-19: 以前は画面だけが締め切りを見ており、API を直接呼ぶと試合中・試合後でも賭けられた。
// 2026-10-24: 観戦投票（勝敗予想）の締め切りは、チーム発表をDiscordに送信した時刻（announcedAt）を起点に15分固定とする。

/** チーム発表（Discordへのチーム分け通知送信）から何分で締め切るか */
export const BET_DEADLINE_MINUTES = 15;

/** 締め切りの時刻（ミリ秒）。createdAt / announcedAt はチーム分けがDiscordへ発表された時刻 */
export function betDeadlineMs(createdAt: string | number | Date): number {
  return new Date(createdAt).getTime() + BET_DEADLINE_MINUTES * 60 * 1000;
}
