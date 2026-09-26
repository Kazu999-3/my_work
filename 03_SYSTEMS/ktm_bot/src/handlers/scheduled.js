import { CONFIG } from '../config.js';
import { fetchSupabase } from '../utils/supabase.js';
import { parseMessageData } from '../utils/helpers.js';
import { fetchWithRetry, fetchPortalAPI, sendDiscordMessage } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, buildDayRecruitEmbed, buildDayRecruitComponents } from '../ui/embeds.js';
import { createRecruitment, markRecruitmentStatus } from '../utils/recruitPermission.js';
import { notifyAdminError } from '../utils/alert.js';
import { getKtmRank, formatRankDistribution, formatMmrWithRank, getHighestLaneMmr, getPlayerExperienceBadge } from '../utils/ktmRank.js';
import {
  computeDayStatus, buildDayBanner, replaceBanner, getDayDef, detectDayKey,
  computeDominantTier, extractEntryLines, DAY_CAPACITY, RECRUITMENT_COLORS, DAY_DEFS,
  resolveWeekendTargets, buildRecruitmentContent,
} from '../utils/recruitmentStatus.js';

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
  } else if (cronExpression.includes("0 3 1 * *") || mode === "monthly_award") {
    // 毎月1日 12:00 JST (UTC 3:00 毎月1日): 月間アワード表彰の自動投稿
    console.log("[Scheduled] Executing monthly award announcement...");
    const { generateMonthlyAwardEmbed } = await import('./ranking.js');
    const embed = await generateMonthlyAwardEmbed(env);
    if (embed) {
      const channelId = CONFIG.RECRUIT_CHANNEL_ID || "1485636511679651871";
      await sendDiscordMessage(`channels/${channelId}/messages`, env.DISCORD_TOKEN, "POST", {
        content: `👑 **【KTM 月間アワード発表】先月最も活躍したメンバーを表彰します！** <@&${CONFIG.NOTIFICATION_ROLE_ID}>`,
        embeds: [embed]
      }).catch(e => console.error("Monthly award post failed:", e));
    }
  } else {
    console.log("[Scheduled] No matching handler for this trigger:", cronExpression || mode);
  }
}

/** 開始予定時刻が近い(=数分〜15分以内)募集の参加者にメンションでリマインドする(D1) */
async function sendRecruitmentReminders(env) {
  try {
    const now = Date.now();
    const minIso = new Date(now - 5 * 60 * 1000).toISOString();  // 5分前まで（開始直後の取りこぼし救済）
    const maxIso = new Date(now + 15 * 60 * 1000).toISOString(); // 15分後まで（10分間隔cronで確実に1回拾う）
    const q = `status=eq.open&reminded=eq.false&start_at=not.is.null&start_at=gte.${minIso}&start_at=lte.${maxIso}&select=*`;
    const rows = await fetchSupabase(env, 'recruitments', q);
    if (!rows || rows.length === 0) return;

    for (const r of rows) {
      try {
        // 元の募集メッセージを取得して参加者を復元
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${r.discord_channel_id}/messages/${r.discord_message_id}`, {
          headers: { "Authorization": `Bot ${env.DISCORD_TOKEN}` }
        });
        if (!msgRes.ok) {
          // メッセージが削除済み等 → 二度と拾わないよう既送信扱いにする
          await markReminded(env, r.discord_message_id);
          continue;
        }
        const msg = await msgRes.json();
        const meta = parseMessageData(msg);
        const ids = [...new Set([meta.owner, ...(meta.joined || [])])].filter(Boolean);
        const mentions = ids.map(id => `<@${id}>`).join(' ');
        const timeText = meta.time ? `（開始予定 ${meta.time}）` : '';

        await fetch(`https://discord.com/api/v10/channels/${r.discord_channel_id}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bot ${env.DISCORD_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `⏰ **まもなく開始予定です！**${timeText}\n参加者は集合をお願いします 🎮\n${mentions}`.trim(),
            message_reference: { message_id: r.discord_message_id },
            allowed_mentions: { users: ids.slice(0, 100) }
          })
        });

        await markReminded(env, r.discord_message_id);
      } catch (e) {
        console.error(`Recruitment reminder failed (msg ${r.discord_message_id}):`, e);
      }
    }
  } catch (err) {
    console.error("sendRecruitmentReminders error:", err);
  }
}

