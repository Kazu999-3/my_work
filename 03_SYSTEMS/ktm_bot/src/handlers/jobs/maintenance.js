import { CONFIG } from '../../config.js';
import { fetchWithRetry } from '../../utils/api.js';
import { markRecruitmentStatus } from '../../utils/recruitPermission.js';
import { fetchRecentBotMessages, isClosedCard, markTitleClosed } from './periodicCards.js';

// 放置された都度募集の受付終了
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
