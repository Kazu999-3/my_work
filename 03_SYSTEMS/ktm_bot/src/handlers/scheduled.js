import { CONFIG } from '../config.js';

export async function handleScheduledEvent(event, env, ctx) {
  console.log("Scheduled event triggered:", JSON.stringify(event));
  const cronExpression = event.cron || "";
  const mode = event.mode || "";

  if (cronExpression === "0 12 * * 6" || mode === "create") {
    // 毎週土曜 21:00 のイベント自動作成処理
    await createWeeklyEvents(env);
  } else if (cronExpression === "0 12 * * 3" || mode === "wednesday") {
    // 毎週水曜 21:00 の事前告知（土曜イベントを7日先まで検索）
    await sendEventUsersNotification(env, { lookaheadHours: 7 * 24 });
  } else {
    // 毎週金・土 20:00 の直前通知（48時間以内）
    await sendEventUsersNotification(env, { lookaheadHours: 48 });
  }
}

/** 毎週土曜日 21:00 のイベントを2つ自動作成する */
async function createWeeklyEvents(env) {
  console.log("Starting weekly event creation...");
  try {
    const channelId = CONFIG.MATCH_CHANNEL_ID || "1487077567939743995";
    
    // 1. チャンネル情報から Guild ID を動的に取得
    console.log(`Fetching channel info for channel: ${channelId}`);
    const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
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
    const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
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
    const eventsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
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
      const usersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${targetEvent.id}/users?limit=100&with_member=true`, {
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

    // 7. メッセージ送信
    const sendRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ embeds: [embed] })
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