/** 投稿から6時間以上経過したオープンなアドホック（ノーマル/ARAM/都度カスタム）募集を静かに受付終了にする（通知なし） */
async function cleanupStaleAdhocRecruitments(env) {
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

async function markReminded(env, messageId) {
  try {
    await fetchSupabase(env, 'recruitments', `discord_message_id=eq.${messageId}`, 'PATCH', {
      reminded: true,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("markReminded failed:", e);
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
  }
}

/**
 * 直前通知（募集ベース）: Discordイベントではなく「実際に立っている募集」を見て、
 * 現在の参加人数を通知する。10人に足りなければ通知ロールをメンションして欠員アラート。
 * 二重投稿防止のため、直近3時間に同一タイトルのbot投稿があればスキップする。
 */
async function sendRecruitStatusNotification(env) {
  try {
    // 対象は「これから開始する未来の募集（現在時刻〜24時間以内）」のopen募集。
    // すでに開始時刻を過ぎた古い募集に対する10分間隔Cronの誤爆通知を完全に防止。
    const nowMs = Date.now();
    const fromIso = new Date(nowMs).toISOString(); // 現在時刻以降のみ
    const toIso = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
    const rows = await fetchSupabase(
      env, 'recruitments',
      `status=eq.open&start_at=gte.${encodeURIComponent(fromIso)}&start_at=lte.${encodeURIComponent(toIso)}&order=start_at.asc&limit=5&select=discord_message_id,discord_channel_id,start_at,max_count`
    );
    if (!rows || rows.length === 0) {
      console.log('[RecruitStatus] 直近（未来24時間以内）のオープンな募集がないため通知をスキップします。');
      return;
    }

    for (const r of rows) {
      if (!r.discord_message_id || !r.discord_channel_id) continue;
      // 募集メッセージを取得して参加者を解析
      const msgRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages/${r.discord_message_id}`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const metadata = parseMessageData(msg);
      if (!metadata) continue;

      const joined = metadata.joined || [];
      const max = metadata.maxCount || r.max_count || 10;
      const shortage = Math.max(0, max - joined.length);
      const startJst = r.start_at
        ? new Date(new Date(r.start_at).getTime() + 9 * 3600 * 1000).toISOString().slice(11, 16)
        : (metadata.time || '');

      // 参加者ごとのMMRを引いて、名前一覧にランクを併記しつつ分布も出す
      const mmrById = new Map();
      if (joined.length > 0) {
        try {
          const idsStr = joined.map((i) => `"${i}"`).join(',');
          const ps = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup`);
          for (const p of (ps || [])) {
            const hMmr = getHighestLaneMmr(p);
            if (hMmr > 0) mmrById.set(String(p.discord_id), hMmr);
          }
        } catch (e) {
          console.warn('[RecruitStatus] MMR取得に失敗:', e);
        }
      }

      const nameList = joined.length > 0
        ? joined.map((id, i) => {
            const idx = String(i + 1).padStart(2, '0');
            const mmr = mmrById.get(String(id));
            // 例: 01. @かず — 1450（ゴールド相当）
            return `${idx}. <@${id}> — ${formatMmrWithRank(mmr)}`;
          }).join('\n')
        : '（まだ参加者がいません）';

      // 参加者のランク分布（サッと構成を掴む用）
      let tierLine = '';
      if (mmrById.size > 0) {
        const mmrs = [...mmrById.values()];
        const unknown = joined.length - mmrs.length; // 名簿未登録
        const dist = formatRankDistribution(mmrs, unknown);
        if (dist) {
          tierLine = `\n\n**ランク内訳**: ${dist}`;
          if (mmrs.length >= 2) {
            const hi = getKtmRank(Math.max(...mmrs));
            const lo = getKtmRank(Math.min(...mmrs));
            if (hi.name !== lo.name) tierLine += `　幅: ${lo.short}〜${hi.short}`;
          }
        }
      }

      const title = shortage > 0
        ? `⚠️ カスタム募集中 — あと${shortage}名！`
        : `✅ カスタム募集 — メンバー確定（${joined.length}/${max}）`;

      // 二重投稿防止。
      // ★ メンバー確定の通知は参加者へメンションが飛ぶため、募集中の通知(3時間窓)と同じ基準だと
      //   満員のまま10分間隔cronが回り続ける間、3時間おきに全員へ鳴り直してしまう。
      //   確定通知だけは走査範囲と期間を広げ、同じ募集カードへの確定返信が1件でもあれば送らない。
      const isConfirmed = shortage === 0;
      const dupLimit = isConfirmed ? 50 : 10;
      const dupWindowMs = isConfirmed ? 7 * 24 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
      const recentRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages?limit=${dupLimit}`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const since = nowMs - dupWindowMs;
        const duplicated = recent.find((m) => {
          if (!m.author?.bot || new Date(m.timestamp).getTime() <= since) return false;
          if (m.embeds?.[0]?.title === title) return true;
          // 確定タイトルには人数が入るので、この募集への確定返信かどうかでも照合する
          return isConfirmed
            && m.message_reference?.message_id === r.discord_message_id
            && (m.embeds?.[0]?.title || '').startsWith('✅ カスタム募集');
        });
        if (duplicated) {
          console.log('[RecruitStatus] 同一通知が直近にあるためスキップ');
          continue;
        }
      }

      const embed = {
        title,
        description: `**開催予定: ${startJst}${startJst ? ' (JST)' : ''}**\n現在の参加者 **${joined.length}/${max}** 名\n\n${nameList}${tierLine}`,
        color: shortage > 0 ? RECRUITMENT_COLORS.recruiting : RECRUITMENT_COLORS.confirmed,
        footer: { text: 'KTM Bot | 募集状況のお知らせ' },
        timestamp: new Date().toISOString()
      };

      // 募集メッセージへの返信としてぶら下げ、チャンネルの流れに通知が散らばらないようにする
      const body = {
        embeds: [embed],
        message_reference: { message_id: r.discord_message_id, fail_if_not_exists: false }
      };
      // 人数不足のときだけ通知ロールをメンションして能動的に呼ぶ
      if (shortage > 0 && CONFIG.NOTIFICATION_ROLE_ID) {
        body.content = `<@&${CONFIG.NOTIFICATION_ROLE_ID}> 🔥 **あと${shortage}名でカスタム開催です！** 参加できる方は上の募集メッセージから参加ボタンを押してください！`;
        body.allowed_mentions = { roles: [CONFIG.NOTIFICATION_ROLE_ID] };
      } else if (shortage === 0 && joined.length > 0) {
        // メンバー確定は当事者だけに通知する(ロール購読者全員に鳴らさない)。
        // 以前は確定時にcontent自体が無く、揃ったことが誰にも通知されていなかった。
        const confirmIds = [...new Set(joined)].filter(Boolean).slice(0, 100);
        body.content = `✅ **メンバーが揃いました！** 開始までに準備をお願いします。\n通知: ${confirmIds.map((id) => `<@${id}>`).join(' ')}`;
        body.allowed_mentions = { users: confirmIds };
      }

      const sendRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      if (!sendRes.ok) {
        console.error(`[RecruitStatus] 送信失敗: ${sendRes.status} ${await sendRes.text()}`);
      } else {
        console.log(`[RecruitStatus] 通知しました（${joined.length}/${max}）`);
      }
    }
  } catch (err) {
    console.error('[RecruitStatus] error:', err);
  }
}

/**
 * 個人週間レポート(#84): 直近7日にKTMカスタムをプレイした人へ、
 * 「◯勝◯敗 / MMR±◯ / 最多レーン」のサマリーをDiscord DMで送る。
 * ※DMを閉じている人へは送れない（エラーはスキップ）。cronは週1のためGH側の冗長キック対象外（DM二重送信防止）。
 */
async function sendWeeklyReports(env) {
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
  }
}

/**
 * 直近の週末（土曜21:00 / 日曜21:00）の定期カスタム募集カードを専用チャンネルへ自動投稿する(#85)。
 * 毎週水曜 12:00 JST に発火。
 *
 * ★ 2026-09-23: 1枚のカードに土日を同居させる構成をやめ、土曜カード/日曜カードの
 *   2メッセージへ完全に分離した。旧構成は「※土曜と日曜は別々の募集です」と文章で
 *   断っていただけで、実態としては
 *   ・6個のボタンが1メッセージに同居して押し間違えやすい
 *   ・recruitments へ登録されるレコードが土曜分の1件だけで、日曜側はDB上存在せず、
 *     リマインド・20:00開催判定・ポータル通知が構造的に機能しない
 *   という問題が残っていた（「生成経路はあるが誰も拾っていない」孤立パターン）。
 *
 * 二重投稿防止は recruitments.start_at を使って「日ごと」に行うため、
 * Cloudflare cron と GitHub Actions バックアップが何度重複発火しても安全。
 */
async function postWeeklyRecruitment(env, options = {}) {
  try {
    const targetChannelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID || "1528646515533287497";
    const targets = resolveWeekendTargets();

    // 1. 前回の定期カスタム募集を DB および Discord 上で締め切る
    //    今週分(targets)は除外する。バックアップキックで2回目以降が走ったとき、
    //    直前に投稿したばかりのカードを自分で閉じてしまうのを防ぐ。
    const recentMessages = await fetchRecentBotMessages(env, targetChannelId);
    await closePreviousPeriodicRecruitments(env, targetChannelId, targets, recentMessages);
    await cleanupStaleAdhocRecruitments(env);

    // 2. 土曜・日曜のカードをそれぞれ投稿する（片方が失敗しても、もう片方は投稿する）
    let posted = 0;
    for (const target of targets) {
      const ok = await postDayRecruitmentCard(env, targetChannelId, target, { recentMessages });
      if (ok) posted += 1;
    }
    console.log(`[WeeklyRecruit] 定期カスタム募集カードを ${posted}/${targets.length} 件投稿しました`);

    if (posted > 0 && options.isBackupKick) {
      await notifyAdminError(
        env,
        `定期カスタム募集をバックアップ経路から投稿しました (${posted}件)`,
        {
          detail: 'Cloudflareの本命cron(水曜12:00 JST)が空振りしています。Workers側のcron設定と実行ログを確認してください。',
          source: 'postWeeklyRecruitment',
        }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[WeeklyRecruit] error:', err);
  }
}

const CHANNEL_SCAN_LIMIT = 100;

// Cloudflare Workers はリクエストあたりのサブリクエスト数に上限がある（無料プランで50）。
// 上限を超えると以降の fetch がすべて失敗するため、1回の実行で触る旧カードの枚数を絞る。
// 2026-09-23、旧カードを大量に処理した結果、続く日曜カードの投稿が丸ごと飛んだ。
const MAX_CARDS_PER_RUN = 4;

/**
 * チャンネルの直近メッセージからBotの投稿を取得する。
 *
 * ★ 2026-09-23: `recruitments` テーブルが実測で全件0行だったため、DBを唯一の
 *   手がかりにしている処理はすべて空振りする。Botの書き込みが成立していない
 *   （`recruitPermission.js` にも「ベストエフォート作成」と書かれている）ので、
 *   募集カードの所在はDBではなく Discord を正とし、DBは補助に格下げした。
 */
async function fetchRecentBotMessages(env, channelId) {
  try {
    const res = await fetchWithRetry(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=${CHANNEL_SCAN_LIMIT}`,
      { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
    );
    if (!res.ok) return [];
    const msgs = await res.json();
    return Array.isArray(msgs) ? msgs.filter((m) => m.author?.bot) : [];
  } catch (e) {
    console.warn('[Recruit] チャンネル走査に失敗:', e);
    return [];
  }
}

/** 受付終了済みのカードか */
function isClosedCard(msg) {
  return (msg.embeds?.[0]?.title || '').startsWith(CLOSED_PREFIX);
}

/** 新形式（参加者フィールド1つ）の、指定した日のカードを探す */
function findDayCard(messages, target) {
  const def = getDayDef(target.dayKey);
  return messages.find((m) => {
    const embed = m.embeds?.[0];
    if (!embed || isClosedCard(m)) return false;
    const title = embed.title || '';
    if (!title.includes(def.name) || !title.includes(target.label)) return false;
    // 旧形式(土日同居)は参加者フィールドが2つ以上あるので除外する
    return (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length < 2;
  }) || null;
}

/** 旧形式（1枚に土日が同居）のカードを探す */
function findLegacyCards(messages) {
  return messages.filter((m) => {
    const embed = m.embeds?.[0];
    if (!embed || isClosedCard(m)) return false;
    return (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length >= 2;
  });
}

const CLOSED_PREFIX = '🔒 [受付終了]';

/** 受付終了の見出しを付ける。既に付いていれば二重に付けない（移行の再実行対策） */
function markTitleClosed(title) {
  const t = (title || '').trim();
  return t.startsWith(CLOSED_PREFIX) ? t : `${CLOSED_PREFIX} ${t}`.trim();
}

/**
 * 募集レコードを id 指定で更新する。
 *
 * ★ 2026-09-23: この関数は以前から2箇所で呼ばれていたにもかかわらず、コードベースの
 *   どこにも定義が無く、呼ばれるたびに ReferenceError になっていた。
 *   呼び出し元が try/catch で例外を握りつぶしていたため表面化せず、
 *   「毎週水曜に前回の募集を締め切る」処理が一度も成功していなかった
 *   （＝ status=open の定期カスタムが毎週溜まり続け、旧カードのボタンも押せるまま）。
 *   `.catch()` を付けても ReferenceError は Promise の拒否ではなく同期例外なので
 *   捕まえられない、という点も発覚が遅れた理由。
 */
async function updateRecruitment(env, id, patch) {
  return fetchSupabase(env, 'recruitments', `id=eq.${id}`, 'PATCH', {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

/**
 * 前回の定期カスタム募集カードを締め切る（Discord上のボタンを無効化し、DBも closed にする）。
 *
 * ★ 2026-09-23: 対象の特定をDBからチャンネル走査へ切り替えた。`recruitments` は実測で
 *   全件0行であり、DBを頼りにすると「締め切り対象なし」で毎回素通りしてしまう。
 *   また旧実装は `status=open` を無条件に全件閉じていたため、メンバーが自分で立てた
 *   進行中のアドホック募集まで毎週水曜に「[受付終了]」にしていた。
 *   現在は「このチャンネルにある定期カスタムのカードのうち、今週分ではないもの」だけを閉じる。
 */
async function closePreviousPeriodicRecruitments(env, channelId, targets, messages) {
  try {
    const recent = messages || await fetchRecentBotMessages(env, channelId);
    const keepLabels = new Set(targets.map((t) => t.label));
    const dayNames = Object.values(DAY_DEFS).map((d) => d.name);

    const stale = recent.filter((m) => {
      const embed = m.embeds?.[0];
      if (!embed || isClosedCard(m)) return false;
      const title = embed.title || '';

      // 旧形式（1枚に土日同居）のカードは無条件に対象
      const dayFieldCount = (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length;
      if (dayFieldCount >= 2) return true;

      // 新形式のカードは、今週分の日付ラベルを持たないものだけ対象
      if (!dayNames.some((n) => title.includes(n))) return false;
      return ![...keepLabels].some((label) => title.includes(label));
    });

    if (stale.length === 0) {
      console.log('[WeeklyRecruit] 締め切るべき前回のカードはありません');
      return;
    }

    // サブリクエスト上限対策。1回で捌ききれない分は次回の実行に回す。
    for (const msg of stale.slice(0, MAX_CARDS_PER_RUN)) {
      try {
        // ★ 過去カードの物理削除: チャンネルに古い募集が残って今週分と混ざるのを完全に防止する
        await fetchWithRetry(`https://discord.com/api/v10/channels/${msg.channel_id || channelId}/messages/${msg.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
        }).catch((e) => console.warn(`[WeeklyRecruit] ${msg.id} のカード削除に失敗:`, e));

        // DB側も閉じる（行が無ければ何も起きない。ベストエフォート）
        await markRecruitmentStatus(env, msg.id, 'closed')
          .catch((e) => console.warn(`[WeeklyRecruit] ${msg.id} のDB締め切りに失敗:`, e));
      } catch (e) {
        console.warn('[WeeklyRecruit] 旧カードの削除処理でエラー:', e);
      }
    }
    console.log(`[WeeklyRecruit] 前回のカード${stale.length}件を削除しました（最新カードのみに維持）`);
  } catch (closeErr) {
    console.warn('[WeeklyRecruit] 前回の募集締め切り処理のエラー:', closeErr);
  }
}

/**
 * 1日分の募集カードを投稿し、recruitments へ登録する。投稿したら true。
 * @param {{seedLines?: string[], skipDuplicateCheck?: boolean}} [options]
 *   seedLines: 旧カードからの移行時に、既存の参加者行をそのまま引き継ぐ
 *   skipDuplicateCheck: 移行時のみ true（同じ start_at の旧レコードが残っているため）
 */
async function postDayRecruitmentCard(env, channelId, target, options = {}) {
  const { def, label, startAtIso, dayKey } = target;
  const seedLines = options.seedLines || [];

  // 二重投稿防止。DBは当てにできない（recruitments が実測で0行）ため、
  // チャンネルに同じ日のカードが既に出ていないかを正として判定する。
  if (!options.skipDuplicateCheck) {
    const messages = options.recentMessages || await fetchRecentBotMessages(env, channelId);
    if (findDayCard(messages, target)) {
      console.log(`[WeeklyRecruit] ${label}のカードは既にチャンネルに存在するためスキップ（二重発火防止）`);
      return false;
    }
  }

  const embed = buildDayRecruitEmbed(target, seedLines);
  const components = buildDayRecruitComponents(dayKey);
  const content = buildRecruitmentContent(target, CONFIG.NOTIFICATION_ROLE_ID);

  const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      embeds: [embed],
      components,
      allowed_mentions: { roles: [CONFIG.NOTIFICATION_ROLE_ID] }
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[WeeklyRecruit] ${label}の募集投稿に失敗: ${res.status} ${detail}`);
    // 無言で欠けると「片方の曜日だけカードが無い」状態に誰も気づけないため通知する。
    await notifyAdminError(env, `${def.name}(${label})の募集カード投稿に失敗しました`, {
      status: res.status,
      detail: detail.slice(0, 500),
      source: 'postDayRecruitmentCard',
    }).catch(() => {});
    return false;
  }
  const sent = await res.json();

  // DB登録はベストエフォート。ここが失敗しても、もう一方の曜日のカード投稿まで
  // 巻き添えで止まらないように必ず捕まえる（2026-09-23、書き込みが通っていないことが実測で判明）。
  await createRecruitment(env, {
    messageId: sent.id,
    channelId,
    ownerDiscordId: CONFIG.ADMIN_ID,
    mode: '定期カスタム',
    maxCount: DAY_CAPACITY,
    startAt: startAtIso,
  }).catch((e) => console.error(`[WeeklyRecruit] ${label} のrecruitments登録に失敗（カード投稿は成功）:`, e));
  console.log(`[WeeklyRecruit] ${def.name} ${label} の募集を投稿しました (msg ${sent.id})`);

  try {
    await fetchPortalAPI(env, '/api/push/notify-recruit', {
      mode: '定期カスタム',
      time: `${label} 21:00`,
    }).catch(() => {});
  } catch (e) {}

  return true;
}

/**
 * 旧形式（1枚のカードに土日が同居）の募集カードを、土日2枚の新形式へ移行する一度きりの処理。
 * 既存の参加者をそのまま新カードへ引き継ぎ、旧カードは受付終了にしてボタンを無効化する。
 * /trigger-scheduled?key=...&mode=weekly_recruit_migrate から手動でキックする。
 *
 * ★ 2026-09-23: 対象の特定をDBからチャンネル走査へ切り替えた。初版は
 *   `recruitments` の open 行を起点にしていたが、同テーブルは実測で全件0行であり
 *   （Botからの書き込みが成立していない）、旧カードが目の前にあるのに
 *   「移行対象なし」で何もせず終了していた。募集カードの所在はDiscordを正とする。
 */
async function migrateLegacyPeriodicCards(env) {
  try {
    const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    const messages = await fetchRecentBotMessages(env, channelId);
    const legacyCards = findLegacyCards(messages);

    if (legacyCards.length === 0) {
      console.log('[Migrate] 移行対象の旧形式カードはありませんでした');
      return;
    }

    // ★ 引き継ぎ元は「最新の旧カード1枚」だけにする。
    //   走査範囲(直近100件)には先週以前のカードも含まれており、全部から参加者を
    //   集めると別の週のエントリーまで合算されてしまう（実際に土曜が16名になった）。
    //   締め切り対象は最新以外にも広げるが、Cloudflare Workersの
    //   サブリクエスト上限(無料プランで50)に当たると以降のfetchが全て失敗するため、
    //   1回あたりの処理件数に上限を設ける（日曜カードの投稿が飛んだ原因）。
    const seeds = { sat: [], sun: [] };
    const primary = legacyCards[0];

    for (const f of primary.embeds?.[0]?.fields || []) {
      const key = detectDayKey(f.name);
      if (key) seeds[key].push(...extractEntryLines(f.value));
    }
    console.log(`[Migrate] 引き継ぎ元: ${primary.id}（土${seeds.sat.length}名 / 日${seeds.sun.length}名）`);

    for (const msg of legacyCards.slice(0, MAX_CARDS_PER_RUN)) {
      try {
        // 旧カードを受付終了にする
        const closedEmbed = { ...msg.embeds[0] };
        closedEmbed.title = markTitleClosed(closedEmbed.title);
        closedEmbed.description = '⚠️ このカードは土曜／日曜それぞれの新しい募集カードへ移行しました。参加は新しいカードからお願いします。';
        closedEmbed.color = 0x7f8c8d;
        const disabled = (msg.components || []).map((r) => ({
          ...r, components: r.components.map((b) => ({ ...b, disabled: true }))
        }));

        await fetchWithRetry(`https://discord.com/api/v10/channels/${msg.channel_id || channelId}/messages/${msg.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [closedEmbed], components: disabled })
        }).catch((e) => console.warn(`[Migrate] ${msg.id} の受付終了表示に失敗:`, e));

        await markRecruitmentStatus(env, msg.id, 'closed')
          .catch((e) => console.warn(`[Migrate] ${msg.id} のDB締め切りに失敗（行が無い可能性）:`, e));

        console.log(`[Migrate] 旧カード ${msg.id} を受付終了にしました`);
      } catch (e) {
        console.warn(`[Migrate] ${msg.id} の処理に失敗:`, e);
      }
    }

    // 同一ユーザーが複数行に載っている場合は先勝ちで1行に寄せる
    const dedupe = (lines) => {
      const seen = new Set();
      const out = [];
      for (const line of lines) {
        const id = line.match(/<@(\d+)>/)?.[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(line);
      }
      return out;
    };

    for (const target of resolveWeekendTargets()) {
      const seedLines = dedupe(seeds[target.dayKey] || []);
      console.log(`[Migrate] ${target.label} の新カードを投稿します（引き継ぎ${seedLines.length}名）`);
      await postDayRecruitmentCard(env, channelId, target, {
        seedLines,
        skipDuplicateCheck: true,
      });
    }
    console.log('[Migrate] 新形式カードへの移行が完了しました');
  } catch (err) {
    console.error('[Migrate] error:', err);
  }
}

/**
 * 今週の定期カスタムのカードを作り直す（手動キック専用: mode=weekly_recruit_reset）。
 *
 * 移行が途中で失敗してカードが中途半端な状態になったときの立て直し用。
 * ① 直近の旧形式カード（受付終了済みでも可）から参加者を引き継ぎ元として拾う
 * ② チャンネルに出ている定期カスタムのカードをすべて受付終了にする
 * ③ 土曜・日曜のカードを新しく投稿し直す
 *
 * ★ 2026-09-23: 初回の移行で「先週以前のカードまで参加者を合算して土曜が16名になり、
 *   さらにサブリクエスト上限に当たって日曜カードが投稿されなかった」状態の復旧用に追加した。
 */
async function resetPeriodicCards(env) {
  try {
    const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    const messages = await fetchRecentBotMessages(env, channelId);

    // ① 引き継ぎ元（受付終了済みも対象に含める。移行済みなら既に閉じているため）
    const seeds = { sat: [], sun: [] };
    const legacy = messages.find((m) => {
      const embed = m.embeds?.[0];
      if (!embed) return false;
      return (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length >= 2;
    });
    if (legacy) {
      for (const f of legacy.embeds[0].fields || []) {
        const key = detectDayKey(f.name);
        if (key) seeds[key].push(...extractEntryLines(f.value));
      }
      console.log(`[Reset] 引き継ぎ元: ${legacy.id}（土${seeds.sat.length}名 / 日${seeds.sun.length}名）`);
    } else {
      console.log('[Reset] 引き継ぎ元の旧形式カードは見つかりませんでした（空のカードを作り直します）');
    }

    // ② 出ている定期カスタムのカードをすべて閉じる
    const dayNames = Object.values(DAY_DEFS).map((d) => d.name);
    const openCards = messages.filter((m) => {
      const embed = m.embeds?.[0];
      if (!embed || isClosedCard(m)) return false;
      const title = embed.title || '';
      const dayFieldCount = (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length;
      return dayFieldCount >= 2 || dayNames.some((n) => title.includes(n));
    });

    for (const msg of openCards.slice(0, MAX_CARDS_PER_RUN)) {
      try {
        const closedEmbed = { ...msg.embeds[0] };
        closedEmbed.title = markTitleClosed(closedEmbed.title);
        closedEmbed.color = 0x7f8c8d;
        const disabled = (msg.components || []).map((r) => ({
          ...r, components: r.components.map((b) => ({ ...b, disabled: true }))
        }));
        await fetchWithRetry(`https://discord.com/api/v10/channels/${msg.channel_id || channelId}/messages/${msg.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [closedEmbed], components: disabled })
        }).catch((e) => console.warn(`[Reset] ${msg.id} の受付終了表示に失敗:`, e));
        console.log(`[Reset] ${msg.id} を受付終了にしました`);
      } catch (e) {
        console.warn(`[Reset] ${msg.id} の処理に失敗:`, e);
      }
    }

    // ③ 作り直す
    const dedupe = (lines) => {
      const seen = new Set();
      const out = [];
      for (const line of lines) {
        const id = line.match(/<@(\d+)>/)?.[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(line);
      }
      return out;
    };

    for (const target of resolveWeekendTargets()) {
      const seedLines = dedupe(seeds[target.dayKey] || []);
      console.log(`[Reset] ${target.label} のカードを投稿します（引き継ぎ${seedLines.length}名）`);
      await postDayRecruitmentCard(env, channelId, target, { seedLines, skipDuplicateCheck: true });
    }
    console.log('[Reset] 作り直しが完了しました');
  } catch (err) {
    console.error('[Reset] error:', err);
  }
}

/** 毎週土曜日 21:00 のイベントを2つ自動作成する */
async function createWeeklyEvents(env) {
  console.log("Starting weekly event creation...");
  try {
    const channelId = CONFIG.MATCH_CHANNEL_ID || "1487077567939743995";
    
    // 1. チャンネル情報から Guild ID を動的に取得
    console.log(`Fetching channel info for channel: ${channelId}`);
    const channelRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`
      }
    });

    if (!channelRes.ok) {
      throw new Error(`Failed to fetch channel info: ${channelRes.status} ${await channelRes.text()}`);
    }

    const channelInfo = await channelRes.json();
    const guildId = channelInfo.guild_id;
    if (!guildId) {
      throw new Error("Guild ID not found in channel response.");
    }
    console.log(`Resolved Guild ID: ${guildId}`);

    // 2. 次の土曜日 21:00 JST (12:00 UTC) の日付を算出
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0:日, 1:月, ..., 6:土
    
    // 今日が土曜日の場合は「来週の土曜日 (7日後)」にする
    let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    if (daysUntilSaturday === 0) {
      daysUntilSaturday = 7;
    }

    const scheduledStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilSaturday,
      12, 0, 0, 0 // JST 21:00 = UTC 12:00
    ));
    const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1000); // 2時間後 (JST 23:00 / UTC 14:00)

    const startTimeISO = scheduledStart.toISOString();
    const endTimeISO = scheduledEnd.toISOString();

    console.log(`Target Event Start Time (UTC): ${startTimeISO}`);
    console.log(`Target Event End Time (UTC): ${endTimeISO}`);

    // 既存の Scheduled Events 一覧を取得 (重複チェック用)
    console.log("Fetching existing scheduled events...");
    const existingRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`
      }
    });

    if (!existingRes.ok) {
      throw new Error(`Failed to fetch existing events: ${existingRes.status} ${await existingRes.text()}`);
    }

    const existingEvents = await existingRes.json();

    // 3. 2つのイベントを作成
    const eventTemplates = [
      {
        name: "【定期】シルバー以下カスタム",
        description: "毎週定期開催のシルバー以下対象カスタム戦です。参加希望の方は「興味あり」を押してください！",
      },
      {
        name: "【定期】ゴルプラ以下カスタム",
        description: "毎週定期開催のゴルプラ以下対象カスタム戦です。参加希望の方は「興味あり」を押してください！",
      }
    ];
  } catch (err) {
    console.error("Error in createWeeklyEvents:", err);
  }
}

/**
 * その日の募集カードと現在の参加人数を取得する。
 *
 * ★ 2026-09-23: 探索の主経路をチャンネル走査にした。以前は `recruitments` の
 *   start_at で引いていたが、同テーブルは実測で全件0行であり（Botからの書き込みが
 *   成立していない）、中間アナウンスも20:00開催判定も常に「カードが見つかりません」で
 *   空振りする。DBが直った場合に備えて、走査で見つからなかったときだけDBを試す。
 */
async function loadDayRecruitmentSummary(env, target, messages) {
  const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;

  // 1. Discordのチャンネルから直接探す（こちらが正）
  try {
    const recent = messages || await fetchRecentBotMessages(env, channelId);
    const card = findDayCard(recent, target);
    if (card) {
      const lines = extractEntryLines(card.embeds?.[0]?.fields?.[0]?.value);
      return {
        target,
        messageId: card.id,
        channelId: card.channel_id || channelId,
        message: card,
        lines,
        status: computeDayStatus(lines),
      };
    }
  } catch (e) {
    console.warn(`[Recruit] ${target.label}のチャンネル走査に失敗:`, e);
  }

  // 2. 走査で見つからない場合のみDBを当たる（カードが100件より前へ流れた場合の保険）
  try {
    const rows = await fetchSupabase(
      env, 'recruitments',
      `mode=eq.${encodeURIComponent('定期カスタム')}&start_at=eq.${encodeURIComponent(target.startAtIso)}` +
      `&select=id,discord_message_id,discord_channel_id,status&order=created_at.desc&limit=1`
    );
    if (!rows || rows.length === 0) {
      console.log(`[Recruit] ${target.label}の募集カードが見つかりません（チャンネル・DBとも）`);
      return null;
    }

    const row = rows[0];
    const msgRes = await fetchWithRetry(
      `https://discord.com/api/v10/channels/${row.discord_channel_id}/messages/${row.discord_message_id}`,
      { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
    );
    if (!msgRes.ok) {
      console.warn(`[Recruit] ${target.label}の募集カード(${row.discord_message_id})を取得できませんでした: ${msgRes.status}`);
      return null;
    }

    const message = await msgRes.json();
    const lines = extractEntryLines(message.embeds?.[0]?.fields?.[0]?.value);

    return {
      target,
      recruitId: row.id,
      messageId: row.discord_message_id,
      channelId: row.discord_channel_id,
      message,
      lines,
      status: computeDayStatus(lines, DAY_CAPACITY, target.dayKey),
    };
  } catch (e) {
    console.warn(`[Recruit] ${target.label}の募集カード取得に失敗:`, e);
    return null;
  }
}

/** チャンネルIDから Guild ID を解決する（メッセージリンクの組み立て用） */
async function resolveGuildId(env, channelId) {
  try {
    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
    });
    if (!res.ok) return null;
    return (await res.json()).guild_id || null;
  } catch (e) {
    return null;
  }
}

/**
 * 金曜19:00 / 土曜17:00 / 日曜17:00 の中間アナウンス（残り枠リマインド）。
 *
 * ★ 2026-09-23に全面的に作り直した。以前はこの通知が募集カードの参加者一覧・
 *   経験層分析まで丸ごと複製したEmbedを毎回投稿しており、同じ情報が週3回
 *   チャンネルへ積み上がっていた。さらに通知側にも参加ボタンが付いていたため、
 *   「押されたメッセージ」と「本来のカード」の間で fields を丸ごとコピーし合う
 *   同期処理が必要になり、カードを2枚に分けると土曜の内容が日曜カードを
 *   上書きする事故の温床になる。
 *   現在は「各日の残り枠 ＋ 募集カードへのリンク」だけを伝える1通に絞り、
 *   参加はカード側のボタンに一本化している。
 */
async function sendEventUsersNotification(env, options = {}) {
  console.log('[EventNotify] Starting weekend recruitment reminder...');
  try {
    const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.MATCH_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    if (!channelId) {
      console.error('[EventNotify] 通知先チャンネルIDが解決できませんでした');
      return;
    }

    // 当日に応じて対象日を絞る。土曜17:00の通知に日曜の話まで並べても情報量が増えるだけなので、
    // 金曜は土日の両方、土曜は土曜のみ、日曜は日曜のみを扱う。
    const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const jstDay = jstNow.getUTCDay(); // 0(日)〜6(土)
    let targets = resolveWeekendTargets();
    if (jstDay === 6) targets = targets.filter((t) => t.dayKey === 'sat');
    else if (jstDay === 0) targets = targets.filter((t) => t.dayKey === 'sun');

    // ★ 2026-09-23追加: 手遅れ実行のガード。バックアップ経路(GitHub Actions)は実測で
    // 1〜5時間遅れて発火するため、土日の21:00開始を過ぎてから「あと○名！」を
    // 投げてしまう事態を防ぐ。
    if ((jstDay === 6 || jstDay === 0) && jstNow.getUTCHours() >= 21) {
      console.log('[EventNotify] 開催時刻(21:00 JST)を過ぎているためスキップ');
      return;
    }

    const recentMessages = await fetchRecentBotMessages(env, channelId);
    const summaries = [];
    for (const target of targets) {
      const summary = await loadDayRecruitmentSummary(env, target, recentMessages);
      if (summary) summaries.push(summary);
    }
    if (summaries.length === 0) {
      console.log('[EventNotify] 対象の定期カスタム募集カードが見つからないためスキップ');
      return;
    }

    const allReady = summaries.every((s) => s.status.isReady);
    if (allReady) {
      console.log('[EventNotify] 対象日（' + summaries.map((s) => s.target.label).join(', ') + '）はすべて定員到達（開催確定）しているためリマインド送信をスキップします');
      // 満員になった場合も、以前の「残り枠リマインド」が残っていれば掃除する
      for (const m of recentMessages) {
        if (m.embeds?.[0]?.title?.includes('週末カスタム 残り枠のお知らせ')) {
          await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${m.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
          }).catch(() => {});
        }
      }
      return;
    }

    const guildId = await resolveGuildId(env, channelId);

    const dayLines = summaries.map((s) => {
      const def = getDayDef(s.target.dayKey);
      let state;
      if (s.status.breakdown?.hasBreakdown) {
        const b = s.status.breakdown;
        const m1 = b.isMatch1Ready ? '第1戦: 確定' : `第1戦: あと${b.match1Remaining}名`;
        const m2 = b.isMatch2Ready ? '第2戦: 確定' : `第2戦: あと${b.match2Remaining}名`;
        state = `**${m1} / ${m2}**`;
      } else {
        state = s.status.isReady ? '**✅ 開催確定！**' : `**あと${s.status.remaining}名**`;
      }

      let rankInfo = '';
      if (s.target.dayKey === 'sat') {
        const dom = s.status.dominantTierInfo;
        if (dom?.text) {
          rankInfo = `（基準: **${dom.text}** / 対象: **${dom.rangeText}**）`;
        }
        if (s.status.breakdown?.spectatorTotal > 0) {
          rankInfo += `（※観戦枠: ${s.status.breakdown.spectatorTotal}名）`;
        }
      } else {
        rankInfo = '（ランク不問・お祭りルール🎪）';
      }

      const link = guildId
        ? ` → [募集カードを開く](https://discord.com/channels/${guildId}/${s.channelId}/${s.messageId})`
        : '';
      return `${def.emoji} **${def.name}**　${s.target.label} 21:00\n　出場対象: **${s.status.joined}/10名** ${rankInfo} → ${state}${link}`;
    });

    const embed = {
      title: '📣 週末カスタム 残り枠のお知らせ',
      description: [
        dayLines.join('\n\n'),
        '',
        '💡 土曜は**ランク差を作らない1ティア差選出**（20名で2部屋同時開催✨）。',
        '💡 日曜は**ランク不問・レート変動なし**で誰でも気楽に参加できます。',
        '💡 21:00の第1試合だけ参加する「1戦のみ」や途中参加も大歓迎！各募集カードからどうぞ。',
      ].join('\n'),
      color: RECRUITMENT_COLORS.recruiting,
      footer: { text: 'KTM Bot | 週末カスタム リマインド' },
      timestamp: new Date().toISOString(),
    };

    // 二重投稿防止: 直近1時間以内に同一タイトルのBot投稿があればスキップ
    try {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (recentMessages.find((m) => m.embeds?.[0]?.title === embed.title && new Date(m.timestamp).getTime() > oneHourAgo)) {
        console.log('[EventNotify] 同一タイトルの通知が直近1時間以内にあるためスキップ（二重発火防止）');
        return;
      }
    } catch (dupErr) {
      console.warn('[EventNotify] 二重投稿チェックに失敗（送信は続行）:', dupErr);
    }

    // チャンネルの自浄: 古いリマインド通知（📣 週末カスタム 残り枠のお知らせ）があれば事前に削除して最新1通に保つ
    for (const m of recentMessages) {
      if (m.embeds?.[0]?.title?.includes('週末カスタム 残り枠のお知らせ')) {
        await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${m.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
        }).catch((e) => console.warn('[EventNotify] 過去リマインド削除に失敗:', e));
      }
    }

    const messageBody = { embeds: [embed] };

    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    if (roleId) {
      const shortText = summaries
        .filter((s) => !s.status.isReady)
        .map((s) => {
          const def = getDayDef(s.target.dayKey);
          let targetNote = '';
          if (s.target.dayKey === 'sat' && s.status.dominantTierInfo?.rangeText) {
            targetNote = ` [${s.status.dominantTierInfo.rangeText}歓迎]`;
          }
          if (s.status.breakdown?.hasBreakdown) {
            const b = s.status.breakdown;
            const parts = [];
            if (!b.isMatch1Ready) parts.push(`第1戦あと${b.match1Remaining}名`);
            if (!b.isMatch2Ready) parts.push(`第2戦あと${b.match2Remaining}名`);
            return `${def.label}${targetNote} ${parts.join('・')}`;
          }
          return `${def.label}${targetNote} あと${s.status.remaining}名`;
        })
        .join(' / ');
      messageBody.content = `<@&${roleId}> 📢 **【${shortText}】** 参加できる方はエントリーをお願いします！`;
      messageBody.allowed_mentions = { roles: [roleId] };
    }

    const sendRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messageBody)
    });

    if (!sendRes.ok) {
      console.error(`[EventNotify] 送信に失敗: ${sendRes.status} ${await sendRes.text()}`);
    } else {
      console.log(`[EventNotify] 残り枠リマインドを送信しました (対象${summaries.length}日分)`);
    }
  } catch (err) {
    console.error("Error in sendEventUsersNotification:", err);
  }
}


