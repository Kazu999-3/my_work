import { CONFIG, getPortalUrl } from '../../config.js';
import { sendDiscordMessage, sendInteractionFollowup } from '../../utils/api.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, applyDayCardState } from '../../ui/embeds.js';
import { parseMessageData } from '../../utils/helpers.js';
import { getKtmRank, getHighestLaneMmr, getPlayerExperienceBadge } from '../../utils/ktmRank.js';
import { detectDayKey, getDayDef, extractEntryLines, resolveWeekendTargets, buildRecruitmentContent, computeDayStatus, DAY_CAPACITY, RANK_SHORT_JP_MAP, RANK_JP_MAP } from '../../utils/recruitmentStatus.js';
import { cleanupOldReminderMessages } from '../scheduled.js';
import { notifyAdminError } from '../../utils/alert.js';
import { recordRecruitmentActivity } from '../../utils/recruitmentAudit.js';

// 定期募集（土日カード）への参加・代理追加
// 2026-10-07: handlers/components.js（1,486行）のボタン処理から分割。処理は分割前と同じ（元の判定順のまま）。

/**
 * 旧形式（1枚のカードに土曜・日曜のフィールドが同居）の募集カードかどうか。
 * 新形式のカードは参加者フィールドが1つだけで、曜日はタイトル側が持つ。
 * 旧カードに新ロジックで書き込むと、もう一方の曜日の参加者一覧が消えるため、
 * 移行が終わるまでは書き込まずに案内だけ返す。
 */
function isLegacyPeriodicCard(message) {
  const fields = message?.embeds?.[0]?.fields || [];
  return fields.filter((f) => detectDayKey(f.name) !== null).length >= 2;
}

/** 新形式カードから参加者行を取り出す（ロビー別フィールド・観戦フィールドから全件抽出） */
function readDayEntryLines(embed) {
  const fields = embed?.fields || [];
  return fields.flatMap((f) => {
    const isSpectator = f.name?.includes('観戦');
    const lines = extractEntryLines(f.value);
    if (isSpectator) {
      return lines.map((l) => (l.includes('観戦') ? l : l.replace(/^- /, '- 👀【観戦】')));
    }
    return lines;
  });
}

const PLAYER_SELECT = 'discord_id,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,role_preferences,name,games_top,games_jg,games_mid,games_adc,games_sup,metadata,allow_higher';

/** 名簿行の「経験バッジ・ランク（土曜のみ）・希望レーン」部分。playerRow が無い（未登録）時は 🔰 だけ */
function buildEntrySuffix(playerRow, def) {
  const expBadgeStr = ` ${getPlayerExperienceBadge(playerRow).short}`;

  // ランク表記は土曜（最多ランク帯を基準にチーム分けする）でのみ意味を持つ。
  // 日曜はランク不問のお祭り枠なので出さない。
  let rankStr = "";
  if (def.showRank && playerRow) {
    const tier = getKtmRank(getHighestLaneMmr(playerRow) ?? 0);
    if (tier && tier.name) {
      const shortName = RANK_SHORT_JP_MAP[tier.name] || RANK_JP_MAP[tier.name] || tier.name;
      rankStr = ` 【${shortName}】`;
    }
  }

  let lanePrefStr = "";
  try {
    let pref = playerRow?.role_preferences;
    if (typeof pref === 'string') {
      try { pref = JSON.parse(pref); } catch (e) {}
    }
    if (pref && (pref.primary || pref.secondary)) {
      // FILL・ANY は ALL と同じ意味なので ALL に統一して表示する（2026-10-17。ALL と FILL が混ざって見えていた）
      const lane = (v) => {
        if (!v || v === '指定なし' || v === 'なし' || v === '-') return '';
        const u = String(v).toUpperCase();
        return u === 'FILL' || u === 'ANY' ? 'ALL' : v;
      };
      const p1 = lane(pref.primary);
      let p2 = lane(pref.secondary);
      // 第1希望が ALL ならどのレーンでも希望どおり扱いで、第2希望はチーム分けで使われないので出さない
      if (p2 === p1 || p1 === 'ALL') p2 = '';
      if (p1 && p2) {
        lanePrefStr = ` 【${p1}/${p2}】`;
      } else if (p1 || p2) {
        lanePrefStr = ` 【${p1 || p2}】`;
      }
    }
  } catch (e) {
    console.warn("role_preferences parse error:", e);
  }
  return { expBadgeStr, rankStr, lanePrefStr };
}

