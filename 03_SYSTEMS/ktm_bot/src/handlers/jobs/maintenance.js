import { CONFIG } from '../../config.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { fetchWithRetry, fetchPortalAPI } from '../../utils/api.js';
import { markRecruitmentStatus } from '../../utils/recruitPermission.js';
import { notifyAdminError } from '../../utils/alert.js';
import { fetchRecentBotMessages, isClosedCard, markTitleClosed } from './periodicCards.js';

// 放置された都度募集の受付終了・試合同期の後処理
// 2026-10-07: handlers/scheduled.js（1,441行）から分割。処理は分割前と同じ。

/** 投稿から6時間以上経過したオープンなアドホック（ノーマル/ARAM/都度カスタム）募集を静かに受付終了にする（通知なし） */
export async function cleanupStaleAdhocRecruitments(env) {
  try {
    const channelId = CONFIG.RECRUIT_CHANNEL_ID || CONFIG.PERIODIC_RECRUIT_CHANNEL_ID;
    if (!channelId) return;
    const recent = await fetchRecentBotMessages(env, channelId);
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

    for (const m of recent.slice(0, 10)) {
      const embed = m.embeds?.[0];
      if (!embed || isClosedCard(m)) continue;
      const title = embed.title || '';
      // 定期カスタムは別管理のため除外
      if (title.includes('土曜・本戦カスタム') || title.includes('日曜・お祭りカスタム')) continue;

      const createdTime = new Date(m.timestamp).getTime();
      if (createdTime < sixHoursAgo) {
        const closedEmbed = {
          ...embed,
          title: markTitleClosed(title),
          color: 0x7f8c8d
        };
        await fetchWithRetry(`https://discord.com/api/v10/channels/${m.channel_id || channelId}/messages/${m.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [closedEmbed], components: [] })
        }).catch(() => {});
        await markRecruitmentStatus(env, m.id, 'closed').catch(() => {});
        console.log(`[AutoClose] 6時間経過した募集 ${m.id} を静かに受付終了にしました`);
      }
    }
  } catch (e) {
    console.warn('[AutoClose] アドホック募集の自動クローズに失敗:', e);
  }
}

/**
 * handleAutoMatchEnd が試合終了3分後に予約した /api/riot/match-sync 呼び出しを処理する。
 * 以前は ctx.waitUntil 内の setTimeout(fn, 180000) に頼っていたが、外側の async関数が
 * setTimeoutを待たずに即resolveするため waitUntil の延命が効かず、Cloudflare Workers が
 * インスタンスを回収すると3分後の呼び出しが実行される保証がなかった。10分おきcronで
 * 拾う永続キュー(pending_match_sync)に置き換え、確実に（多少遅れても）実行されるようにする。
 */
async function processPendingMatchSyncs(env) {
  try {
    const nowIso = new Date().toISOString();
    const rows = await fetchSupabase(env, 'pending_match_sync', `done=eq.false&run_after=lte.${nowIso}&select=id,match_id`);
    if (!rows || rows.length === 0) return;

    for (const row of rows) {
      try {
        await fetchPortalAPI(env, '/api/riot/match-sync', { matchId: row.match_id });
      } catch (e) {
        console.error(`match-sync failed for matchId ${row.match_id}:`, e);
        // 失敗時も done にする（無限リトライで同じ試合を何度も突くのを防ぐ。手動再実行は可能）
      }
      await fetchSupabase(env, 'pending_match_sync', `id=eq.${row.id}`, 'PATCH', { done: true });
    }
  } catch (err) {
    console.error("processPendingMatchSyncs error:", err);
    // 試合結果の実データ取り込み。落ちるとKDA・MMR・ペンタキル判定が反映されない
    await notifyAdminError(env, err, { action: 'processPendingMatchSyncs(試合同期)' });
  }
}