/**
 * 当日 20:00 (JST) の開催可否判定 ＆ 中止時の自動代替募集トリガー。
 * 土曜は「土曜・本戦カスタム」、日曜は「日曜・お祭りカスタム」のカードだけを見る。
 *
 * ★ 2026-09-23: カードを2枚に分離したのに伴い、対象カードの特定方法を変更した。
 *   以前は「このチャンネルで最新の open な定期カスタム1件」を取ってきて、その中の
 *   土曜フィールド/日曜フィールドを読み分けていた。カードが2枚になるとこの
 *   「最新1件」は常に日曜カード（後に投稿した方）を指してしまい、土曜の判定が
 *   日曜の人数で行われる。start_at で当日のカードを直接引くよう改めた。
 */
export async function checkCustomStatusAt2000(env) {
  try {
    // ★ 2026-09-21修正: ここだけが他の全関数と違い、CONFIGのフォールバックを持たない
    // env.DISCORD_KTM_CHANNEL_ID を素で参照していた。この変数はconfig.jsにもwrangler.tomlにも
    // 定義が無く(コードベース全体でこの1箇所しか参照が無い)、未設定なら即returnするため、
    // cronが正しく発火しても20:00判定が無言で何もしない状態だった(「孤立した自動化」パターン)。
    const channelId = env.DISCORD_KTM_CHANNEL_ID || CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    if (!channelId) {
      console.error('[Check2000] 判定対象のチャンネルIDが解決できませんでした');
      return;
    }

    // 現在のJST曜日を取得 (0=日, 6=土)
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayOfWeek = nowJst.getUTCDay();
    const dayKey = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : null;
    if (!dayKey) {
      console.log('[Check2000] 土日ではないためスキップ');
      return;
    }

    // ★ 2026-09-23追加: 手遅れ実行のガード。
    // GitHub Actionsのバックアップは実測で1〜5時間遅れて発火する（2026-09-23調査）。
    // 21:00開始の可否判定を22時や23時に投稿しても意味が無いどころか、
    // 「本日20:00 判定結果: 中止」が試合後に流れる混乱の元になる。
    const jstMinutes = nowJst.getUTCHours() * 60 + nowJst.getUTCMinutes();
    if (jstMinutes < 19 * 60 + 50 || jstMinutes > 21 * 60) {
      console.log(`[Check2000] 20:00判定の有効時間帯(19:50〜21:00 JST)を外れているためスキップ (現在 ${nowJst.getUTCHours()}:${String(nowJst.getUTCMinutes()).padStart(2, '0')} JST)`);
      return;
    }

    const def = getDayDef(dayKey);

    // 二重投稿防止(2026-09-21追加): Cloudflareネイティブcron(20:00 JST)と
    // GitHub Actionsバックアップを両方発火させているため、ガードが無いと
    // 判定メッセージが2回投稿される。直近30分以内に同種の投稿が無いか確認する。
    try {
      const recentRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
        const isDuplicate = recent.some((m) =>
          m.author?.bot &&
          new Date(m.timestamp).getTime() > thirtyMinAgo &&
          (m.content?.includes('本日20:00 判定') || m.content?.includes('助っ人をピンポイント募集中'))
        );
        if (isDuplicate) {
          console.log('[Check2000] 直近30分以内に同種の判定メッセージがあるためスキップ（二重発火防止）');
          return;
        }
      }
    } catch (dupErr) {
      console.warn('[Check2000] 二重投稿チェックに失敗（判定は続行）:', dupErr);
    }

    // 本日開催分のカードを start_at で直接引く
    const target = resolveWeekendTargets().find((t) => t.dayKey === dayKey);
    if (!target) {
      console.log('[Check2000] 本日の開催対象が解決できませんでした');
      return;
    }
    const summary = await loadDayRecruitmentSummary(env, target);
    if (!summary) {
      console.log(`[Check2000] ${def.name}(${target.label})の募集カードが見つかりません`);
      return;
    }

    // 1戦目から稼働できる人数（フル + 1戦のみ）と、途中参加の人数（土曜は1ティア差の出場対象枠のみをカウント）
    const breakdown = summary.status?.breakdown;
    const firstMatchCount = breakdown ? breakdown.match1Count : summary.lines.filter((l) => !l.includes('🌙途中参加')).length;
    const lateCount = breakdown ? (breakdown.match2LateLines?.length ?? 0) : summary.lines.filter((l) => l.includes('🌙途中参加')).length;
    const shortfall = Math.max(0, DAY_CAPACITY - firstMatchCount);
    const dominant = summary.status?.dominantTierInfo;

    console.log(`[Check2000] ${def.name}: 第1試合稼働${firstMatchCount}名 / 途中参加${lateCount}名 (基準: ${dominant?.text || 'なし'})`);

    // A. 開催確定（募集カードへの返信として投稿）
    if (firstMatchCount >= DAY_CAPACITY) {
      const confirmChannelId = summary.channelId || channelId;
      await fetchWithRetry(`https://discord.com/api/v10/channels/${confirmChannelId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🎉 **【本日20:00 判定: 開催確定！】**\n${def.emoji} **${def.name}** は第1戦メンバーが${firstMatchCount}名集まりました！21:00より開始します。ポータルのバランサーでチーム分けを行います。`,
          ...(summary.messageId ? { message_reference: { message_id: summary.messageId, fail_if_not_exists: false } } : {})
        })
      });
      console.log('[Check2000] 開催確定通知を募集カードへの返信として投稿しました');
      return;
    }

    // B. あと1〜2名 かつ 途中参加者がいる場合は、1戦だけの助っ人をピンポイント募集（募集カードへの返信）
    if (firstMatchCount >= 8 && lateCount >= 1) {
      const helpComponents = [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: `⏱️ 【助っ人急募】1戦だけ参加する！ (あと${shortfall}名)`,
              style: 1,
              custom_id: `${def.joinPrefix}:single`
            }
          ]
        }
      ];

      let rankHint = '';
      if (dayKey === 'sat' && dominant?.rangeText) {
        rankHint = `（※ランク差を作らないため、**${dominant.rangeText}** の方を大募集中です！）\n`;
      }

      const content = `🚨 <@&${CONFIG.NOTIFICATION_ROLE_ID}> **【21:00開始の第1試合 助っ人をピンポイント募集中！】**\n\n` +
        `・**${def.shortName}**: 第1試合（21:00〜）があと **${shortfall}名** 不足！（2戦目からは途中参加の方が ${lateCount}名 合流予定✨）\n` +
        rankHint + '\n' +
        `💡 **「21:00から1試合だけならできる！」という方はいませんか？**\n` +
        `下のボタンから1戦だけ助っ人エントリーをお願いします！`;

      const helpChannelId = summary.channelId || channelId;
      await fetchWithRetry(`https://discord.com/api/v10/channels/${helpChannelId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          components: helpComponents,
          allowed_mentions: { roles: [CONFIG.NOTIFICATION_ROLE_ID] },
          ...(summary.messageId ? { message_reference: { message_id: summary.messageId, fail_if_not_exists: false } } : {})
        })
      });
      console.log('[Check2000] ピンポイント助っ人募集メッセージを募集カードへの返信として投稿しました');
      return;
    }

    // C. 中止 ＆ 代替募集
    const substituteComponents = [
      {
        type: 1,
        components: [
          { type: 2, label: "🎮 ノーマル行く人！ (1/5)", style: 1, custom_id: "quick_substitute_normal" },
          { type: 2, label: "🔥 ARAM / メイヘムやる人！ (1/5)", style: 3, custom_id: "quick_substitute_aram" }
        ]
      }
    ];

    const cancelContent = `⚠️ **【本日20:00 判定結果: ${def.name}】**\n\n` +
      `誠に残念ながら、20:00時点で第1戦が ${firstMatchCount}/${DAY_CAPACITY}名 と定員に達しなかったため、**定期カスタムとしては中止**となります。\n` +
      `\n💡 **せっかく集まったので別のゲームで遊びませんか？**\n` +
      `下のボタンからワンクリックで「ノーマル」または「ARAM / メイヘム」のクイック募集に合流できます！`;

    // 中止はエントリー済みの当事者に最も届くべき通知なので、募集カードへの返信としてぶら下げ、
    // メンションはその人たちだけに限定する(@募集通知ロール全体には鳴らさない)。
    // 以前は独立メッセージかつメンション無しで、エントリー済みの人が中止に気づけなかった。
    const entryIds = [...new Set(
      summary.lines.flatMap((l) => [...l.matchAll(/<@!?(\d+)>/g)].map((m) => m[1]))
    )].slice(0, 100);
    const cancelMentions = entryIds.length > 0
      ? `\n\n通知: ${entryIds.map((id) => `<@${id}>`).join(' ')}`
      : '';

    // 返信は同一チャンネル内でしか成立しないため、投稿先は募集カードのチャンネルに合わせる
    const cancelChannelId = summary.channelId || channelId;
    await fetchWithRetry(`https://discord.com/api/v10/channels/${cancelChannelId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: cancelContent + cancelMentions,
        components: substituteComponents,
        allowed_mentions: { users: entryIds },
        ...(summary.messageId ? { message_reference: { message_id: summary.messageId, fail_if_not_exists: false } } : {})
      })
    });
    console.log(`[Check2000] 中止告知＆代替募集ボタンを投稿しました: ${def.name}（通知対象 ${entryIds.length}名）`);

  } catch (err) {
    console.error('[Check2000] error:', err);
  }
}
