import { CONFIG } from '../config.js';
import { fetchSupabase } from '../utils/supabase.js';
import { parseMessageData } from '../utils/helpers.js';
import { fetchWithRetry, fetchPortalAPI } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { createRecruitment } from '../utils/recruitPermission.js';
import { getKtmRank, formatRankDistribution, formatMmrWithRank, getHighestLaneMmr } from '../utils/ktmRank.js';
import { computeRecruitmentStatus, RECRUITMENT_COLORS } from '../utils/recruitmentStatus.js';

export async function handleScheduledEvent(event, env, ctx) {
  console.log("Scheduled event triggered:", JSON.stringify(event));
  const cronExpression = (event.cron || "").trim();
  const mode = event.mode || "";

  // 1. 毎週月曜 12:00 JST (月曜 UTC 3:00 / Cloudflare dow=2): 週末定期カスタム募集（土日分）自動投稿
  if (cronExpression.includes("0 3 * * 2") || mode === "weekly_recruit") {
    console.log("[Scheduled] Executing weekly recruitment posting (Monday 12:00 JST)...");
    await postWeeklyRecruitment(env);
  } else if (cronExpression.includes("0 0 * * 2") || mode === "weekly_report") {
    // 毎週月曜 9:00 JST (UTC 0:00 月曜=Cloudflare基準dow=2): 個人週間レポート配信
    await sendWeeklyReports(env);
  } else if (cronExpression.includes("0 11 * * 7") || cronExpression.includes("0 11 * * 1") || mode === "check_2000") {
    // 毎週土日 20:00 JST (UTC 11:00 土曜=dow 7, 日曜=dow 1): 開催可否判定 ＆ 中止時クイック代替募集
    console.log("[Scheduled] Executing 20:00 Custom Check & Substitute Handler...");
    await checkCustomStatusAt2000(env);
  } else if (mode === "event_notify" || cronExpression.includes("0 3 * * 4") || cronExpression.includes("0 10 * * 6")) {
    // 毎週水曜 12:00 JST (UTC 3:00 水曜=dow 4) & 金曜 19:00 JST (UTC 10:00 金曜=dow 6):
    // 参加状況・同期アナウンス通知
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

      // 二重投稿防止
      const recentRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages?limit=10`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const threeHoursAgo = nowMs - 3 * 60 * 60 * 1000;
        if (recent.find((m) => m.author?.bot && m.embeds?.[0]?.title === title && new Date(m.timestamp).getTime() > threeHoursAgo)) {
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

      const body = { embeds: [embed] };
      // 人数不足のときだけ通知ロールをメンションして能動的に呼ぶ
      if (shortage > 0 && CONFIG.NOTIFICATION_ROLE_ID) {
        body.content = `<@&${CONFIG.NOTIFICATION_ROLE_ID}> 🔥 **あと${shortage}名でカスタム開催です！** 参加できる方は上の募集メッセージから参加ボタンを押してください！`;
        body.allowed_mentions = { roles: [CONFIG.NOTIFICATION_ROLE_ID] };
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
 * 毎週土曜 21:00 JST に、その日21:00開催の定期カスタム募集を専用チャンネルへ自動投稿する(#85)。
 * 参加予定を事前に表明できるようにする。recruitments.start_at で二重投稿を防止
 * （同じ開始時刻の募集が既にあればスキップ＝冗長キックにも安全）。
 */
async function postWeeklyRecruitment(env) {
  try {
    const targetChannelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID || "1528646515533287497";

    // 0. 二重投稿防止(2026-08-08発覚): この関数には重複チェックが一切無く、
    // Cloudflareネイティブcron(日曜0:00 JST)とGitHub Actionsバックアップ(土曜21:10 JST)が
    // 数時間差で両方発火すると、同じ週の定期カスタム募集が毎回2回投稿されていた。
    // 投稿対象の開催日時(startAtIso)を先に計算し、同じstart_atの募集が既にDBにあれば
    // (open/closed問わず)スキップする。
    const nowForCheck = new Date();
    const jstNowForCheck = new Date(nowForCheck.getTime() + 9 * 3600 * 1000);
    const currentDayForCheck = jstNowForCheck.getUTCDay();
    let diffToSaturdayForCheck = (6 - currentDayForCheck + 7) % 7;
    if (diffToSaturdayForCheck === 0 && jstNowForCheck.getUTCHours() >= 21) {
      diffToSaturdayForCheck = 7;
    }
    const targetDateForCheck = jstNowForCheck.getUTCDate() + diffToSaturdayForCheck;
    const startUtcMsForCheck = Date.UTC(jstNowForCheck.getUTCFullYear(), jstNowForCheck.getUTCMonth(), targetDateForCheck, 12, 0, 0, 0);
    const startAtIsoForCheck = new Date(startUtcMsForCheck).toISOString();
    try {
      const existing = await fetchSupabase(
        env, 'recruitments',
        `mode=eq.${encodeURIComponent('定期カスタム')}&start_at=eq.${encodeURIComponent(startAtIsoForCheck)}&select=id&limit=1`
      );
      if (existing && existing.length > 0) {
        console.log(`[WeeklyRecruit] 今週(${startAtIsoForCheck})の募集は投稿済みのためスキップ（二重発火防止）`);
        return;
      }
    } catch (dupErr) {
      console.warn('[WeeklyRecruit] 二重投稿チェックに失敗（投稿は続行）:', dupErr);
    }

    // 1. 前回のオープンな募集を DB および Discord 上で締め切る (status = 'closed')
    try {
      const activeRecruits = await fetchSupabase(env, 'recruitments', 'status=eq.open&select=*');
      if (activeRecruits && activeRecruits.length > 0) {
        for (const oldRecruit of activeRecruits) {
          // DB のステータスを closed に変更
          await updateRecruitment(env, oldRecruit.id, { status: 'closed' }).catch(() => {});

          // Discord 上の旧メッセージのボタンを無効化し、タイトルに [受付終了] を追加
          try {
            const oldMsgRes = await fetch(`https://discord.com/api/v10/channels/${oldRecruit.discord_channel_id}/messages/${oldRecruit.discord_message_id}`, {
              headers: { "Authorization": `Bot ${env.DISCORD_TOKEN}` }
            });
            if (oldMsgRes.ok) {
              const oldMsg = await oldMsgRes.json();
              if (oldMsg.embeds && oldMsg.embeds.length > 0) {
                const closedEmbed = { ...oldMsg.embeds[0] };
                closedEmbed.title = closedEmbed.title.replace("開催告知", "[受付終了]");
                closedEmbed.color = 0x7f8c8d; // グレーアウト

                const disabledComponents = oldMsg.components ? oldMsg.components.map(row => ({
                  ...row,
                  components: row.components.map(btn => ({ ...btn, disabled: true }))
                })) : [];

                await fetch(`https://discord.com/api/v10/channels/${oldRecruit.discord_channel_id}/messages/${oldRecruit.discord_message_id}`, {
                  method: 'PATCH',
                  headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ embeds: [closedEmbed], components: disabledComponents })
                }).catch(() => {});
              }
            }
          } catch (e) {}
        }
      }
    } catch (closeErr) {
      console.warn('[WeeklyRecruit] 前回の募集締め切り処理のエラー:', closeErr);
    }

    // 2. 毎週月曜 12:00 JST 投稿時 ➔ 直近の「土曜日 21:00 JST」および「日曜日 21:00 JST」を開催日時とする
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
    const currentDay = jstNow.getUTCDay(); // 0(日)〜6(土)
    
    // 今週の土曜日までの日数（月曜日の場合 5日後）
    let diffToSaturday = (6 - currentDay + 7) % 7;
    if (diffToSaturday === 0 && jstNow.getUTCHours() >= 21) {
      diffToSaturday = 7; // すでに土曜21時を過ぎている場合は来週
    }
    const diffToSunday = diffToSaturday + 1;

    const satDate = jstNow.getUTCDate() + diffToSaturday;
    const startSatUtcMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), satDate, 12, 0, 0, 0);
    const satAtIso = new Date(startSatUtcMs).toISOString();
    const satJst = new Date(startSatUtcMs + 9 * 3600 * 1000);
    const satLabel = `${satJst.getUTCMonth() + 1}/${satJst.getUTCDate()}(土)`;

    const sunDate = jstNow.getUTCDate() + diffToSunday;
    const startSunUtcMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), sunDate, 12, 0, 0, 0);
    const sunJst = new Date(startSunUtcMs + 9 * 3600 * 1000);
    const sunLabel = `${sunJst.getUTCMonth() + 1}/${sunJst.getUTCDate()}(日)`;

    const ownerId = CONFIG.ADMIN_ID;
    
    // 3部屋統合用メタデータ
    const metadata = {
      mode: '定期カスタム',
      time: `${satLabel} & ${sunLabel} 21:00`,
      maxCount: 30,
      memo: `【定期カスタム】${satLabel}・${sunLabel} 21:00 開催予定！下のボタンからご希望の部門に参加してください🎮`,
      owner: ownerId,
      createdAt: new Date().toISOString(),
      names: { [ownerId]: 'KTM定期カスタム' }
    };

    // 3部屋統合 Embed (プログレスバー付き初期状態)
    const initialStatusText = `🔥 **【週末定期カスタム募集中！合計 0/30名】**\n🛡️ **土曜・シルバー以下 (ブラインド/MMRあり)**: \`[□□□□□□□□□□] 0/10名\` (あと**10**名)\n👑 **土曜・ゴルプラ (ドラフト/MMRあり)**: \`[□□□□□□□□□□] 0/10名\` (あと**10**名)\n🎪 **日曜・お祭りカスタム (ランク不問/MMRなし)**: \`[□□□□□□□□□□] 0/10名\` (あと**10**名)\n※土曜は当日20:00時点で10名未満の部門は中止（ノーマル/メイヘム再募集）となります`;

    const embed = {
      title: `⚔️ KTM 週末定期カスタム開催告知 [${satLabel}・${sunLabel} 21:00〜]`,
      description: `${initialStatusText}\n\n毎週末恒例の定期カスタム戦です！\n下のボタンから参加したいカスタムにエントリーしてください（土曜は代表MMRから自動振り分け、日曜は誰でも参加OK！）。\n\n💡 **1戦だけのスポット参加・途中抜けも大歓迎！**\n💡 **希望レーンに変更がある方は、ポータルの「マイページ」より変更をお願いします！**`,
      color: 0xc89b3c, // 琥珀色
      fields: [
        {
          name: `🛡️ 【土曜・シルバー以下部門】 (0/10名) 🔲 ブラインド (MMRあり)`,
          value: `▫ 参加者: なし\n※対象: 初心者〜シルバーレベル（MMR変動あり / 気軽に参加OK！）`,
          inline: false
        },
        {
          name: `👑 【土曜・ゴルプラ部門】 (0/10名) ⚔️ ドラフト (MMRあり)`,
          value: `▫ 参加者: なし\n※対象: ゴールド〜プラチナレベル（MMR変動あり）`,
          inline: false
        },
        {
          name: `🎪 【日曜・お祭り部門】 (0/10名) 🎲 ランク不問 (MMRなし)`,
          value: `▫ 参加者: なし\n※対象: 全員OK！特殊ルール/ランダム/オフメタ等大歓迎（MMR変動なし）`,
          inline: false
        }
      ],
      footer: { text: `開催: 土曜21:00〜 ＆ 日曜21:00〜 | 主催: KTM運営 | 1戦のみ参加OK` },
      timestamp: new Date().toISOString()
    };

    // 参加ボタン（土曜: フル/1戦のみ/途中参加、日曜: フル/1戦のみ/途中参加）
    const components = [
      {
        type: 1, // Action Row 1: 土曜部門
        components: [
          {
            type: 2,
            label: "🎮 土曜フル参加 (自動振分)",
            style: 1, // Primary (Blue)
            custom_id: "join_periodic_auto:full"
          },
          {
            type: 2,
            label: "⏱️ 土曜 1戦のみ",
            style: 2, // Secondary (Gray)
            custom_id: "join_periodic_auto:single"
          },
          {
            type: 2,
            label: "🌙 土曜 途中参加(2戦目〜)",
            style: 2, // Secondary (Gray)
            custom_id: "join_periodic_auto:late"
          }
        ]
      },
      {
        type: 1, // Action Row 2: 日曜部門
        components: [
          {
            type: 2,
            label: "🎪 日曜フル参加",
            style: 3, // Success (Green)
            custom_id: "join_periodic_sunday:full"
          },
          {
            type: 2,
            label: "⏱️ 日曜 1戦のみ",
            style: 2, // Secondary (Gray)
            custom_id: "join_periodic_sunday:single"
          },
          {
            type: 2,
            label: "🌙 日曜 途中参加(2戦目〜)",
            style: 2, // Secondary (Gray)
            custom_id: "join_periodic_sunday:late"
          }
        ]
      }
    ];

    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `📢 **【週末定期カスタム募集】${satLabel}・${sunLabel} 21:00 開催！** <@&${CONFIG.NOTIFICATION_ROLE_ID}>`,
        embeds: [embed],
        components: components,
        allowed_mentions: { roles: [CONFIG.NOTIFICATION_ROLE_ID] }
      })
    });

    if (!res.ok) {
      console.error(`[WeeklyRecruit] 募集投稿に失敗: ${res.status} ${await res.text()}`);
      return;
    }
    const sent = await res.json();

    // recruitments DB に記録
    await createRecruitment(env, {
      messageId: sent.id,
      channelId: targetChannelId,
      ownerDiscordId: ownerId,
      mode: '定期カスタム',
      maxCount: 30,
      startAt: satAtIso,
    });
    console.log(`[WeeklyRecruit] 3部屋統合定期カスタム募集を投稿しました (msg ${sent.id})`);

    try {
      const { fetchPortalAPI } = await import('../utils/api.js');
      await fetchPortalAPI(env, '/api/push/notify-recruit', { mode: '定期カスタム', time: `${satLabel} 21:00` }).catch(() => {});
    } catch (e) {}
  } catch (err) {
    console.error('[WeeklyRecruit] error:', err);
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

/** イベントおよび定期募集の「参加者・興味あり」メンバーを同期抽出して送信する */
async function sendEventUsersNotification(env, options = {}) {
  const lookaheadHours = options.lookaheadHours || 48;
  const isAdvanceNotice = lookaheadHours > 48;
  console.log(`Starting event users extraction notification... (lookahead: ${lookaheadHours}h)`);
  try {
    const channelId = CONFIG.MATCH_CHANNEL_ID || CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || "1528646515533287497";
    
    // 1. チャンネル情報から Guild ID を動的に取得
    const channelRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
    });

    if (!channelRes.ok) throw new Error(`Failed to fetch channel info: ${channelRes.status}`);

    const channelInfo = await channelRes.json();
    const guildId = channelInfo.guild_id;
    if (!guildId) throw new Error("Guild ID not found in channel response.");

    // 2. DBおよびチャンネル直近メッセージからアクティブな最新の募集カードを取得して完全同期
    let activeEmbed = null;
    let targetMessageId = null;
    try {
      // チャンネルの直近メッセージから最新の募集カードを探す
      const channelMsgsRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=20`, {
        headers: { "Authorization": `Bot ${env.DISCORD_TOKEN}` }
      });
      if (channelMsgsRes.ok) {
        const channelMsgs = await channelMsgsRes.json();
        const recruitMsg = channelMsgs.find(m => m.author?.bot && m.embeds?.[0]?.title && m.embeds[0].title.includes("定期カスタム"));
        if (recruitMsg) {
          activeEmbed = recruitMsg.embeds[0];
          targetMessageId = recruitMsg.id;
        }
      }
    } catch (dbErr) {
      console.warn("Recruitment fetch warning:", dbErr);
    }
    let silverCount = 0;
    let goldCount = 0;
    let sundayCount = 0;

    if (activeEmbed && activeEmbed.fields) {
      activeEmbed.fields.forEach(f => {
        const matches = (f.value || "").match(/- <@\d+>/g) || [];
        if (f.name.includes("シルバー")) {
          silverCount = matches.length;
        } else if (f.name.includes("ゴルプラ")) {
          goldCount = matches.length;
        } else if (f.name.includes("お祭り") || f.name.includes("日曜")) {
          sundayCount = matches.length;
        }
      });
    }

    const recruitStatus = computeRecruitmentStatus(silverCount, goldCount, sundayCount);
    const silverShortfall = recruitStatus.silverRem;
    const goldShortfall = recruitStatus.goldRem;
    const sundayShortfall = recruitStatus.sundayRem;
    const totalJoined = recruitStatus.totalJoined;

    // 4. アナウンス Embed の作成（募集カードを完全同期 ＆ 参加者の希望レーンを自動付与）
    let syncFields = activeEmbed ? activeEmbed.fields : [];

    // 参加ユーザー全員の希望レーンを全件一括ルックアップして補完
    if (syncFields && syncFields.length > 0) {
      try {
        const allUserIds = new Set();
        syncFields.forEach(f => {
          const matches = (f.value || "").match(/<@(\d+)>/g);
          if (matches) {
            matches.forEach(m => allUserIds.add(m.replace(/<@|>/g, '')));
          }
        });

        if (allUserIds.size > 0) {
          const idsArr = Array.from(allUserIds);
          const ps = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsArr.join(',')})&select=discord_id,role_preferences`);
          const prefMap = new Map();
          if (ps && ps.length > 0) {
            ps.forEach(p => {
              if (p.role_preferences) {
                let pref = p.role_preferences;
                if (typeof pref === 'string') {
                  try { pref = JSON.parse(pref); } catch (e) {}
                }
                if (pref && (pref.primary || pref.secondary)) {
                  const p1 = pref.primary || "指定なし";
                  const p2 = pref.secondary || "指定なし";
                  prefMap.set(String(p.discord_id), `【第1: ${p1} / 第2: ${p2}】`);
                }
              }
            });
          }

          syncFields = syncFields.map(f => {
            let lines = (f.value || "").split('\n');
            let updatedLines = lines.map(line => {
              const uMatch = line.match(/<@(\d+)>/);
              if (uMatch) {
                const uId = uMatch[1];
                const prefStr = prefMap.get(uId);
                if (prefStr && !line.includes("【第1:")) {
                  const cleanLine = line.replace(/【希望: [^】]+】/g, '').replace(/\*\(希望: [^\)]+\)\*/g, '').trim();
                  return `${cleanLine} ${prefStr}`;
                } else if (!prefStr) {
                  return line.replace(/【希望: [^】]+】/g, '').replace(/\*\(希望: [^\)]+\)\*/g, '').trim();
                }
              }
              return line;
            });
            return { ...f, value: updatedLines.join('\n') };
          });
        }
      } catch (prefErr) {
        console.warn("Role pref sync warning:", prefErr);
      }
    }
    
    if (!syncFields || syncFields.length === 0) {
      syncFields = [
        { name: "🛡️ 【土曜・シルバー以下部門】 (0/10名)", value: "▫ 参加者: なし", inline: false },
        { name: "👑 【土曜・ゴルプラ部門】 (0/10名)", value: "▫ 参加者: なし", inline: false },
        { name: "🎪 【日曜・お祭り部門】 (0/10名)", value: "▫ 参加者: なし", inline: false }
      ];
    }

    const recruitLink = targetMessageId ? `\n\n👉 [元の募集メッセージを開く](https://discord.com/channels/${guildId}/${channelId}/${targetMessageId})` : '';
    const laneNote = `\n\n💡 **希望レーンに変更がある方は、ポータルの「マイページ」より事前に変更をお願いします！**`;

    const isAllReady = recruitStatus.isAllReady;
    let statusMessage = '';
    if (isAllReady) {
      statusMessage = `🎉 **週末の全3部門ともに開催確定！** 土曜（シルバー・ゴルプラ）＆ 日曜（お祭り）すべて10名達成しました！${laneNote}${recruitLink}`;
    } else {
      statusMessage = `⚠️ **週末定期カスタム募集中！** 現在 **土曜シルバー: ${silverCount}名 / 土曜ゴルプラ: ${goldCount}名 / 日曜お祭り: ${sundayCount}名** です。\n▫ 🛡️ 土曜・シルバー以下 (ブラインド/MMRあり): あと **${silverShortfall}名**\n▫ 👑 土曜・ゴルプラ (ドラフト/MMRあり): あと **${goldShortfall}名**\n▫ 🎪 日曜・お祭りカスタム (ランク不問/MMRなし): あと **${sundayShortfall}名**\n💡 **1戦だけのスポット参加も大歓迎！**\n下のボタンからエントリーしてください！${laneNote}${recruitLink}`;
    }
    const embedColor = recruitStatus.color;

    const embed = {
      title: activeEmbed ? activeEmbed.title : `📅 【週末定期】カスタム戦 参加メンバー状況 🔔`,
      description: statusMessage,
      color: embedColor,
      fields: syncFields,
      footer: { text: "KTM Bot | 週末募集同期アナウンス" },
      timestamp: new Date().toISOString()
    };

    // 二重投稿防止: 直近1時間以内に同一タイトルのBot投稿があればスキップ
    try {
      const recentRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const dupTitle = embed.title;
        if (recent.find((m) => m.author?.bot && m.embeds?.[0]?.title === dupTitle && new Date(m.timestamp).getTime() > oneHourAgo)) {
          console.log('[EventNotify] 同一タイトルの通知が直近1時間以内にあるためスキップ（二重発火防止）');
          return;
        }
      }
    } catch (dupErr) {
      console.warn('[EventNotify] 二重投稿チェックに失敗（送信は続行）:', dupErr);
    }

    // 5. メッセージ ＆ ワンタップ「参加する」ボタンの作成（2段構成）
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    const messageBody = {
      embeds: [embed],
      components: [
        {
          type: 1, // Action Row 1: 土曜
          components: [
            {
              type: 2,
              label: "🎮 土曜フル参加 (自動振分)",
              style: 1, // Primary (Blue)
              custom_id: "join_periodic_auto:full"
            },
            {
              type: 2,
              label: "⏱️ 土曜 1戦のみ",
              style: 2,
              custom_id: "join_periodic_auto:single"
            },
            {
              type: 2,
              label: "🌙 土曜 途中参加",
              style: 2,
              custom_id: "join_periodic_auto:late"
            }
          ]
        },
        {
          type: 1, // Action Row 2: 日曜
          components: [
            {
              type: 2,
              label: "🎪 日曜フル参加",
              style: 3, // Success (Green)
              custom_id: "join_periodic_sunday:full"
            },
            {
              type: 2,
              label: "⏱️ 日曜 1戦のみ",
              style: 2,
              custom_id: "join_periodic_sunday:single"
            },
            {
              type: 2,
              label: "🌙 日曜 途中参加",
              style: 2,
              custom_id: "join_periodic_sunday:late"
            }
          ]
        }
      ]
    };

    if (!isAllReady && roleId) {
      let shortText = [];
      if (silverShortfall > 0) shortText.push(`土曜シルバー あと${silverShortfall}名`);
      if (goldShortfall > 0) shortText.push(`土曜ゴルプラ あと${goldShortfall}名`);
      if (sundayShortfall > 0) shortText.push(`日曜お祭り あと${sundayShortfall}名`);

      let helperCall = "";
      if ((silverShortfall <= 2 && silverShortfall > 0) || (goldShortfall <= 2 && goldShortfall > 0) || (sundayShortfall <= 2 && sundayShortfall > 0)) {
        helperCall = "\n💡 **「21:00からの第1試合だけなら参加できる！」という1戦のみ助っ人も大歓迎です！**";
      }

      messageBody.content = `<@&${roleId}> 📢 **【${shortText.join(' / ')}】で週末カスタム開催です！** 参加できる方は下のボタンからエントリーをお願いします！${helperCall}`;
      messageBody.allowed_mentions = { roles: [roleId] };
    }

    const sendRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageBody)
    });

    if (!sendRes.ok) {
      console.error(`Failed to send message: ${sendRes.status} ${await sendRes.text()}`);
    } else {
      console.log(`Integrated notification with action buttons sent successfully.`);
    }

  } catch (err) {
    console.error("Error in sendEventUsersNotification:", err);
  }
}