/**
 * 参加者行のバッジ・ランク・希望レーンを名簿から引き直して付け直す。
 * 最初（2026-10-17）は、ランクもレーンも無い「🔰」だけの行が対象だった。
 * 名簿の読み込みに失敗した時（10/14 の Supabase 停止中など）に、登録済みの人まで 🔰 で書き込まれ、
 * カードの行は書き直されないため残り続けていた（かずきさん107戦・けんちさん15戦が 🔰）。
 * 本当に未登録の人は名簿に行が無いので 🔰 のまま。
 */
//
// 2026-10-17: 🔰だけの行に限らず、押下のたびに全員の「経験バッジ・ランク・希望レーン」を名簿から付け直すよう広げた。
// ランクは参加ボタンを押した時点のMMRで書かれて固定されていたため、MMRの再計算や試合の後も古い帯のまま残り、
// 部屋分け（最多の帯を基準に出場対象・観戦を分ける）が古い値で行われていた。
// 参加形態のタグ（⏱️【1戦のみ】等）は行頭にあり、ここでは <@id> より後ろだけを書き換えるので消えない。
// 押した本人の行（「🟢フル」等が <@id> の直後に付いた組み立て直後の行）は最新なので触らない。
async function refreshEntryLines(env, lines, def) {
  const tailRe = /<@(\d+)>(.*)$/;
  const ids = [...new Set(lines.map((l) => l.match(tailRe)?.[1]).filter(Boolean))];
  if (ids.length === 0) return lines;
  const rows = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${ids.join(',')})&select=${PLAYER_SELECT}`).catch(() => null);
  if (!rows || rows.length === 0) return lines; // 読めなければ今の表記のまま
  const byId = new Map(rows.map((r) => [r.discord_id, r]));
  return lines.map((l) => {
    const m = l.match(tailRe);
    if (!m) return l;
    if (/フル|1戦のみ|途中参加|観戦/.test(m[2])) return l;
    const row = byId.get(m[1]);
    if (!row) return l; // 未登録の人は 🔰 のまま
    const { expBadgeStr, rankStr, lanePrefStr } = buildEntrySuffix(row, def);
    return l.replace(tailRe, `<@${m[1]}>${expBadgeStr}${rankStr}${lanePrefStr}`);
  });
}

/** 該当するボタンなら応答を返し、該当しなければ undefined（次の処理へ）を返す */
export async function handlePeriodicRecruitButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
  // ── 【指示文31-3 & 指示文32: 20:00観戦者への参加お願い ➔ 参加切り替え＆自動開催確定】 ──
  if (customId.startsWith('spectator_accept:')) {
    const parts = customId.split(':');
    const dayKey = parts[1] || 'sat';
    const lobbyKey = parts[2] || 'high';
    const def = getDayDef(dayKey);
    const lobbyName = lobbyKey === 'high' ? '上位帯ロビー' : '中初級帯ロビー';

    const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
    if (nowJst.getUTCHours() >= 21) {
      return Response.json({
        type: 4,
        data: { content: "⚠️ 21:00を過ぎたため、主催者の案内をお待ちください。", flags: 64 }
      });
    }

    ctx.waitUntil((async () => {
      try {
        const msgId = interaction.message.id;
        const channelId = interaction.channel_id;

        const [msgRes, playerRow] = await Promise.all([
          fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
            headers: { "Authorization": `Bot ${botToken}` }
          }),
          fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=${PLAYER_SELECT}`)
            .then((rows) => (rows && rows.length > 0 ? rows[0] : null))
            .catch(() => null),
        ]);

        if (!msgRes.ok) return;
        const msg = await msgRes.json();
        const targetEmbed = { ...msg.embeds[0] };
        const currentLines = readDayEntryLines(targetEmbed);
        const userMention = `<@${userId}>`;
        const userLine = currentLines.find((l) => l.includes(userMention));

        if (!userLine || !/観戦/.test(userLine)) {
          await sendInteractionFollowup(appId, token, {
            content: "⚠️ 観戦希望でエントリーされている方のみが対象の操作です。",
            flags: 64
          });
          return;
        }

        const { expBadgeStr, rankStr, lanePrefStr } = buildEntrySuffix(playerRow, def);
        const entryLine = `- ${userMention} 🟢フル${expBadgeStr}${rankStr}${lanePrefStr}`;
        const nextLines = currentLines.filter((l) => !l.includes(userMention));
        nextLines.push(entryLine);

        const healedLines = await refreshEntryLines(env, nextLines, def);
        const { status: nextStatus } = applyDayCardState(targetEmbed, dayKey, healedLines);

        await sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
          embeds: [targetEmbed],
          components: interaction.message.components,
          allowed_mentions: { roles: [] }
        });

        const targetLobby = lobbyKey === 'high' ? nextStatus.high : nextStatus.low;
        if (targetLobby && targetLobby.match1Count >= DAY_CAPACITY) {
          const recent = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=10`, {
            headers: { "Authorization": `Bot ${botToken}` }
          }).then(r => r.json()).catch(() => []);
          const alreadyAnnounced = (recent || []).some(m => m.content?.includes(`${lobbyName} 開催確定！`));
          if (!alreadyAnnounced) {
            const attendeeIds = (targetLobby.match1Lines || []).map(l => l.match(/<@(\d+)>/)?.[1]).filter(Boolean);
            const attendeeMentions = attendeeIds.length ? `\n\n参加メンバー: ${attendeeIds.map(id => `<@${id}>`).join(' ')}` : '';
            await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
              content: `🎉 **【本日20:00 判定: ${lobbyName} 開催確定！】**\n${def.emoji} **${def.name}（${lobbyName}）** は観戦希望者の参加合流により第1戦メンバーが10名集まりました！21:00より開始します。ポータルのバランサーでチーム分けを行います。${attendeeMentions}`,
              allowed_mentions: { users: attendeeIds },
              message_reference: { message_id: msgId, fail_if_not_exists: false }
            });
          }
        }

        await sendInteractionFollowup(appId, token, {
          content: `✅ **${lobbyName}の第1戦への参加に切り替えました！**\nご協力ありがとうございます✨ チーム分けをお待ちください！`,
          flags: 64
        });
      } catch (err) {
        console.error('spectator_accept error:', err);
      }
    })());

    return Response.json({ type: 6 });
  }

  if (customId.startsWith('join_periodic')) {
    // join_periodic_auto:style   : 土曜・本戦カスタム
    // join_periodic_sunday:style : 日曜・お祭りカスタム
    // style: 'full' | 'single' | 'late'
    //
    // ★ 2026-09-23: 募集カードを土日の2枚に分離したため、この処理は
    //   「押されたカード1枚だけ」を更新する。
    //   以前は1枚のカードに土日のフィールドが同居していた関係で、チャンネル内の
    //   「タイトルに定期カスタムを含むBot投稿」を最大100件走査して fields を丸ごと
    //   コピーして回る同期処理を持っていた。カードが2枚になるとこの同期は
    //   土曜カードの内容で日曜カードを上書きしてしまうため、完全に廃止した。
    const [prefix, rawStyle] = customId.split(':');
    const dayKey = detectDayKey(prefix) || 'sat';
    const def = getDayDef(dayKey);
    const participationStyle = rawStyle || 'full';

    let styleBadge = " 🟢フル";
    if (participationStyle === 'single') styleBadge = " ⏱️1戦のみ";
    else if (participationStyle === 'late') styleBadge = " 🌙途中参加(2戦目〜)";
    else if (participationStyle === 'spectator') styleBadge = " 👀観戦希望";

    const userMention = `<@${userId}>`;

    if (isLegacyPeriodicCard(interaction.message)) {
      return Response.json({
        type: 4,
        data: {
          content: "⚠️ この募集カードは旧形式のため、こちらからは参加を受け付けられません。\n同じチャンネルに投稿されている **土曜／日曜それぞれの募集カード** からエントリーをお願いします🙏",
          flags: 64
        }
      });
    }

    ctx.waitUntil((async () => {
      try {
        const msgId = interaction.message.id;
        const channelId = interaction.channel_id;

        const [msgRes, playerRow] = await Promise.all([
          fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
            headers: { "Authorization": `Bot ${botToken}` }
          }),
          fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=${PLAYER_SELECT}`)
            .then((rows) => (rows && rows.length > 0 ? rows[0] : null))
            // 読み込み失敗は undefined（未登録の null と区別し、🔰 を書き込まない）
            .catch((e) => { console.warn('join_periodic: 名簿取得に失敗:', e); return undefined; }),
        ]);
        const lookupFailed = playerRow === undefined;

        if (!msgRes.ok) throw new Error("メッセージ取得失敗");
        const msg = await msgRes.json();
        if (!msg.embeds || msg.embeds.length === 0) throw new Error("Embedが見つかりません");

        // カードの表示テキストが参加データなので「読む→書き戻す」の間に別の人が押すと、後から書いた方だけが残る。
        // 書き戻した後に読み直し、自分の操作が反映されていなければ最新のカードでやり直す（最大3回。2026-10-19）
        const applyOnce = async (msg) => {
          const targetEmbed = { ...msg.embeds[0] };

          // --- 参加者行のバッジを組み立てる（名簿の読み込みに失敗した時はバッジ無し。誤って 🔰 と書くより空の方がよい。
          //     本人がもう一度押せば付く） ---
          const { expBadgeStr, rankStr, lanePrefStr } = lookupFailed
            ? { expBadgeStr: '', rankStr: '', lanePrefStr: '' }
            : buildEntrySuffix(playerRow, def);

          const entryLine = `- ${userMention}${styleBadge}${expBadgeStr}${rankStr}${lanePrefStr}`;

          // --- 参加者一覧の更新（辞退なら削除、通常ならトグル/スタイル変更）---
          const currentLines = readDayEntryLines(targetEmbed);
          const existingLine = currentLines.find((l) => l.includes(userMention));
          const nextLines = currentLines.filter((l) => !l.includes(userMention));

          let activityAction = null;
          if (participationStyle === 'leave') {
            if (existingLine) {
              activityAction = 'LEAVE';
            }
          } else {
            if (!existingLine) {
              activityAction = 'JOIN';
              nextLines.push(entryLine);
            } else if (!existingLine.includes(styleBadge)) {
              activityAction = 'SWITCH_STYLE';
              nextLines.push(entryLine);
            }
          }

          // 全員のバッジ・ランク・希望レーンを名簿の最新値で付け直す（🔰で書かれてしまった登録者の行もここで直る）
          const healedLines = await refreshEntryLines(env, nextLines, def);
          const { status: nextStatus } = applyDayCardState(targetEmbed, dayKey, healedLines);

          const [satTarget, sunTarget] = resolveWeekendTargets();
          const currentTarget = dayKey === 'sun' ? sunTarget : satTarget;
          const newContent = currentTarget ? buildRecruitmentContent(currentTarget, CONFIG.NOTIFICATION_ROLE_ID) : undefined;

          await sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
            ...(newContent ? { content: newContent } : {}),
            embeds: [targetEmbed],
            components: interaction.message.components,
            allowed_mentions: { roles: [] }
          });
          return { currentLines, activityAction, rankStr, lanePrefStr, nextLines, nextStatus, existingLine };
        };
        const fetchCard = async () => {
          const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
            headers: { "Authorization": `Bot ${botToken}` }
          });
          if (!r.ok) throw new Error("メッセージ取得失敗");
          const m = await r.json();
          if (!m.embeds || m.embeds.length === 0) throw new Error("Embedが見つかりません");
          return m;
        };
        const wantPresent = participationStyle !== 'leave';
        // 活動ログ・通知などの後続処理は、最初の1回の結果を使う
        const { currentLines, activityAction, rankStr, lanePrefStr, nextLines, nextStatus, existingLine } = await applyOnce(msg);
        for (let attempt = 0; attempt < 2; attempt++) {
          await new Promise((r) => setTimeout(r, 400 + Math.floor(Math.random() * 600)));
          const latest = await fetchCard();
          const present = readDayEntryLines({ ...latest.embeds[0] }).some((l) => l.includes(userMention));
          if (present === wantPresent) break;
          console.warn(`join_periodic: 同時押しで ${userId} の操作が消えたためやり直し (${attempt + 1})`);
          await applyOnce(latest);
        }

        // ⑭ 開催確定後の辞退は Pity（希望レーン優先権）をリセットする（2026-10-16 配線。
        // TODO では「完了」扱いだったが未実装だった）。「確定」は辞退前のカードが開催確定(isReady)だったか。
        if (activityAction === 'LEAVE' && playerRow && computeDayStatus(currentLines, DAY_CAPACITY, dayKey).isReady) {
          try {
            await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`, 'PATCH', { pity: 0 });
            await sendInteractionFollowup(appId, token, {
              content: 'ℹ️ 開催確定後の辞退のため、希望レーンの優先権（Pity）を0に戻しました。',
              flags: 64,
            });
          } catch (pityErr) {
            console.warn('Pity reset on confirmed leave failed:', pityErr);
          }
        }

        // 監査ログを記録（管理者向け履歴）
        if (activityAction) {
          const userName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || playerRow?.name || 'Unknown';
          recordRecruitmentActivity(env, {
            messageId: msgId,
            recruitmentType: dayKey === 'sun' ? 'periodic_sun' : 'periodic_sat',
            channelId,
            userId,
            userName,
            action: activityAction,
            style: participationStyle === 'leave' ? null : participationStyle,
            metadata: {
              rank: rankStr.trim(),
              lanePref: lanePrefStr.trim()
            }
          }).catch((e) => console.warn('Activity log error:', e));

          // 指示文31 項目4: プロフィール未設定者（希望レーンまたは格上対面設定）へのみ案内（辞退・変更時は出さない）
          if (activityAction === 'JOIN') {
            let hasLanePref = false;
            try {
              let pref = playerRow?.role_preferences;
              if (typeof pref === 'string') { try { pref = JSON.parse(pref); } catch {} }
              if (pref && (pref.primary || pref.secondary)) hasLanePref = true;
            } catch {}
            const hasHigherPref = playerRow?.allow_higher !== null && playerRow?.allow_higher !== undefined;

            if (!playerRow || !hasLanePref || !hasHigherPref) {
              const portalUrl = getPortalUrl(env);
              sendInteractionFollowup(appId, token, {
                content: `💡 **【プロフィール設定のお願い】**\nまだ希望レーンや格上対面の設定が完了していません。\nチーム分けで希望を最大限反映できるよう、事前にポータルのマイページから設定をお願いします✨\n🔗 [マイページで設定する](${portalUrl}/mypage)`,
                flags: 64,
              }).catch((e) => console.warn('Profile unset notice error:', e));
            }
          }
        }

        // ★ 指示文32: あと1名になった瞬間にロビー（帯）を名指しして促進の返信を自動投稿
        const prevStatus = computeDayStatus(currentLines, DAY_CAPACITY, dayKey);
        let promptContent = null;

        const highM1JustOne = nextStatus.high?.match1Remaining === 1 && (!existingLine || prevStatus.high?.match1Remaining !== 1);
        const lowM1JustOne = nextStatus.low?.match1Remaining === 1 && (!existingLine || prevStatus.low?.match1Remaining !== 1);

        if (highM1JustOne && lowM1JustOne) {
          promptContent = `🔥 **【${def.shortName}: 上位帯・中初級帯ともにあと1名で開催確定！】** 21:00からの開幕戦にエントリーしませんか？✨`;
        } else if (highM1JustOne) {
          promptContent = `🔥 **【${def.shortName}: 上位帯ロビーがあと1名で開催確定！】** 21:00からの開幕戦にエントリーしませんか？✨`;
        } else if (lowM1JustOne) {
          promptContent = `🔥 **【${def.shortName}: 中初級帯ロビーがあと1名で開催確定！】** 21:00からの開幕戦にエントリーしませんか？✨`;
        } else if (nextStatus.high?.match2Remaining === 1 && nextStatus.high?.isMatch1Ready && prevStatus.high?.match2Remaining !== 1) {
          promptContent = `🔥 **【${def.shortName}: 上位帯の第2試合があと1名で10名到達！】** 2戦目からの途中合流で参加しませんか？✨`;
        } else if (nextStatus.low?.match2Remaining === 1 && nextStatus.low?.isMatch1Ready && prevStatus.low?.match2Remaining !== 1) {
          promptContent = `🔥 **【${def.shortName}: 中初級帯の第2試合があと1名で10名到達！】** 2戦目からの途中合流で参加しませんか？✨`;
        } else if (nextStatus.high?.remaining === 1 && (!existingLine || prevStatus.high?.remaining !== 1)) {
          promptContent = `🔥 **【${def.shortName}: 上位帯ロビーがあと1名で開催確定！】** どなたか最後の1枠で参加しませんか？✨`;
        } else if (nextStatus.low?.remaining === 1 && (!existingLine || prevStatus.low?.remaining !== 1)) {
          promptContent = `🔥 **【${def.shortName}: 中初級帯ロビーがあと1名で開催確定！】** どなたか最後の1枠で参加しませんか？✨`;
        }

        if (promptContent) {
          await cleanupOldReminderMessages(env, channelId);
          await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
            content: promptContent,
            message_reference: { message_id: msgId, fail_if_not_exists: false }
          }).catch((e) => console.warn("あと1名リマインドの送信失敗:", e));
        }
      } catch (err) {
        console.error("join_periodic error:", err);
        // ⚠️ このcatchが2026-09-26〜09-29の間、computeDayStatus の ReferenceError を
        // 3日間握りつぶしていた（「あと1名で開催確定」促進が一度も出なかった）。
        // 参加者一覧のPATCHは例外より前で成功するため、外から見ると正常に見えてしまう。
        // 同じ見落としを防ぐため管理者へ通知する。
        await notifyAdminError(env, err, { action: 'join_periodic(定期カスタムの参加ボタン)', customId });
      }
    })());

    // 自分にだけ見えるメッセージを出さず、静かにコンポーネントのみリアルタイム更新
    return Response.json({ type: 6 });
  }

  if (customId.startsWith('proxy_add_init:')) {
    const ownerId = customId.split(':')[1];
    if (userId !== ownerId) return Response.json({ type: 4, data: { content: "⚠️ 募集主のみ代理追加が可能です。", flags: 64 } });
    return Response.json({
      type: 4, data: {
        content: "📋 **追加したいメンバーを選択してください**", flags: 64,
        components: [{ type: 1, components: [{ type: 5, custom_id: `proxy_add_submit:${ownerId}:${interaction.message.id}`, placeholder: "ユーザーを選択...", min_values: 1, max_values: 5 }] }]
      }
    });
  }

  if (customId.startsWith('proxy_add_submit:')) {
    const [,, origMsgId] = customId.split(':');
    const targetUserIds = interaction.data.values || [];
    const resolvedUsers = interaction.data.resolved?.users || {};
    
    // タイムアウト回避のため、重い処理は ctx.waitUntil に逃がす
    ctx.waitUntil((async () => {
      try {
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages/${origMsgId}`, { headers: { "Authorization": `Bot ${botToken}` } });
        if (!msgRes.ok) throw new Error("元メッセージの取得に失敗しました。");
        
        const origMsg = await msgRes.json();
        const metadata = parseMessageData(origMsg);
        
        let addedCount = 0;
        targetUserIds.forEach(tId => {
          if (metadata.joined.length < metadata.maxCount && !metadata.joined.includes(tId)) {
            metadata.joined.push(tId);
            metadata.names[tId] = resolvedUsers[tId]?.global_name || resolvedUsers[tId]?.username || "Unknown";
            metadata.spectating = metadata.spectating.filter(id => id !== tId);
            addedCount++;
          }
        });

        if (addedCount > 0) {
          await sendDiscordMessage(`channels/${interaction.channel_id}/messages/${origMsgId}`, botToken, "PATCH", {
            content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata)
          });

          // 代理追加ログの記録
          for (const tId of targetUserIds) {
            const tName = resolvedUsers[tId]?.global_name || resolvedUsers[tId]?.username || "Unknown";
            recordRecruitmentActivity(env, {
              messageId: origMsgId,
              recruitmentType: 'spontaneous',
              channelId: interaction.channel_id,
              userId: tId,
              userName: tName,
              action: 'PROXY_ADD',
              metadata: { addedBy: userId }
            }).catch(() => {});
          }
          // 完了通知（フォローアップ）
          await sendInteractionFollowup(appId, token, { content: `✅ <@${userId}> がメンバーを ${addedCount} 名追加しました。`, flags: 0 });
        }
      } catch (err) {
        console.error("ProxyAdd Error:", err);
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());

    // 即座にレスポンスを返す (type: 7 は現在操作している ephemeral メッセージを更新/消去する)
    return Response.json({ type: 7, data: { content: "⌛ メンバーを追加処理中です...", components: [] } });
  }


  return undefined;
}
