import { CONFIG } from '../../config.js';
import { sendDiscordMessage, sendInteractionFollowup } from '../../utils/api.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, applyDayCardState } from '../../ui/embeds.js';
import { parseMessageData } from '../../utils/helpers.js';
import { getKtmRank, getHighestLaneMmr, getPlayerExperienceBadge } from '../../utils/ktmRank.js';
import { detectDayKey, getDayDef, extractEntryLines, resolveWeekendTargets, buildRecruitmentContent, computeDayStatus, DAY_CAPACITY, RANK_SHORT_JP_MAP, RANK_JP_MAP } from '../../utils/recruitmentStatus.js';
import { cleanupOldReminderMessages } from '../scheduled.js';
import { notifyAdminError } from '../../utils/alert.js';

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

/** 新形式カードから参加者行を取り出す */
function readDayEntryLines(embed) {
  return extractEntryLines(embed?.fields?.[0]?.value);
}

/** 該当するボタンなら応答を返し、該当しなければ undefined（次の処理へ）を返す */
export async function handlePeriodicRecruitButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
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
          fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,role_preferences,name,games_top,games_jg,games_mid,games_adc,games_sup,metadata`)
            .then((rows) => (rows && rows.length > 0 ? rows[0] : null))
            .catch((e) => { console.warn('join_periodic: 名簿取得に失敗:', e); return null; }),
        ]);

        if (!msgRes.ok) throw new Error("メッセージ取得失敗");
        const msg = await msgRes.json();
        if (!msg.embeds || msg.embeds.length === 0) throw new Error("Embedが見つかりません");

        const targetEmbed = { ...msg.embeds[0] };

        // --- 参加者行のバッジを組み立てる ---
        const expBadgeStr = ` ${getPlayerExperienceBadge(playerRow).short}`;

        // ランク表記は土曜（最多ランク帯を基準にチーム分けする）でのみ意味を持つ。
        // 日曜はランク不問・MMR変動なしなので出さない。
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
            const p1 = pref.primary && pref.primary !== '指定なし' && pref.primary !== 'なし' ? pref.primary : '';
            const p2 = pref.secondary && pref.secondary !== '指定なし' && pref.secondary !== 'なし' ? pref.secondary : '';
            if (p1 && p2) {
              lanePrefStr = ` 【${p1}/${p2}】`;
            } else if (p1 || p2) {
              lanePrefStr = ` 【${p1 || p2}】`;
            }
          }
        } catch (e) {
          console.warn("role_preferences parse error:", e);
        }

        const entryLine = `- ${userMention}${styleBadge}${expBadgeStr}${rankStr}${lanePrefStr}`;

        // --- 参加者一覧の更新（辞退なら削除、通常ならトグル/スタイル変更）---
        const currentLines = readDayEntryLines(targetEmbed);
        const existingLine = currentLines.find((l) => l.includes(userMention));
        const nextLines = currentLines.filter((l) => !l.includes(userMention));

        if (participationStyle !== 'leave') {
          if (!existingLine || !existingLine.includes(styleBadge)) {
            nextLines.push(entryLine);
          }
        }

        const { status: nextStatus } = applyDayCardState(targetEmbed, dayKey, nextLines);

        const [satTarget, sunTarget] = resolveWeekendTargets();
        const currentTarget = dayKey === 'sun' ? sunTarget : satTarget;
        const newContent = currentTarget ? buildRecruitmentContent(currentTarget, CONFIG.NOTIFICATION_ROLE_ID) : undefined;

        await sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
          ...(newContent ? { content: newContent } : {}),
          embeds: [targetEmbed],
          components: interaction.message.components,
          allowed_mentions: { roles: [] }
        });

        // ★ あと1名になった瞬間にラストワン促進の返信を自動投稿
        // ⚠️ この行は2026-09-26〜09-29の間、未定義の識別子3つ(computeDayStatus /
        // DAY_CAPACITY のimport漏れ ＋ 存在しない targetDayKey)で ReferenceError を投げており、
        // 下の catch が握りつぶしていたため「あと1名」促進が一度も投稿されていなかった。
        // 参加者一覧のPATCH(上)は例外より前なので成功しており、外から見ると正常に見えていた。
        const prevStatus = computeDayStatus(currentLines, DAY_CAPACITY, dayKey);
        let promptContent = null;
        const rankNote = (def.key === 'sat' && nextStatus.dominantTierInfo?.rangeText)
          ? `（${nextStatus.dominantTierInfo.rangeText}対象）`
          : '';

        if (nextStatus.breakdown?.hasBreakdown) {
          const m1JustOne = nextStatus.breakdown.match1Remaining === 1 && (!existingLine || prevStatus.breakdown?.match1Remaining !== 1);
          const m2JustOne = nextStatus.breakdown.match2Remaining === 1 && (!existingLine || prevStatus.breakdown?.match2Remaining !== 1);

          if (m1JustOne) {
            promptContent = `🔥 **【${def.shortName}: 第1試合があと1名で開催確定！${rankNote}】** 21:00からの開幕戦にエントリーしませんか？✨`;
          } else if (m2JustOne && nextStatus.breakdown.isMatch1Ready) {
            promptContent = `🔥 **【${def.shortName}: 第2試合があと1名で10名到達！${rankNote}】** 2戦目からの途中合流で参加しませんか？✨`;
          }
        } else if (nextStatus.remaining === 1 && (!existingLine || prevStatus.remaining !== 1)) {
          promptContent = `🔥 **【${def.shortName}: あと1名で開催確定！${rankNote}】** どなたか最後の1枠で参加しませんか？✨`;
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
