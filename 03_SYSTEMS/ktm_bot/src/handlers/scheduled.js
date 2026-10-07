import { CONFIG } from '../config.js';
import { fetchWithRetry } from '../utils/api.js';
import { sendEventUsersNotification, checkCustomStatusAt2000 } from './jobs/eventNotify.js';
import { cleanupStaleAdhocRecruitments } from './jobs/maintenance.js';
import { postWeeklyRecruitment, MAX_CARDS_PER_RUN, fetchRecentBotMessages, isClosedCard, markTitleClosed, migrateLegacyPeriodicCards, resetPeriodicCards } from './jobs/periodicCards.js';
import { sendWeeklyReports } from './jobs/weeklyReports.js';

// 定期実行（Cloudflare Cron / GitHub Actions のバックアップ）の振り分け。各処理は ./jobs/ にある
// （2026-10-07 に1,441行から分割。処理は分割前と同じ）。他のファイルからの読み込み口として下の2つを再公開する。
export { cleanupOldReminderMessages } from './jobs/periodicCards.js';
export { checkCustomStatusAt2000 } from './jobs/eventNotify.js';

export async function handleScheduledEvent(event, env, ctx) {
  console.log("Scheduled event triggered:", JSON.stringify(event));
  const cronExpression = (event.cron || "").trim();
  const mode = event.mode || "";

  // ⚠️ 以下のcron文字列はwrangler.tomlの[triggers]crons設定と完全に一致させる必要がある。
  // Cloudflare Workers Cron Triggersの曜日フィールドは「1=日曜〜7=土曜」(標準Unix cronの
  // 「0=日曜〜6=土曜」とは異なる)。2026-09-21、wrangler.toml側で標準Unix流の数字が
  // 誤って使われ続けていた再発バグを修正した際に、ここのマッチング文字列も合わせて更新した。

  // 1. 毎週水曜 12:00 JST (UTC 3:00 水曜 / CF dow=4): 週末定期カスタム募集（土日分）自動投稿
  if (cronExpression.includes("0 3 * * 4") || mode === "weekly_recruit") {
    console.log("[Scheduled] Executing weekly recruitment posting (Wednesday 12:00 JST)...");
    // mode指定で来た場合 = GitHub Actionsのバックアップ経由。そこで実際に投稿が発生したら、
    // Cloudflare側の本命cron(水曜12:00 JST)が空振りしたということなので、無言で済ませず
    // 管理者へ通知する。2026-09-23に本命が不発し、GitHub Actions側も5時間20分遅延した結果、
    // 募集が水曜17:35に飛ぶ事故が起きたが、誰も気づける仕組みが無かった。
    await postWeeklyRecruitment(env, { isBackupKick: mode === "weekly_recruit" });
  } else if (mode === "weekly_recruit_reset") {
    // 移行が途中で失敗したときの立て直し。手動キック専用。
    console.log("[Scheduled] Executing periodic card reset...");
    await resetPeriodicCards(env);
  } else if (mode === "weekly_recruit_migrate") {
    // 旧形式(1枚に土日同居)カードから新形式(2枚)への一度きりの移行。手動キック専用。
    console.log("[Scheduled] Executing legacy periodic card migration...");
    await migrateLegacyPeriodicCards(env);
  } else if (cronExpression.includes("0 0 * * 2") || mode === "weekly_report") {
    // 毎週月曜 9:00 JST (UTC 0:00 月曜 / CF dow=2): 個人週間レポート配信 ＆ 前週末カスタムカードの受付終了
    await sendWeeklyReports(env);
    try {
      const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
      const recent = await fetchRecentBotMessages(env, channelId);
      for (const m of recent.slice(0, MAX_CARDS_PER_RUN)) {
        const title = m.embeds?.[0]?.title || '';
        if ((title.includes('土曜・本戦カスタム') || title.includes('日曜・お祭りカスタム')) && !isClosedCard(m)) {
          const closedEmbed = { ...m.embeds[0], title: markTitleClosed(title), color: 0x7f8c8d };
          const disabledComponents = (m.components || []).map((row) => ({
            ...row,
            components: row.components.map((btn) => ({ ...btn, disabled: true }))
          }));
          await fetchWithRetry(`https://discord.com/api/v10/channels/${m.channel_id || channelId}/messages/${m.id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [closedEmbed], components: disabledComponents })
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[WeeklyReport] 月曜の定期カスタム締め切りに失敗:', e);
    }
    // 放置された古いアドホック募集（6時間以上経過）も静かに受付終了にする
    await cleanupStaleAdhocRecruitments(env);
  } else if (
    cronExpression.includes("0 11 * * 7,1") || cronExpression.includes("0 11 * * 7") ||
    cronExpression.includes("0 11 * * 1") ||
    mode === "check_2000"
  ) {
    // 毎週土日 20:00 JST (UTC 11:00 土日 / CF dow=7,1): 開催可否判定 ＆ 中止時クイック代替募集
    console.log("[Scheduled] Executing 20:00 Custom Check & Substitute Handler...");
    await checkCustomStatusAt2000(env);
  } else if (
    mode === "event_notify" ||
    cronExpression.includes("0 10 * * 6") || // 金曜 19:00 JST (UTC 10:00 / CF dow=6)
    cronExpression.includes("0 8 * * 7,1") || cronExpression.includes("0 8 * * 7") || cronExpression.includes("0 8 * * 1") // 土曜・日曜 17:00 JST (UTC 08:00 / CF dow=7,1)
  ) {
    // 金曜 19:00 JST, 土曜 17:00 JST, 日曜 17:00 JST: 中間アナウンス＆リマインド通知
    console.log("[Scheduled] Executing intermediate custom reminder & status notification...");
    await sendEventUsersNotification(env, { lookaheadHours: 72 });
  } else {
    console.log("[Scheduled] No matching handler for this trigger:", cronExpression || mode);
  }
}

// ⚠️ 2026-09-29: `sendRecruitmentReminders`（開始15分前のメンションリマインド）と
// その専用ヘルパー `markReminded` をここから削除した。
//
// 削除理由:
//  1. 定義だけで**呼び出し元が一度も存在しなかった**（2026-09-23発見。以来ずっと死んだコード）。
//  2. 復活させる先が無い。15分の窓を狙うには時刻の正確なcronが必要だが、
//     Cloudflareの無料枠cronは**5本上限で既に満杯**。GitHub Actionsは枠が無限だが
//     実測で毎回1〜5時間遅れて発火するため、-5〜+15分の窓にはほぼ入らない。
//     配線しても「動いているように見えて実際は発火しない」状態になり、
//     [[project-orphaned-automation-pattern]] を別の形で作るだけになる。
//  3. 役割は代替できた。**punctualな土日20:00のCloudflare cron**（開催判定）で
//     開催確定時に参加者メンションを出すようにした（上記 checkCustomStatusAt2000 の分岐A）。
//     開始1時間前になるが、確実に届く方が15分前で届かないより価値が高い。
//
// `recruitments.reminded` 列はこれで未使用になるが、DBからは消していない
// （他から参照されておらず害は無く、将来punctualな枠が確保できたら再利用できる）。
