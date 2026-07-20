import { CONFIG } from '../config.js';
import { fetchSupabase } from '../utils/supabase.js';
import { parseMessageData } from '../utils/helpers.js';
import { fetchWithRetry } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { createRecruitment } from '../utils/recruitPermission.js';

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
  } else if (cronExpression === "0 12 * * 6" || mode === "weekly_recruit") {
    // 毎週土曜 21:00 JST: その日開催の定期カスタム募集を自動投稿
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

      const nameList = joined.length > 0
        ? joined.map((id, i) => `${String(i + 1).padStart(2, '0')}. <@${id}>`).join('\n')
        : '（まだ参加者がいません）';

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
        description: `**開催予定: ${startJst}${startJst ? ' (JST)' : ''}**\n現在の参加者 **${joined.length}/${max}** 名\n\n${nameList}`,
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
    // 今日(JST)の21:00 = UTC 12:00 を開始時刻とする
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
    // 「翌週」土曜21:00 JST(=UTC 12:00) を開催日時にする。
    // 土21時に投稿→1週間かけて参加者を集める運用のため、+7日する。
    const startUtcMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 7, 12, 0, 0, 0);
    const startAtIso = new Date(startUtcMs).toISOString();
    const startJstDate = new Date(startUtcMs + 9 * 3600 * 1000); // 表示用(JST)
    const dateLabel = `${startJstDate.getUTCMonth() + 1}/${startJstDate.getUTCDate()}(土)`;

    // 二重投稿防止: 同じ開始時刻のopen募集が既にあればスキップ
    const existing = await fetchSupabase(env, 'recruitments', `start_at=eq.${encodeURIComponent(startAtIso)}&status=eq.open&select=id`);
    if (existing && existing.length > 0) {
      console.log('[WeeklyRecruit] 同時刻の募集が既に存在するためスキップします。');
      return;
    }

    const ownerId = CONFIG.ADMIN_ID;
    const metadata = {
      mode: 'カスタム', time: `${dateLabel} 21:00`, maxCount: 10,
      memo: `【定期カスタム】${dateLabel} 21:00 開催予定です！参加できる人はボタンで表明お願いします🎮`,
      owner: ownerId, createdAt: new Date().toISOString(),
      joined: [], spectating: [],
      roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null },
      names: { [ownerId]: 'KTM定期カスタム' }
    };

    const targetChannelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: createMessageContent(metadata),
        embeds: [createRecruitEmbed(metadata)],
        components: createRecruitButtons(metadata)
      })
    });
    if (!res.ok) {
      console.error(`[WeeklyRecruit] 募集投稿に失敗: ${res.status} ${await res.text()}`);
      return;
    }
    const sent = await res.json();

    // recruitments に記録（開始リマインドD1の対象にもなる）
    await createRecruitment(env, {
      messageId: sent.id,
      channelId: targetChannelId,
      ownerDiscordId: ownerId,
      mode: 'カスタム',
      maxCount: 10,
      startAt: startAtIso,
    });
    console.log(`[WeeklyRecruit] 定期カスタム募集を投稿しました (msg ${sent.id})`);

    // Web Push通知(#54)。失敗しても無視。
    try {
      const { fetchPortalAPI } = await import('../utils/api.js');
      await fetchPortalAPI(env, '/api/push/notify-recruit', { mode: 'カスタム', time: '21:00' });
    } catch (e) { /* noop */ }
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

    const createdEvents = [];
    const skippedEventNames = [];

    for (const template of eventTemplates) {
      // 重複チェック: 同じ名前かつ同じ開始予定日時のアクティブなイベントがあるか
      const isDuplicate = existingEvents.some(e => {
        const sameName = e.name === template.name;
        const sameTime = new Date(e.scheduled_start_time).getTime() === scheduledStart.getTime();
        const notCanceled = e.status !== 4; // 4=CANCELED
        return sameName && sameTime && notCanceled;
      });

      if (isDuplicate) {
        console.log(`Event "${template.name}" already exists for ${startTimeISO}. Skipping creation.`);
        skippedEventNames.push(template.name);
        
        // 既存の該当イベントを告知用に回収
        const dupEvent = existingEvents.find(e => 
          e.name === template.name && 
          new Date(e.scheduled_start_time).getTime() === scheduledStart.getTime() &&
          e.status !== 4
        );
        if (dupEvent) {
          createdEvents.push(dupEvent);
        }
        continue;
      }

      console.log(`Creating scheduled event: ${template.name}`);
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
        method: "POST",
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: template.name,
          privacy_level: 2, // GUILD_ONLY
          scheduled_start_time: startTimeISO,
          scheduled_end_time: endTimeISO,
          description: template.description,
          entity_type: 3, // EXTERNAL
          entity_metadata: {
            location: "オンライン"
          }
        })
      });

      if (!res.ok) {
        console.error(`Failed to create event ${template.name}: ${res.status} ${await res.text()}`);
      } else {
        const createdEvent = await res.json();
        console.log(`Successfully created event ${template.name} with ID: ${createdEvent.id}`);
        createdEvents.push(createdEvent);
      }
    }

    // 4. 新規作成されたイベントがある場合のみ、全体メンションを投げてリンク付きで告知する
    const newCreatedCount = eventTemplates.length - skippedEventNames.length;
    
    if (newCreatedCount > 0 && createdEvents.length > 0) {
      console.log("Sending announcement message with event links...");
      
      const eventLinks = createdEvents.map(e => {
        return `🔹 **${e.name}**\n👉 https://discord.com/events/${guildId}/${e.id}`;
      }).join('\n\n');

      const messageContent = `📅 **来週の【定期】カスタムイベントを作成しました！**\n参加予定の方は、以下のリンクから「興味あり」を押してください！\n\n${eventLinks}\n\n@everyone`;

      const announceRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: messageContent
        })
      });

      if (!announceRes.ok) {
        console.error(`Failed to send announcement message: ${announceRes.status} ${await announceRes.text()}`);
      } else {
        console.log("Announcement message sent successfully!");
      }
    } else {
      console.log("No new events created (all were duplicates). Skipping announcement to prevent double notifications.");
    }

  } catch (err) {
    console.error("Error in createWeeklyEvents:", err);
  }
}

