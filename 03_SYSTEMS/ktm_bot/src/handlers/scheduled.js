import { CONFIG } from '../config.js';
import { fetchSupabase } from '../utils/supabase.js';
import { parseMessageData } from '../utils/helpers.js';
import { fetchWithRetry } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { createRecruitment } from '../utils/recruitPermission.js';
import { getKtmRank, formatRankDistribution, formatMmrWithRank } from '../utils/ktmRank.js';

export async function handleScheduledEvent(event, env, ctx) {
  console.log("Scheduled event triggered:", JSON.stringify(event));
  const cronExpression = event.cron || "";
  const mode = event.mode || "";

  // 定期実行から外した処理（イベント作成・週間レポート・イベント基準の告知）は、
  // 必要なときだけ /trigger-scheduled?mode=... で手動実行できるよう残してある。
  if (mode === "create") {
    await createWeeklyEvents(env);
  } else if (mode === "weekly_report") {
    await sendWeeklyReports(env);
  } else if (mode === "event_notify") {
    await sendEventUsersNotification(env, { lookaheadHours: 48 });
  } else if (cronExpression === "*/10 * * * *" || mode === "recruit_reminder") {
    // 10分ごと: 開始時刻が近い募集の参加者へリマインド(D1)
    await sendRecruitmentReminders(env);
  } else if (cronExpression === "0 15 * * 6" || mode === "weekly_recruit") {
    // 毎週日曜 0:00 JST (土曜 UTC 15:00): 前回の募集を締め切り、同週土曜21:00開催の定期募集を自動投稿
    await postWeeklyRecruitment(env);
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
 * 直前通知（募集ベース）: Discordイベントではなく「実際に立っている募集」を見て、
 * 現在の参加人数を通知する。10人に足りなければ通知ロールをメンションして欠員アラート。
 * 二重投稿防止のため、直近3時間に同一タイトルのbot投稿があればスキップする。
 */
async function sendRecruitStatusNotification(env) {
  try {
    // 対象は「開始1時間前後〜48時間以内」のopen募集。
    // 定期募集は1週間前に立つため、範囲を絞らないと来週分にも通知してしまう。
    const nowMs = Date.now();
    const fromIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const toIso = new Date(nowMs + 48 * 60 * 60 * 1000).toISOString();
    const rows = await fetchSupabase(
      env, 'recruitments',
      `status=eq.open&start_at=gte.${encodeURIComponent(fromIso)}&start_at=lte.${encodeURIComponent(toIso)}&order=start_at.asc&limit=5&select=discord_message_id,discord_channel_id,start_at,max_count`
    );
    if (!rows || rows.length === 0) {
      console.log('[RecruitStatus] 対象の募集がありません。');
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
    // 2部屋統合 Embed
    const embed = {
      title: `⚔️ KTM 定期カスタム開催告知 [${dateLabel} 21:00]`,
      description: `毎週末恒例の定期カスタム戦です！\n下記の部門ボタンを押して参加エントリーをお願いします。`,
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

    // 2部屋それぞれの参加ボタン（通知ボタンは完全削除）
    const components = [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2,
            label: "🛡️ シルバー以下に参加",
            style: 3, // Green
            custom_id: "join_periodic:silver"
          },
          {
            type: 2,
            label: "👑 ゴルプラに参加",
            style: 1, // Primary (Blue)
            custom_id: "join_periodic:gold"
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
    let totalJoinedCount = 0;
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
          if (activeEmbed.fields) {
            activeEmbed.fields.forEach(f => {
              const matches = (f.value || "").match(/- <@\d+>/g);
              if (matches) totalJoinedCount += matches.length;
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn("Recruitment fetch warning:", dbErr);
    }

    // 3. Guild 内の Scheduled Events からも抽出
    const eventsRes = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
    });

    const scheduledEvents = eventsRes.ok ? await eventsRes.json() : [];
    const now = Date.now();
    const minStartLimit = now - 3 * 60 * 60 * 1000;
    const maxStartLimit = now + lookaheadHours * 60 * 60 * 1000;

    const targetEvents = scheduledEvents.filter(e => {
      const startTime = new Date(e.scheduled_start_time).getTime();
      const isWithinRange = startTime >= minStartLimit && startTime <= maxStartLimit;
      const hasTeiki = e.name && (e.name.includes("【定期】") || e.name.includes("カスタム") || e.name.includes("KTM"));
      const isActive = e.status === 1 || e.status === 2;
      return isWithinRange && hasTeiki && isActive;
    });

    const eventDetails = [];
    for (const targetEvent of targetEvents) {
      const usersRes = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${targetEvent.id}/users?limit=100&with_member=true`, {
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
      });
      if (usersRes.ok) {
        const eventUsers = await usersRes.json();
        eventDetails.push({ event: targetEvent, users: eventUsers });
      }
    }

    const eventUsersCount = eventDetails[0]?.users.length || 0;
    const effectiveTotalCount = Math.max(eventUsersCount, totalJoinedCount);
    let shortfall = effectiveTotalCount < 10 ? 10 - effectiveTotalCount : 0;

    // 4. アナウンス Embed の作成（募集カードを完全同期 ＆ 引用リンク添付）
    let syncFields = activeEmbed ? activeEmbed.fields : [];
    
    if (!syncFields || syncFields.length === 0) {
      syncFields = eventDetails.map((ed) => {
        const { event: targetEvent, users: eventUsers } = ed;
        const userListText = eventUsers.map((eu, index) => {
          if (!eu || !eu.user) return `\`${String(index + 1).padStart(2, '0')}.\` 不明なユーザー`;
          const displayName = eu.member?.nick || eu.user.global_name || eu.user.username || "不明";
          return `\`${String(index + 1).padStart(2, '0')}.\` <@${eu.user.id}> (${displayName})`;
        }).join('\n') || "「興味あり」を押しているプレイヤーはいません。";

        return {
          name: `📝 ${targetEvent.name} (${eventUsers.length}名)`,
          value: userListText,
          inline: false
        };
      });
    }

    const recruitLink = targetMessageId ? `\n\n👉 [元の募集メッセージを開く](https://discord.com/channels/${guildId}/${channelId}/${targetMessageId})` : '';
    const statusMessage = effectiveTotalCount >= 10
      ? `🔥 **開催確定！** 現在 **${effectiveTotalCount}名** エントリー済みです！このまま開催します。${recruitLink}`
      : `⚠️ **メンバー募集中！** 現在 **${effectiveTotalCount}名** です。カスタム開催（10人）まであと **${shortfall}名** 不足しています。下のボタンからエントリーしてください！${recruitLink}`;
    const embedColor = effectiveTotalCount >= 10 ? 0x2ecc71 : 0xe74c3c;

    const embed = {
      title: activeEmbed ? activeEmbed.title : (isAdvanceNotice ? `📅 【定期】イベント 事前告知 🔔` : `📅 【定期】カスタム戦 参加メンバー状況`),
      description: statusMessage,
      color: embedColor,
      fields: syncFields,
      footer: { text: "KTM Bot | 募集カード同期アナウンス" },
      timestamp: new Date().toISOString()
    };

    // 7. メッセージ ＆ ワンタップ「参加する」ボタン（シルバー以下＆ゴルプラ）の作成
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    const messageBody = {
      embeds: [embed],
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2,
              label: "🛡️ シルバー以下に参加",
              style: 3, // Green
              custom_id: "join_periodic:silver"
            },
            {
              type: 2,
              label: "👑 ゴルプラに参加",
              style: 1, // Primary (Blue)
              custom_id: "join_periodic:gold"
            }
          ]
        }
      ]
    };

    if (shortfall > 0 && roleId) {
      messageBody.content = `<@&${roleId}> 🚨 **あと${shortfall}名でカスタム開催です！** 参加できる方は上のボタンまたはイベントから「参加する / 興味あり」を押してください！`;
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
