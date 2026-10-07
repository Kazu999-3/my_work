import { fetchSupabase } from '../../utils/supabase.js';
import { fetchWithRetry } from '../../utils/api.js';
import { notifyAdminError } from '../../utils/alert.js';

// 個人の週間レポート配信
// 2026-10-07: handlers/scheduled.js（1,441行）から分割。処理は分割前と同じ。

/**
 * 個人週間レポート(#84): 直近7日にKTMカスタムをプレイした人へ、
 * 「◯勝◯敗 / MMR±◯ / 最多レーン」のサマリーをDiscord DMで送る。
 * ※DMを閉じている人へは送れない（エラーはスキップ）。cronは週1のためGH側の冗長キック対象外（DM二重送信防止）。
 */
export async function sendWeeklyReports(env) {
  try {
    const weekAgoIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const rows = await fetchSupabase(
      env,
      'ktm_match_participants',
      `select=discord_id,player_name,role,team,mmr_delta,ktm_matches!inner(winning_team,created_at)&ktm_matches.created_at=gte.${encodeURIComponent(weekAgoIso)}`
    );
    if (!rows || rows.length === 0) { console.log('[WeeklyReport] 今週の試合なし'); return; }

    // discord_id ごとに集計（未紐付けはスキップ）
    const agg = new Map();
    for (const r of rows) {
      if (!r.discord_id) continue;
      if (!agg.has(r.discord_id)) agg.set(r.discord_id, { name: r.player_name, games: 0, wins: 0, mmr: 0, roles: {} });
      const a = agg.get(r.discord_id);
      a.games += 1;
      if (r.team === r.ktm_matches?.winning_team) a.wins += 1;
      a.mmr += r.mmr_delta || 0;
      a.roles[r.role] = (a.roles[r.role] || 0) + 1;
    }

    let sent = 0;
    for (const [discordId, a] of agg) {
      try {
        const topRole = Object.entries(a.roles).sort((x, y) => y[1] - x[1])[0]?.[0] || '-';
        const mmrStr = a.mmr > 0 ? `+${a.mmr}` : `${a.mmr}`;
        // DMチャンネル作成 → 送信
        const dmRes = await fetchWithRetry('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_id: discordId })
        });
        if (!dmRes.ok) continue;
        const dm = await dmRes.json();
        await fetchWithRetry(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '📈 今週のKTMカスタム レポート',
              description: `**${a.name}** さんの直近7日間のまとめです`,
              color: a.mmr >= 0 ? 0x2ecc71 : 0xe67e22,
              fields: [
                { name: '戦績', value: `${a.games}戦 ${a.wins}勝${a.games - a.wins}敗（勝率${Math.round((a.wins / a.games) * 100)}%）`, inline: true },
                { name: 'MMR変動', value: `**${mmrStr}**`, inline: true },
                { name: '最多レーン', value: topRole, inline: true },
              ],
              footer: { text: 'KTM Bot | 週間レポート（毎週月曜配信）' },
              timestamp: new Date().toISOString()
            }]
          })
        });
        sent++;
        await new Promise(r => setTimeout(r, 350)); // レート配慮
      } catch (e) {
        console.warn(`[WeeklyReport] DM失敗 (${discordId}):`, e?.message);
      }
    }
    console.log(`[WeeklyReport] ${sent}/${agg.size} 人へ送信しました`);
  } catch (err) {
    console.error('[WeeklyReport] error:', err);
    await notifyAdminError(env, err, { action: 'sendWeeklyReports(週間レポートDM)' });
  }
}
