import { CONFIG } from '../../config.js';
import { fetchWithRetry } from '../../utils/api.js';
import { notifyAdminError } from '../../utils/alert.js';
import { fetchSupabase } from '../../utils/supabase.js';
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
      return { action: 'error', reason: '通知先チャンネルが解決できない' };
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
      return { action: 'skipped', reason: '21:00を過ぎている' };
    }

    const recentMessages = await fetchRecentBotMessages(env, channelId);
    const summaries = [];
    for (const target of targets) {
      const summary = await loadDayRecruitmentSummary(env, target, recentMessages);
      if (summary) summaries.push(summary);
    }
    if (summaries.length === 0) {
      console.log('[EventNotify] 対象の定期カスタム募集カードが見つからないためスキップ');
      return { action: 'skipped', reason: '募集カードが見つからない' };
    }

    const allReady = summaries.every((s) => s.status.high?.isReady && s.status.low?.isReady);
    if (allReady) {
      console.log('[EventNotify] 対象日（' + summaries.map((s) => s.target.label).join(', ') + '）は全ロビーが定員到達（開催確定）しているためリマインド送信をスキップします');
      // 満員になった場合も、以前の「残り枠リマインド」が残っていれば掃除する
      await cleanupOldReminderMessages(env, channelId);
      return { action: 'skipped', reason: '全ロビー定員到達' };
    }

    const guildId = await resolveGuildId(env, channelId);

    // 日曜のお祭りお題をDB（ktm_settings）から取得（未設定や未定の場合は「未定」にフォールバック）
    let sundayThemeText = '未定（当日集まったメンバーで相談・決定！）';
    try {
      const settingsRows = await fetchSupabase(env, 'ktm_settings', 'key=eq.sunday_festival_theme&select=value');
      const val = settingsRows?.[0]?.value;
      if (val && typeof val === 'object' && val.title) {
        const titleStr = String(val.title).trim();
        if (val.id === 'undecided' || titleStr.includes('未定')) {
          sundayThemeText = '未定（当日集まったメンバーで相談・決定！）';
        } else {
          sundayThemeText = titleStr;
        }
      }
    } catch (themeErr) {
      console.warn('[EventNotify] お祭りお題の取得に失敗 (未定にフォールバック):', themeErr);
    }

    const dayLines = summaries.map((s) => {
      const def = getDayDef(s.target.dayKey);
      const high = s.status.high || { joined: 0, isReady: false, remaining: 10 };
      const low = s.status.low || { joined: 0, isReady: false, remaining: 10 };
      const highState = high.isReady ? '**✅ 開催確定！**' : `あと${high.remaining}名`;
      const lowState = low.isReady ? '**✅ 開催確定！**' : `あと${low.remaining}名`;

      const link = guildId
        ? ` → [カードへジャンプ](https://discord.com/channels/${guildId}/${s.channelId}/${s.messageId})`
        : '';

      const lines = [
        `${def.emoji} **${def.name}**　${s.target.label} 21:00〜${link}`,
        `　👑 **上位帯ロビー**: **${high.joined}/10名** → ${highState}`,
        `　🌱 **中初級帯ロビー**: **${low.joined}/10名** → ${lowState}`
      ];

      if (s.target.dayKey === 'sat') {
        lines.push('　🛡️ **実力均等**: チーム戦力を推定MMRランクで五分五分に自動調整！初心者・中初級帯でも安心して参加できます');
      } else if (s.target.dayKey === 'sun') {
        lines.push(`　🎪 **今週のお題**: **「${sundayThemeText}」**（ランク不問・お祭り枠✨）`);
      }

      return lines.join('\n');
    });

    const isSunOnly = summaries.length === 1 && summaries[0].target.dayKey === 'sun';
    const embedColor = isSunOnly ? (RECRUITMENT_COLORS.recruitingSun || 0xe67e22) : (RECRUITMENT_COLORS.recruitingSat || 0x2980b9);

    const embed = {
      title: '📣 週末定期カスタム 残り枠のお知らせ',
      description: [
        dayLines.join('\n\n'),
        '',
        '---',
        '🔰 **「中初級帯だけど迷惑かけない…？」** ➔ **まったく気にせず押してください！**',
        '💡 「21:00〜の1戦のみ参加」や「ご飯終わりの途中合流」も大歓迎です！',
      ].join('\n'),
      color: embedColor,
      footer: { text: 'KTM Bot | 週末カスタム リマインド ｜ 各募集カードからエントリーできます' },
      timestamp: new Date().toISOString(),
    };

    // 二重投稿防止: 直近1時間以内に同一タイトルのBot投稿があればスキップ
    try {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (recentMessages.find((m) => m.embeds?.[0]?.title === embed.title && new Date(m.timestamp).getTime() > oneHourAgo)) {
        console.log('[EventNotify] 同一タイトルの通知が直近1時間以内にあるためスキップ（二重発火防止）');
        return { action: 'skipped', reason: '直近1時間に同じ通知がある' };
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
        const targetNote = '';
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
      `${prefix}📢 **【週末カスタム 残り枠のお知らせ】**`,
      `🔥 **${shortText || '開催間近！'}** 開催確定まであと少し！エントリーお待ちしています！`
    ];
    if (cardLinks) {
      contentLines.push('', '👉 **募集カードを開いてエントリー:**', cardLinks);
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
          label: `👉 ${def.emoji}【${def.label}】募集カードを開く`,
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
      return { action: 'error', reason: `送信に失敗 (${sendRes.status})` };
    }
    console.log(`[EventNotify] 残り枠リマインドを送信しました (対象${summaries.length}日分)`);
    return { action: 'posted', reason: `残り枠のお知らせ（${shortText}）` };
  } catch (err) {
    console.error("Error in sendEventUsersNotification:", err);
    await notifyAdminError(env, err, { action: 'sendEventUsersNotification(中間アナウンス)' });
    return { action: 'error', reason: String(err?.message || err).slice(0, 200) };
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
// 20:00 判定で人数が足りなくても「中止」の告知を出さない日（JST、YYYY-MM-DD）。主催者が個別に判断する日用。
// 使った例: 2026-10-17（プラチナ基準で第1戦が足りない見込みだったが、観戦の人も含めて開催を検討したため。ユーザー指示）。
// 過ぎた日付は消しておく（2026-10-19 に空にした）
const NO_CANCEL_NOTICE_DATES = [];

export async function checkCustomStatusAt2000(env) {
  try {
    // ★ 2026-09-21修正: ここだけが他の全関数と違い、CONFIGのフォールバックを持たない
    // env.DISCORD_KTM_CHANNEL_ID を素で参照していた。この変数はconfig.jsにもwrangler.tomlにも
    // 定義が無く(コードベース全体でこの1箇所しか参照が無い)、未設定なら即returnするため、
    // cronが正しく発火しても20:00判定が無言で何もしない状態だった(「孤立した自動化」パターン)。
    const channelId = env.DISCORD_KTM_CHANNEL_ID || CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    if (!channelId) {
      console.error('[Check2000] 判定対象のチャンネルIDが解決できませんでした');
      return { action: 'error', reason: '判定対象のチャンネルが解決できない' };
    }

    // 現在のJST曜日を取得 (0=日, 6=土)
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayOfWeek = nowJst.getUTCDay();
    const dayKey = dayOfWeek === 6 ? 'sat' : dayOfWeek === 0 ? 'sun' : null;
    if (!dayKey) {
      console.log('[Check2000] 土日ではないためスキップ');
      return { action: 'skipped', reason: '土日ではない' };
    }

    // ★ 2026-09-23追加: 手遅れ実行のガード。
    // GitHub Actionsのバックアップは実測で1〜5時間遅れて発火する（2026-09-23調査）。
    // 21:00開始の可否判定を22時や23時に投稿しても意味が無いどころか、
    // 「本日20:00 判定結果: 中止」が試合後に流れる混乱の元になる。
    const jstMinutes = nowJst.getUTCHours() * 60 + nowJst.getUTCMinutes();
    if (jstMinutes < 19 * 60 + 50 || jstMinutes > 21 * 60) {
      console.log(`[Check2000] 20:00判定の有効時間帯(19:50〜21:00 JST)を外れているためスキップ (現在 ${nowJst.getUTCHours()}:${String(nowJst.getUTCMinutes()).padStart(2, '0')} JST)`);
      return { action: 'skipped', reason: '判定の時間帯(19:50〜21:00)を外れている' };
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
          return { action: 'skipped', reason: '直近30分に判定メッセージがある' };
        }
      }
    } catch (dupErr) {
      console.warn('[Check2000] 二重投稿チェックに失敗（判定は続行）:', dupErr);
    }

    // 本日開催分のカードを start_at で直接引く
    const target = resolveWeekendTargets().find((t) => t.dayKey === dayKey);
    if (!target) {
      console.log('[Check2000] 本日の開催対象が解決できませんでした');
      return { action: 'error', reason: '本日の開催対象が解決できない' };
    }
    const summary = await loadDayRecruitmentSummary(env, target);
    if (!summary) {
      console.log(`[Check2000] ${def.name}(${target.label})の募集カードが見つかりません`);
      return { action: 'skipped', reason: '募集カードが見つからない' };
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

    const idsIn = (lines) => [...new Set((lines || []).flatMap((l) => [...l.matchAll(/<@!?(\d+)>/g)].map((m) => m[1])))].slice(0, 100);

    // 指示文32: 20:00 開催判定をロビー（上位帯／中初級帯）ごとに独立して判定・実行
    function evaluateLobbyDecision({ lobbyKey, lobbyName, lobbyStatus, spectatorLines, def }) {
      const firstMatchCount = lobbyStatus.match1Count;
      const lateCount = lobbyStatus.match2LateLines?.length ?? 0;
      const shortfall = Math.max(0, DAY_CAPACITY - firstMatchCount);
      const spectatorLinesForMatch1 = (spectatorLines || []).filter((l) => !/2戦目/.test(l));

      // A. 開催確定
      if (lobbyStatus.isMatch1Ready) {
        const attendeeIds = idsIn(lobbyStatus.match1Lines);
        const attendeeMentions = attendeeIds.length > 0
          ? `\n\n集合をお願いします 🎮 ${attendeeIds.map((id) => `<@${id}>`).join(' ')}`
          : '';
        return {
          type: 'CONFIRMED',
          action: `${lobbyName} 開催確定`,
          isReady: true,
          content: `🎉 **【本日20:00 判定: ${lobbyName} 開催確定！】**\n${def.emoji} **${def.name}（${lobbyName}）** は第1戦メンバーが ${firstMatchCount}名 集まりました！21:00より開始します。ポータルのバランサーでチーム分けを行います。${attendeeMentions}`,
          allowed_mentions: { users: attendeeIds },
        };
      }

      // A-2. 第2戦から開催確定
      if (lobbyStatus.isMatch2Ready) {
        const match2Ids = idsIn([...(lobbyStatus.match1Lines || []).filter((l) => !/1戦のみ/.test(l)), ...(lobbyStatus.match2LateLines || [])]);
        return {
          type: 'MATCH2_CONFIRMED',
          action: `${lobbyName} 第2戦から開催確定`,
          isReady: true,
          content: `🎉 **【本日20:00 判定: ${lobbyName} 第2戦から開催確定！】**\n${def.emoji} **${def.name}（${lobbyName}）** は第1戦が ${firstMatchCount}/${DAY_CAPACITY}名 のため、**第2戦から**開催します（第2戦は ${lobbyStatus.match2Count}名）。開始時刻は主催者からの案内をお待ちください。` +
            (match2Ids.length ? `\n\n集合をお願いします 🎮 ${match2Ids.map((id) => `<@${id}>`).join(' ')}` : ''),
          allowed_mentions: { users: match2Ids },
        };
      }

      // A-3. 観戦枠への参加依頼
      if (firstMatchCount + spectatorLinesForMatch1.length >= DAY_CAPACITY) {
        const spectatorIds = idsIn(spectatorLinesForMatch1);
        return {
          type: 'SPECTATOR_REQUEST',
          action: `${lobbyName} 観戦枠への参加依頼`,
          isReady: false,
          content: `🙋 **【参加のお願い】${def.name}（${lobbyName}）**\n` +
            `第1戦の出場対象は ${firstMatchCount}/${DAY_CAPACITY}名 で、あと **${shortfall}名** 足りません。\n` +
            `観戦希望の方が入ってくれれば開催できます。出られそうな方は、下のボタンを押して第1戦へエントリーをお願いします🙏\n` +
            (spectatorIds.length ? `\n\n${spectatorIds.map((id) => `<@${id}>`).join(' ')}` : ''),
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: `🙋 ${lobbyName}の第1戦に参加する！ (あと${shortfall}名)`,
                  style: 3,
                  custom_id: `spectator_accept:${def.key}:${lobbyKey}`
                }
              ]
            }
          ],
          allowed_mentions: { users: spectatorIds },
        };
      }

      // B. 助っ人募集
      if (firstMatchCount >= 8 && lateCount >= 1) {
        return {
          type: 'HELP_RECRUIT',
          action: `${lobbyName} 助っ人募集`,
          isReady: false,
          content: `🚨 <@&${CONFIG.NOTIFICATION_ROLE_ID}> **【21:00開始の第1試合 ${lobbyName}の助っ人をピンポイント募集中！】**\n\n` +
            `・**${def.shortName}（${lobbyName}）**: 第1試合（21:00〜）があと **${shortfall}名** 不足！（2戦目からは途中参加の方が ${lateCount}名 合流予定✨）\n` +
            `💡 **「21:00から1試合だけならできる！」という方はいませんか？**\n` +
            `下のボタンから1戦だけ助っ人エントリーをお願いします！`,
          components: [
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
          ],
          allowed_mentions: { roles: [CONFIG.NOTIFICATION_ROLE_ID] },
        };
      }

      // C. 中止
      const entryIds = idsIn(lobbyStatus.eligibleLines);
      const cancelMentions = entryIds.length > 0
        ? `\n\n通知: ${entryIds.map((id) => `<@${id}>`).join(' ')}`
        : '';

      return {
        type: 'CANCEL',
        action: `${lobbyName} 中止`,
        isReady: false,
        content: `🛑 **【本日の${def.name}（${lobbyName}）は中止です】**\n\n` +
          `20:00時点で${lobbyName}の第1試合の参加者が ${firstMatchCount}/${DAY_CAPACITY}名 と集まらなかったため、本日の${lobbyName}は中止とします。\n` +
          `エントリーしてくださった皆さん、ありがとうございました。\n` +
          `（※開催確定したロビーは予定通り進行します）\n\n` +
          `💡 集まれる人で遊びたい場合は、下のボタンから通常募集を立てられます。` +
          cancelMentions,
        components: [
          {
            type: 1,
            components: [
              { type: 2, label: "⚔️ 通常募集を立てる", style: 1, custom_id: "portal_recruit" }
            ]
          }
        ],
        allowed_mentions: { users: entryIds },
      };
    }

    const highDecision = evaluateLobbyDecision({
      lobbyKey: 'high',
      lobbyName: '上位帯ロビー',
      lobbyStatus: summary.status.high,
      spectatorLines: summary.status.spectator?.lines,
      def,
    });
    const lowDecision = evaluateLobbyDecision({
      lobbyKey: 'low',
      lobbyName: '中初級帯ロビー',
      lobbyStatus: summary.status.low,
      spectatorLines: summary.status.spectator?.lines,
      def,
    });

    const decisions = [highDecision, lowDecision];
    const postChannelId = summary.channelId || channelId;
    const replyTo = summary.messageId ? { message_reference: { message_id: summary.messageId, fail_if_not_exists: false } } : {};
    const todayJst = nowJst.toISOString().slice(0, 10);
    const skipCancel = NO_CANCEL_NOTICE_DATES.includes(todayJst);

    const outcomes = [];
    for (const d of decisions) {
      if (d.type === 'CANCEL' && skipCancel) {
        console.log(`[Check2000] ${todayJst} は中止告知を出さない日のため${d.action}をスキップ`);
        continue;
      }
      const postRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${postChannelId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: d.content,
          components: d.components || [],
          allowed_mentions: d.allowed_mentions || {},
          ...replyTo,
        })
      });
      outcomes.push(postOutcome(postRes, d.action));
      console.log(`[Check2000] ${d.action} を投稿しました: ${def.name}`);
    }

    // 中止告知の後のカード締め切り:
    // 両方のロビーが中止になった場合のみカード全体を締め切る（片方でも開催確定ならカードはそのまま進行）
    if (!highDecision.isReady && !lowDecision.isReady && !skipCancel && summary.messageId) {
      await closePeriodicCard(env, postChannelId, summary.messageId)
        .catch((e) => console.warn('[Check2000] 中止したカードの締め切りに失敗:', e));
    }

    return outcomes[0] || { action: 'posted', reason: '判定完了' };

  } catch (err) {
    console.error('[Check2000] error:', err);
    // 20:00判定は「開催/中止」を告知する最重要処理。ここが落ちると誰にも何も届かないまま
    // 試合時刻を迎えるため、必ず管理者へ通知する（consoleはWorkersで保存されず追跡不能）
    await notifyAdminError(env, err, { action: 'checkCustomStatusAt(20:00開催判定)' });
    return { action: 'error', reason: String(err?.message || err).slice(0, 200) };
  }
}

// 定期実行の記録（bot_cron_runs.detail）に残す結果。Discord への投稿が失敗していたら error にし、
// pg_cron の保険がやり直せるようにする（2026-10-20）
function postOutcome(res, label) {
  if (res && !res.ok) return { action: 'error', reason: `${label}の投稿に失敗 (${res.status})` };
  return { action: 'posted', reason: label };
}