/** イベントの「興味あり」メンバーを自動抽出して送信する */
async function sendEventUsersNotification(env, options = {}) {
  const lookaheadHours = options.lookaheadHours || 48;
  const isAdvanceNotice = lookaheadHours > 48;
  console.log(`Starting event users extraction notification... (lookahead: ${lookaheadHours}h)`);
  try {
    const channelId = CONFIG.MATCH_CHANNEL_ID || "1487077567939743995";
    
    // 1. チャンネル情報から Guild ID を動的に取得
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

    // 2. Guild 内の Scheduled Events 一覧を取得
    const eventsRes = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`
      }
    });

    if (!eventsRes.ok) {
      throw new Error(`Failed to fetch scheduled events: ${eventsRes.status} ${await eventsRes.text()}`);
    }

    const scheduledEvents = await eventsRes.json();
    console.log(`Fetched ${scheduledEvents.length} events from guild.`);

    // 3. lookaheadHours以内の「【定期】」が含まれるアクティブなイベントをフィルタ
    const now = Date.now();
    const minStartLimit = now - 3 * 60 * 60 * 1000; // Allow events started up to 3 hours ago (timezone buffer)
    const maxStartLimit = now + lookaheadHours * 60 * 60 * 1000;

    const targetEvents = scheduledEvents.filter(e => {
      const startTime = new Date(e.scheduled_start_time).getTime();
      const isWithinRange = startTime >= minStartLimit && startTime <= maxStartLimit;
      const hasTeiki = e.name && e.name.includes("【定期】");
      const isActive = e.status === 1 || e.status === 2;
      return isWithinRange && hasTeiki && isActive;
    });

    console.log(`Found ${targetEvents.length} target events matching criteria.`);

    if (targetEvents.length === 0) {
      console.log(`No matching scheduled events found within ${lookaheadHours}h containing '【定期】'. Skipping notification.`);
      return;
    }

    // 4. 各イベントの「興味あり」ユーザー情報を取得
    const eventDetails = [];
    for (const targetEvent of targetEvents) {
      console.log(`Fetching users for event: ${targetEvent.name} (${targetEvent.id})`);
      const usersRes = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${targetEvent.id}/users?limit=100&with_member=true`, {
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`
        }
      });

      if (!usersRes.ok) {
        console.error(`Failed to fetch users for event ${targetEvent.id}: ${usersRes.status} ${await usersRes.text()}`);
        continue;
      }

      const eventUsers = await usersRes.json();
      eventDetails.push({
        event: targetEvent,
        users: eventUsers
      });
    }

    if (eventDetails.length === 0) {
      console.log("No user details retrieved. Skipping notification.");
      return;
    }

    // 5. 人数状況（3パターン）の判定
    let statusMessage = "";
    let embedColor = 0x3498db; // デフォルト：ブルー
    // 欠員アラート(課題#41): 10人に満たない場合だけ、通知ロールを能動的に@メンションして呼ぶ。
    // 通知ロールはオプトイン制なのでスパムにならない。不足人数もメッセージに出す。
    let shortfall = 0; // 開催(10人)まで不足している人数（0なら充足）

    const eventCount = eventDetails.length;
    const count0 = eventDetails[0]?.users.length || 0;
    const name0 = eventDetails[0]?.event.name || "";
    
    if (eventCount === 1) {
      // イベントが1つの場合
      if (count0 >= 10) {
        statusMessage = `🔥 **開催確定！**\n「${name0}」が単体で10人以上に達しています！このまま開催します。`;
        embedColor = 0x2ecc71; // グリーン
      } else {
        statusMessage = `⚠️ **メンバー募集中！**\n現在の参加予定者は **${count0}名** です。カスタム開催（10人）まであと **${10 - count0}名** 不足しています。参加できる方は「興味あり」を押してください！`;
        embedColor = 0xe74c3c; // レッド
        shortfall = 10 - count0;
      }
    } else {
      // イベントが2つ以上ある場合（基本2つの想定）
      const count1 = eventDetails[1]?.users.length || 0;
      const name1 = eventDetails[1]?.event.name || "";
      const totalCount = count0 + count1;

      if (count0 >= 10 || count1 >= 10) {
        // パターン①：片方（または両方）が10人以上
        if (count0 >= 10 && count1 >= 10) {
          statusMessage = `🔥 **ダブル開催確定！**\n「${name0}」と「${name1}」がそれぞれ単体で10人以上に達しています！両方の部屋で開催します。`;
        } else {
          const reachedName = count0 >= 10 ? name0 : name1;
          statusMessage = `🔥 **開催確定！**\n「${reachedName}」が単体で10人以上に達しています！このまま開催します。`;
        }
        embedColor = 0x2ecc71; // グリーン
      } else if (totalCount >= 10) {
        // パターン②：それぞれは10人未満だが、足して10人以上
        statusMessage = `📢 **合同開催見込み！**\n単体では10人未満ですが、足すと合計 **${totalCount}名** に達しているため、合同カスタムが開催可能です！`;
        embedColor = 0xf1c40f; // イエロー
      } else {
        // パターン③：足しても10人未満
        statusMessage = `⚠️ **メンバー募集中！**\n現在の合計参加予定者は **${totalCount}名** です。カスタム開催（10人）まであと **${10 - totalCount}名** 不足しています。参加できる方は「興味あり」を押してください！`;
        embedColor = 0xe74c3c; // レッド
        shortfall = 10 - totalCount;
      }
    }

    // 6. 統合した Embed の作成
    const embedFields = eventDetails.map((ed) => {
      const { event: targetEvent, users: eventUsers } = ed;
      
      const userListText = eventUsers.map((eu, index) => {
        if (!eu || !eu.user) return `\`${String(index + 1).padStart(2, '0')}.\` 不明なユーザー`;
        const displayName = eu.member?.nick || eu.user.global_name || eu.user.username || "不明";
        return `\`${String(index + 1).padStart(2, '0')}.\` <@${eu.user.id}> (${displayName})`;
      }).join('\n') || "「興味あり」を押しているプレイヤーはいません。";

      const eventDate = new Date(targetEvent.scheduled_start_time);
      const formattedDate = eventDate.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short'
      });

      return {
        name: `📝 ${targetEvent.name} (${eventUsers.length}名)`,
        value: `**開催予定**: ${formattedDate} (JST)\n\n${userListText}`,
        inline: false
      };
    });

    const embed = {
      title: isAdvanceNotice
        ? `📅 【定期】イベント 今週土曜の事前告知 🔔`
        : `📅 【定期】イベント「興味あり」表明メンバー状況`,
      description: isAdvanceNotice
        ? `⚠️ **今週土曜のカスタム戦まで残り約3日です！**\n\n${statusMessage}\n\n参加予定の方はイベントから「興味あり」を押してください！`
        : statusMessage,
      color: embedColor,
      fields: embedFields,
      footer: {
        text: "KTM Bot | 定期通知システム"
      },
      timestamp: new Date().toISOString()
    };

    // 6.5 二重投稿防止(#85): 冗長キック(GitHub Actions)とCloudflare cronの両方が発火しても
    // 同じ通知を2回投稿しないよう、直近3時間以内に同タイトルのbot投稿があればスキップする。
    try {
      const recentRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages?limit=10`, {
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
      });
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
        const dup = recent.find((m) =>
          m.author?.bot &&
          m.embeds?.[0]?.title === embed.title &&
          new Date(m.timestamp).getTime() > threeHoursAgo
        );
        if (dup) {
          console.log(`[Dedupe] 同一通知が直近に投稿済みのためスキップします (msg ${dup.id})`);
          return;
        }
      }
    } catch (dedupeErr) {
      console.warn('[Dedupe] 直近メッセージの確認に失敗（送信は続行）:', dedupeErr);
    }

    // 7. メッセージ送信
    // 欠員アラート: 10人に不足している時だけ、通知ロールを能動的に@メンションして呼ぶ。
    const messageBody = { embeds: [embed] };
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    if (shortfall > 0 && roleId) {
      messageBody.content = `<@&${roleId}> 🚨 **あと${shortfall}名でカスタム開催です！** 参加できる方は上のイベントから「興味あり」を押してください！`;
      messageBody.allowed_mentions = { roles: [roleId] }; // 指定ロールのみ通知（@everyone等の暴発を防ぐ）
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
      console.error(`Failed to send message to channel ${channelId}: ${sendRes.status} ${await sendRes.text()}`);
    } else {
      console.log(`Integrated notification sent successfully.`);
    }

  } catch (err) {
    console.error("Error in sendEventUsersNotification:", err);
  }
}