/**
 * 当日 20:00 (JST) 開催可否判定 ＆ 中止時の自動代替募集トリガー
 * - 土曜日: シルバー以下 / ゴルプラ それぞれ10名以上集まっているか判定。
 * - 日曜日: お祭り部門が10名以上集まっているか判定。
 * - 10名未満の場合: 「中止」を自動告知し、その場で「🎮 ノーマル行く人！ / 🔥 ARAM・メイヘム行く人！」の代替募集ボタンを提示。
 */
export async function checkCustomStatusAt2000(env) {
  try {
    const channelId = env.DISCORD_KTM_CHANNEL_ID;
    if (!channelId) return;

    // 現在のJST曜日を取得 (0=日, 6=土)
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayOfWeek = nowJst.getUTCDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    if (!isSaturday && !isSunday) {
      console.log('[Check2000] 土日ではないためスキップ');
      return;
    }

    const targetDayName = isSaturday ? '土曜カスタム' : '日曜お祭りカスタム';

    // 最新の open な定期カスタム募集を取得
    const rows = await fetchSupabase(
      env,
      'recruitments',
      `mode=eq.${encodeURIComponent('定期カスタム')}&status=eq.open&discord_channel_id=eq.${channelId}&select=discord_message_id,id&order=created_at.desc&limit=1`
    );
    if (!rows || rows.length === 0) {
      console.log('[Check2000] 対象の定期カスタム募集が見つかりません');
      return;
    }

    const msgRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${rows[0].discord_message_id}`, {
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
    });
    if (!msgRes.ok) return;
    const msg = await msgRes.json();
    const embed = msg.embeds?.[0];
    if (!embed || !embed.fields) return;

    // 参加者集計
    const silverLines = (embed.fields[0]?.value || '').split('\n').filter(l => l.startsWith('- '));
    const goldLines = (embed.fields[1]?.value || '').split('\n').filter(l => l.startsWith('- '));
    const sundayLines = (embed.fields[2]?.value || '').split('\n').filter(l => l.startsWith('- '));

    // 1戦目稼働可能者（フル + 1戦のみ）の人数と途中参加者人数
    const countFirstMatch = (lines) => lines.filter(l => !l.includes('🌙途中参加')).length;
    const countLate = (lines) => lines.filter(l => l.includes('🌙途中参加')).length;

    const silverFirst = countFirstMatch(silverLines);
    const goldFirst = countFirstMatch(goldLines);
    const sundayFirst = countFirstMatch(sundayLines);

    const silverLate = countLate(silverLines);
    const goldLate = countLate(goldLines);
    const sundayLate = countLate(sundayLines);

    const silverReady = silverFirst >= 10;
    const goldReady = goldFirst >= 10;
    const sundayReady = sundayFirst >= 10;

    let cancelDepartments = [];
    let confirmedDepartments = [];
    let urgentHelpDepartments = []; // ピンポイント助っ人募集部門（あと1〜2名 & 途中参加あり）

    if (isSaturday) {
      if (silverReady) {
        confirmedDepartments.push(`🛡️ シルバー以下部門 (${silverFirst}名 開催！)`);
      } else if (silverFirst >= 8 && silverLate >= 1) {
        urgentHelpDepartments.push({ name: 'シルバー以下', shortfall: 10 - silverFirst, late: silverLate, customId: 'join_periodic_auto:single' });
      } else {
        cancelDepartments.push(`🛡️ シルバー以下部門 (${silverFirst}/10名)`);
      }

      if (goldReady) {
        confirmedDepartments.push(`👑 ゴルプラ部門 (${goldFirst}名 開催！)`);
      } else if (goldFirst >= 8 && goldLate >= 1) {
        urgentHelpDepartments.push({ name: 'ゴルプラ', shortfall: 10 - goldFirst, late: goldLate, customId: 'join_periodic_auto:single' });
      } else {
        cancelDepartments.push(`👑 ゴルプラ部門 (${goldFirst}/10名)`);
      }
    } else {
      if (sundayReady) {
        confirmedDepartments.push(`🎪 日曜お祭り部門 (${sundayFirst}名 開催！)`);
      } else if (sundayFirst >= 8 && sundayLate >= 1) {
        urgentHelpDepartments.push({ name: '日曜お祭り', shortfall: 10 - sundayFirst, late: sundayLate, customId: 'join_periodic_sunday:single' });
      } else {
        cancelDepartments.push(`🎪 日曜お祭り部門 (${sundayFirst}/10名)`);
      }
    }

    // A. ピンポイント助っ人募集がある場合（ラストチャンス告知）
    if (urgentHelpDepartments.length > 0) {
      const helpTexts = urgentHelpDepartments.map(d =>
        `・**${d.name}**: 第1試合（21:00〜）があと **${d.shortfall}名** 不足！（2戦目からは途中参加の方が ${d.late}名 合流予定✨）`
      ).join('\n');

      const helpComponents = [
        {
          type: 1,
          components: urgentHelpDepartments.map(d => ({
            type: 2,
            label: `⏱️ 【助っ人急募】${d.name}に1戦だけ参加する！ (あと${d.shortfall}名)`,
            style: 1, // Primary
            custom_id: d.customId
          }))
        }
      ];

      const content = `🚨 <@&${CONFIG.NOTIFICATION_ROLE_ID}> **【21:00開始の第1試合 助っ人をピンポイント募集中！】**\n\n` +
        `${helpTexts}\n\n` +
        `💡 **「21:00から1試合だけならできる！」という方はいませんか？**\n` +
        `下のボタンから1戦だけ助っ人エントリーをお願いします！あと1〜2名揃えばカスタム開催決定となります🎮`;

      await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          components: helpComponents,
          allowed_mentions: { roles: [CONFIG.NOTIFICATION_ROLE_ID] }
        })
      });
      console.log(`[Check2000] ピンポイント助っ人募集メッセージを投稿しました`);
      return;
    }

    // B. 中止部門がある場合、自動代替募集メッセージを投稿
    if (cancelDepartments.length > 0) {
      const cancelText = cancelDepartments.join('、');
      const substituteComponents = [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2,
              label: "🎮 ノーマル行く人！ (1/5)",
              style: 1, // Primary
              custom_id: "quick_substitute_normal"
            },
            {
              type: 2,
              label: "🔥 ARAM / メイヘムやる人！ (1/5)",
              style: 3, // Success
              custom_id: "quick_substitute_aram"
            }
          ]
        }
      ];

      const content = `⚠️ **【本日20:00 判定結果: ${targetDayName}】**\n\n` +
        `誠に残念ながら、${cancelText} は20:00時点で10名に達しなかったため、**定期カスタムとしては中止**となります。\n` +
        (confirmedDepartments.length > 0 ? `※${confirmedDepartments.join('、')} は21:00より予定通り開催いたします！\n` : '') +
        `\n💡 **せっかく集まったので別のゲームで遊びませんか？**\n` +
        `下のボタンからワンクリックで「ノーマル」または「ARAM / メイヘム」のクイック募集に合流できます！`;

      await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          components: substituteComponents
        })
      });
      console.log(`[Check2000] 中止告知＆代替募集ボタンを投稿しました: ${cancelText}`);
    } else {
      // 全て開催確定
      await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: `🎉 **【本日20:00 判定: 開催確定！】**\n${confirmedDepartments.join('、')} はすべて10名集まりました！21:00より開始いたします。ポータルのバランサーにてチーム分けを実施します。`
        })
      });
      console.log(`[Check2000] 全部門開催確定通知を投稿しました`);
    }

  } catch (err) {
    console.error('[Check2000] 20:00 判定処理でエラー:', err);
  }
}
