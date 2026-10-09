import { CONFIG } from '../../config.js';
import { fetchWithRetry } from '../../utils/api.js';
import { notifyAdminError } from '../../utils/alert.js';
import { getDayDef, DAY_CAPACITY, RECRUITMENT_COLORS, resolveWeekendTargets } from '../../utils/recruitmentStatus.js';
import { fetchRecentBotMessages, closePeriodicCard, loadDayRecruitmentSummary, resolveGuildId, cleanupOldReminderMessages } from './periodicCards.js';

// 開催前の中間アナウンス・リマインドと、土日20:00の開催判定
// 2026-10-07: handlers/scheduled.js（1,441行）から分割。処理は分割前と同じ。

export async function sendEventUsersNotification(env, options = {}) {
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

    // チャンネルの自浄: 古いリマインド・催促通知があれば事前に削除して最新1通に保つ
    await cleanupOldReminderMessages(env, channelId);

    const messageBody = { embeds: [embed] };

    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    const prefix = roleId ? `<@&${roleId}> ` : '';

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

    const cardLinks = summaries
      .filter((s) => s.messageId && s.channelId)
      .map((s) => {
        const def = getDayDef(s.target.dayKey);
        const url = `https://discord.com/channels/${guildId}/${s.channelId}/${s.messageId}`;
        return `・${def.emoji} **${def.label}**: [募集カードを開く](${url})`;
      })
      .join('\n');

    const contentLines = [
      `${prefix}📢 **【${shortText}】** 参加できる方はエントリーをお願いします！`
    ];
    if (cardLinks) {
      contentLines.push('', '👉 **募集カードを開く:**', cardLinks);
    }

    messageBody.content = contentLines.join('\n');
    messageBody.allowed_mentions = { parse: ['roles'] };

    const linkButtons = summaries
      .filter((s) => s.messageId && s.channelId)
      .map((s) => {
        const def = getDayDef(s.target.dayKey);
        return {
          type: 2,
          style: 5,
          label: `👉 ${def.name} カードへ`,
          url: `https://discord.com/channels/${guildId}/${s.channelId}/${s.messageId}`
        };
      });

    if (linkButtons.length > 0) {
      messageBody.components = [
        {
          type: 1,
          components: linkButtons
        }
      ];
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
    await notifyAdminError(env, err, { action: 'sendEventUsersNotification(中間アナウンス)' });
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
          // 中止の告知も含める（2026-10-03まで中止側の文言がここに無く、Cloudflare 20:00 と
          // GitHub Actions 20:09 の両方が中止告知を投稿しうる状態だった）
          (m.content?.includes('本日20:00 判定') || m.content?.includes('助っ人をピンポイント募集中') ||
            m.content?.includes('定期カスタムは中止とします'))
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

    // チャンネルの自浄: 過去のリマインド・催促を削除して最新の判定メッセージ1通に保つ
    await cleanupOldReminderMessages(env, summary.channelId || channelId);

    // A. 開催確定（募集カードへの返信として投稿）
    if (firstMatchCount >= DAY_CAPACITY) {
      const confirmChannelId = summary.channelId || channelId;
      // ⚠️ 2026-09-29追加: 以前は開催確定時に**参加者へのメンションが無かった**。
      // 中止のときだけメンションしており、「開催される側」は返信に気づかないと集合できない
      // 非対称な状態だった（開催確定こそ集合の合図が要る）。中止側と同じ方式で当事者だけに鳴らす。
      // なお `sendRecruitmentReminders`（開始15分前リマインド）は呼び出し元ゼロの死んだ関数で、
      // punctualなcron枠が無く実装できないため削除した。その役割はここが担う。
      const attendeeIds = [...new Set(
        summary.lines.flatMap((l) => [...l.matchAll(/<@!?(\d+)>/g)].map((m) => m[1]))
      )].slice(0, 100);
      const attendeeMentions = attendeeIds.length > 0
        ? `\n\n集合をお願いします 🎮 ${attendeeIds.map((id) => `<@${id}>`).join(' ')}`
        : '';
      await fetchWithRetry(`https://discord.com/api/v10/channels/${confirmChannelId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🎉 **【本日20:00 判定: 開催確定！】**\n${def.emoji} **${def.name}** は第1戦メンバーが${firstMatchCount}名集まりました！21:00より開始します。ポータルのバランサーでチーム分けを行います。${attendeeMentions}`,
          allowed_mentions: { users: attendeeIds },
          ...(summary.messageId ? { message_reference: { message_id: summary.messageId, fail_if_not_exists: false } } : {})
        })
      });
      console.log(`[Check2000] 開催確定通知を募集カードへの返信として投稿しました（通知対象 ${attendeeIds.length}名）`);
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

    // C. 中止
    // 2026-10-03: 以前は「21:00まで参加枠を開放しています／別モードで遊ぶことも可能です」という
    // 状況案内とノーマル・ARAMのクイック募集ボタンだったが、開催するのかしないのかが曖昧だった。
    // ユーザー指示により「中止」と明言し、遊びたい人向けに通常募集を立てるボタンだけを付ける。
    const substituteComponents = [
      {
        type: 1,
        components: [
          // portal_recruit は募集作成モーダル（モード・時刻・人数・メモ）を開く。どのメッセージからでも動作する
          { type: 2, label: "⚔️ 通常募集を立てる", style: 1, custom_id: "portal_recruit" }
        ]
      }
    ];

    const cancelContent = `🛑 **【本日の${def.name}は中止です】**\n\n` +
      `20:00時点で第1試合の参加者が ${firstMatchCount}/${DAY_CAPACITY}名 と集まらなかったため、本日の定期カスタムは中止とします。\n` +
      `エントリーしてくださった皆さん、ありがとうございました。\n` +
      `\n💡 集まれる人で遊びたい場合は、下のボタンから通常募集を立てられます。`;

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
    console.log(`[Check2000] 中止告知と通常募集ボタンを投稿しました: ${def.name}（通知対象 ${entryIds.length}名）`);

    // 中止したのにカードが開いたままだと、20時以降のエントリーで開催するのか分からなくなるため締め切る。
    // 方式は月曜朝の定期カスタム締め切りと同じ（タイトルに受付終了を付け、ボタンを無効化、DBもclosed）。
    if (summary.messageId) {
      await closePeriodicCard(env, cancelChannelId, summary.messageId)
        .catch((e) => console.warn('[Check2000] 中止したカードの締め切りに失敗:', e));
    }

  } catch (err) {
    console.error('[Check2000] error:', err);
    // 20:00判定は「開催/中止」を告知する最重要処理。ここが落ちると誰にも何も届かないまま
    // 試合時刻を迎えるため、必ず管理者へ通知する（consoleはWorkersで保存されず追跡不能）
    await notifyAdminError(env, err, { action: 'checkCustomStatusAt(20:00開催判定)' });
  }
}
