import { CONFIG } from '../config.js';
import { fetchSupabase } from '../utils/supabase.js';
import { parseMessageData } from '../utils/helpers.js';
import { fetchWithRetry, fetchPortalAPI } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { createRecruitment } from '../utils/recruitPermission.js';
import { getKtmRank, formatRankDistribution, formatMmrWithRank } from '../utils/ktmRank.js';

export async function handleScheduledEvent(event, env, ctx) {
  console.log("Scheduled event triggered:", JSON.stringify(event));
  const cronExpression = (event.cron || "").trim();
  const mode = event.mode || "";

  // 毎週日曜 0:00 JST (土曜 UTC 15:00): 最優先で判定
  // 2026-08-01: Cloudflareの曜日番号は1=日〜7=土(wrangler.tomlのコメント参照)。
  if (cronExpression.includes("0 15 * * 7") || mode === "weekly_recruit") {
    console.log("[Scheduled] Executing weekly recruitment posting...");
    await postWeeklyRecruitment(env);
  } else if (mode === "create") {
    await createWeeklyEvents(env);
  } else if (mode === "weekly_report") {
    await sendWeeklyReports(env);
  } else if (mode === "event_notify" || cronExpression.includes("0 11 * *")) {
    await sendEventUsersNotification(env, { lookaheadHours: 48 });
  } else if (cronExpression.includes("*/10 * * * *") || mode === "recruit_reminder") {
    // 10分ごと: 開始時刻が近い募集の参加者へリマインド(D1)
    await sendRecruitmentReminders(env);
    // 同じ10分おきcronで、試合終了3分後に予約されたリザルト自動取得も処理する
    await processPendingMatchSyncs(env);
  } else {
    // 直前通知: 進行中の募集の集まり具合を通知し、不足なら欠員アラート
    await sendRecruitStatusNotification(env);
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
          const ps = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,mmr`);
          for (const p of (ps || [])) {
            if (p.mmr != null) mmrById.set(String(p.discord_id), p.mmr);
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
        color: shortage > 0 ? 0xf1c40f : 0x2ecc71,
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

    // 2. 毎週日曜 0:00 JST 投稿時 ➔ 直近の「土曜日 21:00 JST (=UTC 12:00)」を開催日時とする
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
    const currentDay = jstNow.getUTCDay(); // 0(日)〜6(土)
    
    // 直近の土曜日までの日数（日曜日の場合 6日後）
    let diffToSaturday = (6 - currentDay + 7) % 7;
    if (diffToSaturday === 0 && jstNow.getUTCHours() >= 21) {
      diffToSaturday = 7; // すでに土曜21時を過ぎている場合は来週
    }

    const targetDate = jstNow.getUTCDate() + diffToSaturday;
    const startUtcMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), targetDate, 12, 0, 0, 0);

    const startAtIso = new Date(startUtcMs).toISOString();
    const startJstDate = new Date(startUtcMs + 9 * 3600 * 1000);
    const dateLabel = `${startJstDate.getUTCMonth() + 1}/${startJstDate.getUTCDate()}(土)`;
    const ownerId = CONFIG.ADMIN_ID;
    
    // 2部屋統合用メタデータ
    const metadata = {
      mode: '定期カスタム',
      time: `${dateLabel} 21:00`,
      maxCount: 20,
      memo: `【定期カスタム】${dateLabel} 21:00 開催予定！下のボタンからご希望の部門に参加してください🎮`,
      owner: ownerId,
      createdAt: new Date().toISOString(),
      silverJoined: [],
      goldJoined: [],
      names: { [ownerId]: 'KTM定期カスタム' }
    };

    // 2部屋統合 Embed
    const embed = {
      title: `⚔️ KTM 定期カスタム開催告知 [${dateLabel} 21:00]`,
      description: `毎週末恒例の定期カスタム戦です！\n下のボタンを押すだけで参加エントリーできます（部門は名簿の代表MMRから自動振り分けされます）。\n\n💡 **希望レーンに変更がある方は、ポータルの「マイページ」より変更をお願いします！**`,
      color: 0xc89b3c, // 琥珀色
      fields: [
        {
          name: `🛡️ 【シルバー以下部門】 (0/10名)`,
          value: `▫ 参加者: なし\n※対象: 初心者〜シルバーレベル`,
          inline: false
        },
        {
          name: `👑 【ゴルプラ部門】 (0/10名)`,
          value: `▫ 参加者: なし\n※対象: ゴールド〜プラチナレベル`,
          inline: false
        }
      ],
      footer: { text: `日時: ${dateLabel} 21:00〜 | 主催: KTM運営` },
      timestamp: new Date().toISOString()
    };

    // 参加ボタンは1つに統合。どちらの部門になるかは代表MMRから自動判定する
    // （以前はシルバー以下/ゴルプラをユーザー自身に選ばせていた）。
    const components = [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2,
            label: "🎮 参加する",
            style: 1, // Primary (Blue)
            custom_id: "join_periodic_auto"
          }
        ]
      }
    ];

    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `📢 **【定期カスタム募集】${dateLabel} 21:00 開催！** <@&${CONFIG.NOTIFICATION_ROLE_ID}>`,
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
      maxCount: 20,
      startAt: startAtIso,
    });
    console.log(`[WeeklyRecruit] 2部屋統合定期カスタム募集を投稿しました (msg ${sent.id})`);

    try {
      const { fetchPortalAPI } = await import('../utils/api.js');
      await fetchPortalAPI(env, '/api/push/notify-recruit', { mode: '定期カスタム', time: `${dateLabel} 21:00` }).catch(() => {});
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

    if (activeEmbed && activeEmbed.fields) {
      activeEmbed.fields.forEach(f => {
        const matches = (f.value || "").match(/- <@\d+>/g) || [];
        if (f.name.includes("シルバー")) {
          silverCount = matches.length;
        } else if (f.name.includes("ゴルプラ")) {
          goldCount = matches.length;
        }
      });
    }

    const silverShortfall = Math.max(0, 10 - silverCount);
    const goldShortfall = Math.max(0, 10 - goldCount);
    const totalJoined = silverCount + goldCount;

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
                  // すでに余分な【希望: 未設定】などの文字列が入っていれば除去してから付与
                  const cleanLine = line.replace(/【希望: [^】]+】/g, '').replace(/\*\(希望: [^\)]+\)\*/g, '').trim();
                  return `${cleanLine} ${prefStr}`;
                } else if (!prefStr) {
                  // 名簿に未登録のユーザーの場合は余計な未設定ラベルを消去
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
      // 同期元となる既存の募集カードが見つからない場合（新規募集サイクルの初回等）の初期状態。
      syncFields = [
        { name: "📝 シルバー以下 (0名)", value: "「興味あり」を押しているプレイヤーはいません。", inline: false },
        { name: "📝 ゴルプラ (0名)", value: "「興味あり」を押しているプレイヤーはいません。", inline: false }
      ];
    }

    const recruitLink = targetMessageId ? `\n\n👉 [元の募集メッセージを開く](https://discord.com/channels/${guildId}/${channelId}/${targetMessageId})` : '';
    const laneNote = `\n\n💡 **希望レーンに変更がある方は、ポータルの「マイページ」より事前に変更をお願いします！**`;

    const isConfirmed = silverCount >= 10 || goldCount >= 10;
    const statusMessage = isConfirmed
      ? `🔥 **開催確定！** 現在 **シルバー: ${silverCount}名 / ゴルプラ: ${goldCount}名** (合計${totalJoined}名) エントリー済みです！このまま開催します。${laneNote}${recruitLink}`
      : `⚠️ **メンバー募集中！** 現在 **シルバー: ${silverCount}名 / ゴルプラ: ${goldCount}名** (合計${totalJoined}名) です。\n▫ シルバー以下: あと **${silverShortfall}名**\n▫ ゴルプラ: あと **${goldShortfall}名**\n下のボタンからエントリーしてください！${laneNote}${recruitLink}`;
    const embedColor = isConfirmed ? 0x2ecc71 : 0xe74c3c;

    const embed = {
      title: activeEmbed ? activeEmbed.title : (isAdvanceNotice ? `📅 【定期】イベント 事前告知 🔔` : `📅 【定期】カスタム戦 参加メンバー状況`),
      description: statusMessage,
      color: embedColor,
      fields: syncFields,
      footer: { text: "KTM Bot | 募集カード同期アナウンス" },
      timestamp: new Date().toISOString()
    };

    // 5. メッセージ ＆ ワンタップ「参加する」ボタンの作成
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    const messageBody = {
      embeds: [embed],
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2,
              label: "🎮 参加する",
              style: 1, // Primary (Blue)
              custom_id: "join_periodic_auto"
            }
          ]
        }
      ]
    };

    if (!isConfirmed && roleId) {
      let shortText = [];
      if (silverShortfall > 0) shortText.push(`シルバー以下 あと${silverShortfall}名`);
      if (goldShortfall > 0) shortText.push(`ゴルプラ あと${goldShortfall}名`);
      messageBody.content = `<@&${roleId}> 🚨 **【${shortText.join(' / ')}】でカスタム開催です！** 参加できる方は下のボタンからエントリーをお願いします！`;
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
