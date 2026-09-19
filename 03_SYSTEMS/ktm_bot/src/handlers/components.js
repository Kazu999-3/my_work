import { CONFIG } from '../config.js';
import { fetchGAS, patchInteractionResponse, sendDiscordMessage, sendInteractionFollowup } from '../utils/api.js';
import { fetchSupabase } from '../utils/supabase.js';
import { handleLaneCommand, handleStatsCommand } from './commands.js';
import { generateChampionRoulette } from './roulette.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, extractPlayersFromEmbed, getPortalComponents, getPortalEmbed, handleHelpPage } from '../ui/embeds.js';
import { parseMessageData, handleAutoMatchEnd } from '../utils/helpers.js';
import { getAdminDiscordIds, markRecruitmentStatus } from '../utils/recruitPermission.js';
import { getKtmRank, getHighestLaneMmr, getPlayerExperienceBadge } from '../utils/ktmRank.js';
import { computeRecruitmentStatus, buildStatusBanner } from '../utils/recruitmentStatus.js';

export async function handleButtonInteraction(interaction, env, ctx) {
  let customId = interaction.data.custom_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // 募集主メニュー（セレクト）を、既存のボタン用アクションIDに読み替えて以降の処理をそのまま再利用する。
  // これで権限チェック等の既存ロジックを一切変えずにUIだけセレクト化できる。
  if (customId.startsWith('recruit_manage:') && Array.isArray(interaction.data.values) && interaction.data.values.length > 0) {
    const owner = customId.split(':')[1];
    const val = interaction.data.values[0];
    const map = { edit: 'edit_recruit_init', upgrade: 'upgrade_to_10', proxy: 'proxy_add_init', close: 'close', close_silent: 'close_silent', delete: 'delete_recruit' };
    if (map[val]) customId = `${map[val]}:${owner}`;
  } else if (customId.startsWith('recruit_manage:')) {
    // 何も選ばれずに閉じられた場合は募集メッセージをそのまま維持
    const metadata = parseMessageData(interaction.message);
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }

  // ロール選択セレクト（旧: Top/Jg/Mid/Adc/Sup の5ボタン）を、既存の join_role:role:owner
  // 用のIDに読み替えて以降の処理をそのまま再利用する(#①)。
  if (customId.startsWith('join_role_select:') && Array.isArray(interaction.data.values) && interaction.data.values.length > 0) {
    const owner = customId.split(':')[1];
    const role = interaction.data.values[0];
    customId = `join_role:${role}:${owner}`;
  } else if (customId.startsWith('join_role_select:')) {
    // 何も選ばれずに閉じられた場合は募集メッセージをそのまま維持
    const metadata = parseMessageData(interaction.message);
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }
  const appId = interaction.application_id;
  const token = interaction.token;
  const botToken = env.DISCORD_TOKEN;

  // 🎛️ ポータル・ウェルカム用共通ボタンハンドラー
  if (customId === 'portal_register') {
    return Response.json({
      type: 9,
      data: {
        title: "🎮 サモナー名 ＆ 希望レーン一括登録",
        custom_id: "portal_register_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ign",
                label: "LoL サモナー名 (Riot ID: 名前#Tag)",
                style: 1,
                placeholder: "例: りくや#JP1 / Faker#KR1",
                required: true,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "main",
                label: "メインレーン",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP / ALL",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "sub",
                label: "サブレーン (2番目に得意なレーン)",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP / なし",
                required: false,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "weight",
                label: "こだわり度 (1:絶対, 2:通常, 3:柔軟)",
                style: 1,
                placeholder: "1, 2, または 3 (未入力は2)",
                required: false,
                max_length: 2
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ng1",
                label: "NGレーン (行きたくないレーン)",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP (未入力可)",
                required: false,
                max_length: 10
              }
            ]
          }
        ]
      }
    });
  }

  if (customId === 'portal_ign') {
    return Response.json({
      type: 9,
      data: {
        title: "📝 サモナー名 (Riot ID) 登録",
        custom_id: "portal_ign_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ign",
                label: "LoL サモナー名 (Name#Tag)",
                style: 1,
                placeholder: "例: Faker#KR1 / りくや#JP1",
                required: true,
                max_length: 50
              }
            ]
          }
        ]
      }
    });
  }

  if (customId === 'portal_lane') {
    return Response.json({
      type: 9,
      data: {
        title: "📍 希望レーン・NGレーンの設定",
        custom_id: "portal_lane_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "main", label: "メインレーン", style: 1, placeholder: "TOP / JG / MID / ADC / SUP / ALL", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "sub", label: "サブレーン (2番目に得意)", style: 1, placeholder: "TOP / JG / MID / ADC / SUP", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "weight", label: "こだわり度 (1:絶対, 2:通常, 3:柔軟)", style: 1, placeholder: "1, 2, または 3 (未入力は2)", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "ng1", label: "NGレーン1 (行きたくないレーン)", style: 1, placeholder: "TOP / JG / MID / ADC / SUP", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "ng2", label: "NGレーン2", style: 1, placeholder: "TOP / JG / MID / ADC / SUP", required: false }] }
        ]
      }
    });
  }

  if (customId === 'portal_stats') {
    return handleStatsCommand(interaction, env, ctx);
  }

  if (customId === 'portal_roulette') {
    const result = generateChampionRoulette('ALL', 1);
    return Response.json({
      type: 4,
      data: {
        embeds: [result.embed],
        components: result.components,
        flags: 64 // 実行者のみに表示
      }
    });
  }

  if (customId === 'portal_recruit') {
    return Response.json({
      type: 9,
      data: {
        title: "⚔️ メンバー募集の作成",
        custom_id: "portal_recruit_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "ゲームモード", style: 1, placeholder: "ノーマル / カスタム / ARAM", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, placeholder: "21:00〜 / 今から", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "募集人数 (通常は 5 または 10)", style: 1, placeholder: "5 or 10", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 1, placeholder: "初心者歓迎！ VCあり", required: false }] }
        ]
      }
    });
  }

  if (customId === 'toggle_recruit_notification') {
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    if (!roleId) {
      return Response.json({ type: 4, data: { content: "⚠️ 通知ロールIDが設定されていません。", flags: 64 } });
    }

    const guildId = interaction.guild_id;
    if (!guildId) {
      return Response.json({ type: 4, data: { content: "⚠️ サーバーIDが取得できませんでした。", flags: 64 } });
    }

    const userRoles = interaction.member?.roles || [];
    const hasRole = userRoles.includes(roleId);

    ctx.waitUntil((async () => {
      try {
        if (hasRole) {
          // ロール削除
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bot ${botToken}`
            }
          });
          if (!res.ok) throw new Error(`Role removal failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, { content: "🔔 **募集通知ロールを解除しました。**\n以降、メンバー募集時の通知は届きません。" });
        } else {
          // ロール付与
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bot ${botToken}`,
              "Content-Length": "0"
            }
          });
          if (!res.ok) throw new Error(`Role assignment failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, { content: "🔔 **募集通知ロールを付与しました！**\n以降、メンバー募集時に通知（メンション）が届くようになります。" });
        }
      } catch (err) {
        console.error("Toggle Role Error:", err);
        try {
          await patchInteractionResponse(appId, token, { content: `❌ **ロール操作エラー**: ${err.message}\nBotのロール権限の順位を確認してください。` });
        } catch (e) {}
      }
    })());

    return Response.json({ type: 5, data: { flags: 64 } });
  }

  // 代替クイック募集ボタン（ノーマル / ARAM・メイヘム）
  if (customId === 'quick_substitute_normal' || customId === 'quick_substitute_aram') {
    const isNormal = customId === 'quick_substitute_normal';
    const modeLabel = isNormal ? '🎮 代替ノーマル' : '🔥 代替ARAM/メイヘム';
    const userMention = `<@${userId}>`;

    ctx.waitUntil((async () => {
      try {
        const msgId = interaction.message.id;
        const channelId = interaction.channel_id;

        const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
          headers: { "Authorization": `Bot ${botToken}` }
        });
        if (!msgRes.ok) return;
        const msg = await msgRes.json();
        let content = msg.content || '';

        let targetLines = content.split('\n');
        const userLineIdx = targetLines.findIndex(l => l.includes(userMention));

        if (userLineIdx >= 0) {
          // 既にエントリーしている場合は解除
          targetLines = targetLines.filter(l => !l.includes(userMention));
        } else {
          // エントリー追加
          targetLines.push(`- ${userMention} (${modeLabel})`);
        }

        const count = targetLines.filter(l => l.startsWith('- <@')).length;
        const updatedContent = targetLines.join('\n');

        // ボタンのラベルを更新（現在の参加人数）
        const components = msg.components?.map(row => ({
          ...row,
          components: row.components.map(btn => {
            if (btn.custom_id === customId) {
              return { ...btn, label: isNormal ? `🎮 ノーマル行く人！ (${count}/5)` : `🔥 ARAM / メイヘムやる人！ (${count}/5)` };
            }
            return btn;
          })
        })) || msg.components;

        await sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
          content: updatedContent,
          components
        });
      } catch (e) {
        console.error('quick_substitute error:', e);
      }
    })());

    return Response.json({ type: 5, data: { flags: 64 } });
  }

  if (customId.startsWith('join_periodic:') || customId.startsWith('join_periodic_auto') || customId.startsWith('join_periodic_sunday')) {
    // join_periodic_auto:style : 土曜カスタム（代表MMRからシルバー以下/ゴルプラへ自動振り分け）
    // join_periodic_sunday:style : 日曜お祭りカスタム（ランク不問/MMR変動なし）
    // style: 'full' | 'single' | 'late'
    const parts = customId.split(':');
    const isSundayMode = customId.startsWith('join_periodic_sunday');
    const isAutoMode = customId.startsWith('join_periodic_auto');
    const participationStyle = parts.length > 1 ? parts[1] : 'full'; // 'full' | 'single' | 'late'

    let styleBadge = " 🟢フル";
    if (participationStyle === 'single') styleBadge = " ⏱️1戦のみ";
    else if (participationStyle === 'late') styleBadge = " 🌙途中参加(2戦目〜)";

    const userMention = `<@${userId}>`;

    ctx.waitUntil((async () => {
      try {
        const msgId = interaction.message.id;
        const channelId = interaction.channel_id;

        const [msgRes, playerRow] = await Promise.all([
          fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
            headers: { "Authorization": `Bot ${botToken}` }
          }),
          fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,role_preferences,name,total_games,recent_games_30d,days_since_last_match`)
            .then((rows) => (rows && rows.length > 0 ? rows[0] : null))
            .catch((e) => { console.warn('join_periodic: 名簿取得に失敗:', e); return null; }),
        ]);

        let roomType = null;
        if (isSundayMode) {
          roomType = 'sunday';
        } else if (isAutoMode) {
          const mmr = playerRow ? getHighestLaneMmr(playerRow) : null;
          const tier = getKtmRank(mmr ?? 0);
          roomType = tier.min >= 1350 ? 'gold' : 'silver';
        } else {
          roomType = parts[0].split(':')[1] || 'silver'; // silver or gold
        }

        if (!msgRes.ok) throw new Error("メッセージ取得失敗");

        const msg = await msgRes.json();
        const embeds = msg.embeds || [];
        if (embeds.length === 0) throw new Error("Embedが見つかりません");

        const targetEmbed = { ...embeds[0] };
        targetEmbed.fields = targetEmbed.fields ? [...targetEmbed.fields] : [];

        // フィールド0: 土曜本戦カスタム (最多ランク基準自動マッチング), フィールド1: 日曜お祭りカスタム
        if (!targetEmbed.fields[0]) targetEmbed.fields[0] = { name: "⚔️ 【土曜・本戦カスタム】 (0/10名) 🎯 基準: 未定 (最多帯自動編成)", value: "▫ 参加者: なし", inline: false };
        if (!targetEmbed.fields[1]) targetEmbed.fields[1] = { name: "🎪 【日曜・お祭り部門】 (0/10名) 🎲 ランク不問 (MMRなし)", value: "▫ 参加者: なし", inline: false };

        const targetFieldIdx = isSundayMode ? 1 : 0;
        const targetText = targetEmbed.fields[targetFieldIdx]?.value || "";
        const existingLine = targetText.split('\n').find(l => l.includes(userMention));
        const isAlreadyInTarget = !!existingLine;
        const isSameStyle = existingLine && existingLine.includes(styleBadge);

        // ランク＆レーン希望＆経験度バッジ文字列の作成
        const RANK_JP_MAP = {
          CHALLENGER: 'チャレンジャー', GRANDMASTER: 'グランドマスター', MASTER: 'マスター',
          DIAMOND: 'ダイヤ', EMERALD: 'エメラルド', PLATINUM: 'プラチナ',
          GOLD: 'ゴールド', SILVER: 'シルバー', BRONZE: 'ブロンズ', IRON: 'アイアン',
          UNRANKED: '未ランク'
        };

        const expBadgeObj = getPlayerExperienceBadge(playerRow);
        const expBadgeStr = ` ${expBadgeObj.short}`;

        let rankStr = "";
        if (playerRow) {
          const mmr = getHighestLaneMmr(playerRow);
          const tier = getKtmRank(mmr ?? 0);
          if (tier && tier.name) {
            const jpName = RANK_JP_MAP[tier.name] || tier.name;
            rankStr = ` 【${jpName}】`;
          }
        }

        let lanePrefStr = "";
        try {
          let pref = playerRow?.role_preferences;
          if (typeof pref === 'string') {
            try { pref = JSON.parse(pref); } catch (e) {}
          }
          if (pref && (pref.primary || pref.secondary)) {
            const p1 = pref.primary || "指定なし";
            const p2 = pref.secondary || "指定なし";
            lanePrefStr = ` 【第1: ${p1} / 第2: ${p2}】`;
          }
        } catch (e) {
          console.warn("role_preferences parse error:", e);
        }

        const fullEntryBadge = `${expBadgeStr}${rankStr}${lanePrefStr}`;

        if (isSundayMode) {
          // 日曜部門のトグル/スタイル変更（土曜には触らない）
          let fLines = (targetEmbed.fields[1].value || "").split('\n');
          fLines = fLines.filter(l => l.startsWith('- ') && !l.includes(userMention));

          if (!isAlreadyInTarget || !isSameStyle) {
            fLines.push(`- ${userMention}${styleBadge}${expBadgeStr}${lanePrefStr}`);
          }
          const count = fLines.length;
          targetEmbed.fields[1].name = `🎪 【日曜・お祭り部門】 (${count}/10名) 🎲 ランク不問 (MMRなし)`;
          targetEmbed.fields[1].value = fLines.length > 0 ? fLines.join('\n') : "▫ 参加者: なし\n※対象: 全員OK！特殊ルール/ランダム/オフメタ等大歓迎（MMR変動なし）";
        } else {
          // 土曜本戦カスタムのトグル/スタイル変更
          let fLines = (targetEmbed.fields[0].value || "").split('\n');
          fLines = fLines.filter(l => l.startsWith('- ') && !l.includes(userMention));

          if (!isAlreadyInTarget || !isSameStyle) {
            fLines.push(`- ${userMention}${styleBadge}${fullEntryBadge}`);
          }
          const count = fLines.length;

          // 参加者全体のランク分布と最多ランク帯（ボリュームゾーン）を集計
          // ルール: エメラルド以上はプラチナに合算、アイアン・未ランクはブロンズに合算
          let dominantTierName = "未定";
          if (count > 0) {
            const tierCounts = {};
            fLines.forEach(line => {
              const match = line.match(/【(アイアン|ブロンズ|シルバー|ゴールド|プラチナ|エメラルド|ダイヤ|マスター|チャレンジャー|グランドマスター|未ランク|IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND|MASTER|GRANDMASTER|CHALLENGER|UNRANKED)/i);
              const rawT = match ? match[1].toUpperCase() : "SILVER";
              let jpT = RANK_JP_MAP[rawT] || match?.[1] || "シルバー";

              // ルール適用：エメラルド以上 ➔ プラチナ合算 / アイアン・未ランク ➔ ブロンズ合算
              if (['チャレンジャー', 'グランドマスター', 'マスター', 'ダイヤ', 'エメラルド', 'プラチナ'].includes(jpT)) {
                jpT = 'プラチナ';
              } else if (['アイアン', '未ランク', 'ブロンズ'].includes(jpT)) {
                jpT = 'ブロンズ';
              }

              tierCounts[jpT] = (tierCounts[jpT] || 0) + 1;
            });
            let maxCount = 0;
            for (const [t, c] of Object.entries(tierCounts)) {
              if (c > maxCount) {
                maxCount = c;
                dominantTierName = `${t}帯(${c}名)`;
              }
            }
          }

          targetEmbed.fields[0].name = `⚔️ 【土曜・本戦カスタム】 (${count}/10名) 🎯 基準: ${dominantTierName} (※MMR基準)`;
          targetEmbed.fields[0].value = fLines.length > 0 ? fLines.join('\n') : "▫ 参加者: なし\n※対象: 全員エントリーOK！最も集まったKTM内戦MMR帯を基準に実力均等チーム分け";
        }

        // 参加メンバーの経験層分析（ユニーク参加者を集計）
        const satLines = (targetEmbed.fields[0]?.value || "").split('\n').filter(l => l.startsWith('- '));
        const sunLines = (targetEmbed.fields[1]?.value || "").split('\n').filter(l => l.startsWith('- '));
        const allLines = [...satLines, ...sunLines];

        const userExpMap = new Map();
        for (const line of allLines) {
          const uMatch = line.match(/<@(\d+)>/);
          if (!uMatch) continue;
          const uid = uMatch[1];
          if (userExpMap.has(uid)) continue;

          let tier = 'regular';
          if (line.includes('🔰初参加') || line.includes('🔰 初参加')) tier = 'new';
          else if (line.includes('🌱ライト') || line.includes('🌱 ライト')) tier = 'light';
          else if (line.includes('⏳復帰勢') || line.includes('⏳ 復帰勢') || line.includes('🎖️経験者') || line.includes('🎖️ 経験者')) tier = 'returning';
          else if (line.includes('👑常連') || line.includes('👑 常連')) tier = 'regular';
          else {
            // バッジ表記がない過去の行等の場合はデフォルト
            tier = 'regular';
          }
          userExpMap.set(uid, tier);
        }

        const totalUniqueUsers = userExpMap.size;
        if (totalUniqueUsers > 0) {
          let newCnt = 0;
          let lightCnt = 0;
          let returningCnt = 0;
          let regularCnt = 0;

          for (const t of userExpMap.values()) {
            if (t === 'new') newCnt++;
            else if (t === 'light') lightCnt++;
            else if (t === 'returning') returningCnt++;
            else if (t === 'regular') regularCnt++;
          }

          const ratio = Math.round(((newCnt + lightCnt + returningCnt) / totalUniqueUsers) * 100);
          const expField = {
            name: `👥 参加メンバーの経験層分析 (${totalUniqueUsers}名)`,
            value: `🔰初参加: **${newCnt}名** | 🌱ライト: **${lightCnt}名** | ⏳復帰勢: **${returningCnt}名** | 👑常連: **${regularCnt}名**\n✨ 初心者・復帰勢歓迎！ (新規・ライト・復帰層: **${ratio}%**)`,
            inline: false
          };

          const expIdx = targetEmbed.fields.findIndex(f => f.name.includes("経験層分析"));
          if (expIdx >= 0) {
            targetEmbed.fields[expIdx] = expField;
          } else {
            targetEmbed.fields.push(expField);
          }
        } else {
          // 参加者が0名の場合は経験層分析フィールドを削除
          targetEmbed.fields = targetEmbed.fields.filter(f => !f.name.includes("経験層分析"));
        }

        // 3. 最新の参加人数とステータスバナー作成
        const satCount = (targetEmbed.fields[0]?.value || "").split('\n').filter(l => l.startsWith('- ')).length;
        const sunCount = (targetEmbed.fields[1]?.value || "").split('\n').filter(l => l.startsWith('- ')).length;

        const recruitStatus = computeRecruitmentStatus(satCount, sunCount);
        const dominantMatch = (targetEmbed.fields[0]?.name || "").match(/🎯 基準: (.+)$/);
        const dominantTierText = dominantMatch ? dominantMatch[1] : '';
        const statusBanner = buildStatusBanner(recruitStatus, dominantTierText);
        targetEmbed.color = recruitStatus.color;

        const BANNER_PATTERN = /(?:[🚨🔥🟡✅⚡]\s*)?\*\*【(?:シルバー以下\s*あと\d+名|定期カスタム募集中|週末定期カスタム募集中|開催確定部門あり|合計\d+名到達|全枠10名満員御礼|全部門10名達成)[^】]*】\*\*(?:\n[^\n]+){1,5}/;
        const updateTextWithStatus = (text) => {
          if (!text) return text;
          if (BANNER_PATTERN.test(text)) {
            return text.replace(new RegExp(BANNER_PATTERN.source, 'g'), statusBanner);
          }
          return text;
        };

        if (targetEmbed.description) {
          targetEmbed.description = updateTextWithStatus(targetEmbed.description);
        }

        const updatedContent = updateTextWithStatus(interaction.message.content);

        // 押されたメッセージ自体の更新と、同期対象を探すための直近メッセージ一覧取得・
        // DBに永続化されている「定期カスタム募集」本カードの直接取得を並列実行。
        // 以前は直近15件の検索のみに頼っており、チャンネルの他投稿がその間に15件を
        // 超えると本カードが同期対象から漏れて色・人数が古いまま固着し得た
        // (2026-08-13、KTM運営Bot監査#20で発覚)。Discord APIの上限である100件まで
        // 検索範囲を広げた上で、recruitmentsテーブルに永続化されている本カードのIDは
        // 検索に頼らず直接取得して確実に同期対象へ含める(事前告知/メンバー状況カードは
        // DBに追跡列が無いため引き続き検索頼みだが、上限拡大で漏れの可能性は大幅に減る)。
        const [, channelMsgsRes, mainCardRow] = await Promise.all([
          sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
            content: updatedContent,
            embeds: [targetEmbed],
            components: interaction.message.components
          }),
          fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=100`, {
            headers: { "Authorization": `Bot ${botToken}` }
          }).catch(() => null),
          fetchSupabase(env, 'recruitments', `mode=eq.${encodeURIComponent('定期カスタム')}&status=eq.open&discord_channel_id=eq.${channelId}&select=discord_message_id&order=created_at.desc&limit=1`)
            .then((rows) => (rows && rows.length > 0 ? rows[0] : null))
            .catch(() => null),
        ]);

        // チャンネル内の直近メッセージから「募集カード」と「アナウンス通知」の両方を検索して完全同期
        try {
          const relatedMsgs = [];
          const seenIds = new Set([msgId]);

          if (channelMsgsRes && channelMsgsRes.ok) {
            const channelMsgs = await channelMsgsRes.json();
            for (const m of channelMsgs) {
              if (seenIds.has(m.id) || !m.author?.bot) continue;
              const matches =
                (m.embeds?.[0]?.title && (m.embeds[0].title.includes("定期カスタム") || m.embeds[0].title.includes("事前告知") || m.embeds[0].title.includes("メンバー状況"))) ||
                (m.content && m.content.includes("【定期カスタム募集】"));
              if (matches) { relatedMsgs.push(m); seenIds.add(m.id); }
            }
          }

          // DB永続化されている本カードが検索範囲(100件)からも漏れていた場合の最終保険。
          if (mainCardRow?.discord_message_id && !seenIds.has(mainCardRow.discord_message_id)) {
            try {
              const mainMsgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${mainCardRow.discord_message_id}`, {
                headers: { "Authorization": `Bot ${botToken}` }
              });
              if (mainMsgRes.ok) {
                relatedMsgs.push(await mainMsgRes.json());
                seenIds.add(mainCardRow.discord_message_id);
              }
            } catch (e) {
              console.warn("main recruitment card direct fetch failed:", e);
            }
          }

          {
            // 各メッセージは独立した書き込み先なので並列実行して一元更新
            await Promise.all(relatedMsgs.map((relMsg) => {
              const relEmbed = relMsg.embeds?.[0] ? { ...relMsg.embeds[0] } : null;
              if (relEmbed) {
                relEmbed.fields = targetEmbed.fields; // フィールドを完全同期
                relEmbed.color = targetEmbed.color; // 色(混合カスタム到達サイン等)も同期
                if (relEmbed.description) {
                  relEmbed.description = updateTextWithStatus(relEmbed.description);
                }
              }
              const relContent = updateTextWithStatus(relMsg.content);

              return sendDiscordMessage(`channels/${channelId}/messages/${relMsg.id}`, botToken, "PATCH", {
                content: relContent,
                embeds: relEmbed ? [relEmbed] : relMsg.embeds,
                components: relMsg.components
              }).catch(() => {});
            }));
          }
        } catch (syncErr) {
          console.warn("Dual card sync warning:", syncErr);
        }

      } catch (err) {
        console.error("join_periodic error:", err);
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

  const isPortalAction = customId.startsWith('portal_') || customId.startsWith('admin_');
  if (isPortalAction && !customId.startsWith('admin_fix_match_submit') && customId !== 'portal_menu_cancel') {
    const value = customId;
    const channelId = interaction.channel_id;
    const messageId = interaction.message.id;
    // resetPortal is not needed for buttons since they don't hold "selected" state, but we can still patch the message if we want, or do nothing.
    
    if (value === 'portal_recruit') return Response.json({
      type: 9, data: {
        title: "⚔️ 新規メンバー募集の設定", custom_id: "portal_recruit_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "モード", style: 1, value: "ノーマル", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "最大人数", style: 1, value: "5", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 2, required: false }] }
        ]
      }
    });
    if (value === 'portal_stats') return handleStatsCommand(interaction, env, ctx);
    if (value === 'portal_lane') return handleLaneCommand(interaction, env, ctx);
    if (value === 'portal_ign') return Response.json({ type: 9, data: { title: "📝 サモナー名登録", custom_id: "portal_ign_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "ign", label: "サモナー名 (Riot ID#Tag)", style: 1, placeholder: "Faker#KR1", required: true }] }] } });
    
    if (value === 'admin_fix_match') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      return Response.json({ type: 9, data: { title: "🛠️ 勝敗修正", custom_id: "admin_fix_match_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "winner", label: "正しい勝利チーム", style: 1, required: true }] }] } });
    }
    if (value === 'admin_adjust_mmr') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      return Response.json({ type: 9, data: { title: "🛠️ MMR 手動調整", custom_id: "admin_adjust_mmr_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "target", label: "対象名", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "role", label: "ロール", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "amount", label: "新しいMMR", style: 1, required: true }] }] } });
    }
    if (value === 'portal_help') return Response.json({ type: 4, data: { ...handleHelpPage(), flags: 64 } });
    
    if (value === 'admin_sync_ranks') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      const discordName = interaction.member?.user?.global_name || interaction.member?.user?.username;
      ctx.waitUntil((async () => {
        try {
          const { fetchPortalAPI } = await import('../utils/api.js');
          const gasData = await fetchPortalAPI(env, '/api/riot/sync-ranks', { discordName });
          await patchInteractionResponse(appId, token, { content: `✅ **同期完了**: ${gasData.message}`, components: [] });
        } catch (err) {
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
          await sendInteractionFollowup(appId, token, { content: `❌ **同期エラー**: ${err.message}`, flags: 64 });
        }
      })());
      return Response.json({ type: 7, data: { content: "⌛ Riot API と同期中です（最大5分）...", components: [] } });
    }
    if (value === 'admin_init_mmr') {
      return Response.json({
        type: 4, data: {
          content: "🛡️ **MMRの一括初期化を実行しますか？**",
          components: [{ type: 1, components: [{ type: 2, label: "⚠️ 全員上書き", style: 4, custom_id: "exec_init_mmr:all" }, { type: 2, label: "✅ 未設定のみ", style: 3, custom_id: "exec_init_mmr:new_only" }, { type: 2, label: "キャンセル", style: 2, custom_id: "portal_menu_cancel" }] }],
          flags: 64
        }
      });
    }
  }

  // 即募集(D-08): デフォルト設定でその場で募集を投下
  if (customId.startsWith('quick_recruit:')) {
    const [, qMode, qMax] = customId.split(':');
    const ownerName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || "不明";
    const metadata = {
      mode: qMode, time: '', maxCount: parseInt(qMax) || 10, memo: '',
      owner: userId, createdAt: new Date().toISOString(), joined: [], spectating: [],
      roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: { [userId]: ownerName }
    };
    ctx.waitUntil((async () => {
      try {
        const res = await sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, botToken, "POST", {
          content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata)
        });
        const sentMessage = await res.clone().json();
        const { createRecruitment } = await import('../utils/recruitPermission.js');
        await createRecruitment(env, {
          messageId: sentMessage.id, channelId: CONFIG.RECRUIT_CHANNEL_ID,
          ownerDiscordId: userId, mode: qMode, maxCount: parseInt(qMax) || 10,
        });
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/push/notify-recruit', { mode: qMode, time: '' }).catch(() => {});
      } catch (e) { console.error("quick_recruit error:", e); }
    })());
    return Response.json({ type: 4, data: { content: `⚡ **${qMode}${qMax}人の募集を #募集板 に投下しました！**（時刻やメモは「⚙️募集編集」で後から設定できます）`, flags: 64 } });
  }

  if (customId === 'portal_menu_cancel') return Response.json({ type: 7, data: { content: "✅ 操作をキャンセルしました。", components: [] } });

  if (customId.startsWith('exec_init_mmr:')) {
    if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ この操作は管理者のみ実行可能です。", flags: 64 } });
    const isOverwriteAll = (customId.split(':')[1] === 'all');
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../utils/api.js');
        const gasData = await fetchPortalAPI(env, '/api/admin/init-mmr', { isOverwriteAll });
        await patchInteractionResponse(appId, token, { content: `✅ **実行完了**: ${gasData.message}`, components: [] });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());
    return Response.json({ type: 7, data: { content: "⌛ 処理を開始しました。少々お待ちください...", components: [] } });
  }

  if (customId.startsWith('win_blue:') || customId.startsWith('win_red:')) {
    const winner = customId.startsWith('win_blue') ? "BLUE" : "RED";
    const players = extractPlayersFromEmbed(interaction.message.embeds[0]);
    return await handleAutoMatchEnd(interaction, players, winner, env, ctx);
  }

  if (customId === 'opgg_scout') {
    const players = extractPlayersFromEmbed(interaction.message.embeds[0]);
    if (players.length === 0) return Response.json({ type: 4, data: { content: "⚠️ プレイヤー情報が見つかりません。", flags: 64 } });
    
    const teamA = players.filter(p => p.team === 'BLUE').map(p => p.name);
    const teamB = players.filter(p => p.team === 'RED').map(p => p.name);
    
    ctx.waitUntil((async () => {
      try {
        const { getPlayersByNames } = await import('../utils/supabase.js');
        const allNames = [...teamA, ...teamB];
        const playersData = await getPlayersByNames(env, allNames);
        
        const getIgn = (name) => {
          const p = playersData.find(pd => pd.name === name);
          return p && p.ign && p.ign.includes('#') ? encodeURIComponent(p.ign) : null;
        };

        const blueIgns = teamA.map(getIgn).filter(ign => ign !== null);
        const redIgns = teamB.map(getIgn).filter(ign => ign !== null);

        let content = "🕵️ **OP.GG スカウティングレポート**\n以下のリンクから両チームの詳細な戦績を確認できます。\n\n";
        
        if (blueIgns.length > 0) {
          content += `🟦 **TEAM BLUE**\nhttps://www.op.gg/multisearch/jp?summoners=${blueIgns.join(encodeURIComponent(','))}\n\n`;
        } else {
          content += `🟦 **TEAM BLUE**: 登録されているIGNがありません\n\n`;
        }
        
        if (redIgns.length > 0) {
          content += `🟥 **TEAM RED**\nhttps://www.op.gg/multisearch/jp?summoners=${redIgns.join(encodeURIComponent(','))}`;
        } else {
          content += `🟥 **TEAM RED**: 登録されているIGNがありません`;
        }
        
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: content, flags: 64 });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());
    
    return Response.json({ type: 5, data: { flags: 64 } });
  }



  // 募集パネル操作
  const metadata = parseMessageData(interaction.message);
  const userName = interaction.member.user.global_name || interaction.member.user.username;
  if (customId.includes(':')) metadata.owner = customId.split(':').pop();

  // 募集主 または システム管理者(env.ADMIN_DISCORD_IDS)を編集・削除許可対象とする（課題②）
  const adminIds = getAdminDiscordIds(env);
  const canManageRecruitment = userId === metadata.owner || adminIds.includes(userId);

  if (customId.startsWith('delete_recruit')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ削除可能です。", flags: 64 } });
    ctx.waitUntil((async () => {
      try {
        await markRecruitmentStatus(env, interaction.message.id, 'deleted');
        const targetIds = [...new Set([metadata.owner, ...(metadata.joined || [])])].filter(Boolean);
        if (targetIds.length > 0) {
          const mentions = targetIds.map(id => `<@${id}>`).join(" ");
          const channelId = interaction.channel_id || interaction.channel?.id;
          const notifyContent = `🗑️ **【募集終了】募集主により募集が削除（解散）されました。**\n参加者の皆様、エントリーありがとうございました。\n通知: ${mentions}`;
          if (channelId && botToken) {
            await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
              content: notifyContent,
              message_reference: { message_id: interaction.message.id },
              allowed_mentions: { users: targetIds }
            }).catch(e => console.error("募集削除通知の送信に失敗:", e));
          }
        }
      } catch (e) {
        console.error("recruitments テーブルの削除反映に失敗:", e);
      }
    })());
    return Response.json({ type: 7, data: { content: "🗑️ この募集は削除されました。", embeds: [], components: [] } });
  }

  if (customId.startsWith('edit_recruit_init')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ編集可能です。", flags: 64 } });
    return Response.json({
      type: 9, data: {
        title: "⚙️ 募集内容の編集", custom_id: `edit_recruit_modal:${metadata.owner}`,
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "モード", style: 1, value: metadata.mode, required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, value: metadata.time || "", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "最大人数", style: 1, value: metadata.maxCount.toString(), required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 2, value: metadata.memo || "", required: false }] }
        ]
      }
    });
  }

  if (customId.startsWith('proxy_add_init')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ代理追加可能です。", flags: 64 } });
    return Response.json({
      type: 9, data: {
        title: "➕ メンバーの代理追加", custom_id: `proxy_add_modal:${metadata.owner}`,
        components: [
          { type: 1, components: [{ type: 4, custom_id: "player_name", label: "プレイヤー名（または Discord 表示名）", style: 1, placeholder: "例: 助っ人A / たろう", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "role", label: "参加ロール（任意: TOP/JG/MID/ADC/SUP）", style: 1, placeholder: "空欄なら「指定なし」", required: false }] }
        ]
      }
    });
  }

  // join_any/join_role は同時押しされやすく、interaction.message は「押した瞬間」の
  // スナップショットで古くなりがちなので、直前にメッセージを取り直して競合の窓を狭める
  // （完全な排他制御ではないが、join_periodicと同じ緩和策）。
  const refreshJoinMetadata = async () => {
    try {
      const freshRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages/${interaction.message.id}`, {
        headers: { "Authorization": `Bot ${botToken}` }
      });
      if (freshRes.ok) {
        Object.assign(metadata, parseMessageData(await freshRes.json()));
      }
    } catch (e) {
      console.warn("join: 最新状態の再取得に失敗、インタラクションのスナップショットで続行:", e);
    }
  };

  if (customId.startsWith('upgrade_to_10')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ拡張可能です。", flags: 64 } });
    metadata.mode = 'カスタム'; metadata.maxCount = 10;
  } else if (customId.startsWith('join_any')) {
    await refreshJoinMetadata();
    if (metadata.joined.includes(userId) && !Object.values(metadata.roles).includes(userId)) {
      // 二度押しで離脱
      metadata.joined = metadata.joined.filter(id => id !== userId);
    } else if (metadata.joined.length < metadata.maxCount) {
      if (!metadata.joined.includes(userId)) {
        metadata.joined.push(userId);
        // 初参加(レーン未設定)ならセットアップ案内をDM
        ctx.waitUntil(sendOnboardingIfNeeded(env, userId));
      }
      metadata.names[userId] = userName;
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
    }
  } else if (customId.startsWith('join_role:')) {
    const role = customId.split(':')[1];
    await refreshJoinMetadata();
    if (metadata.roles[role] === userId) {
      // 二度押しで離脱
      metadata.roles[role] = null;
      metadata.joined = metadata.joined.filter(id => id !== userId);
    } else {
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
      if (!metadata.roles[role] && metadata.joined.length < metadata.maxCount) {
        metadata.roles[role] = userId; metadata.names[userId] = userName;
        if (!metadata.joined.includes(userId)) metadata.joined.push(userId);
        metadata.spectating = metadata.spectating.filter(id => id !== userId);
      }
    }
  } else if (customId.startsWith('toggle_spectate')) {
    await refreshJoinMetadata();
    if (!metadata.spectating) metadata.spectating = [];
    if (metadata.spectating.includes(userId)) {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
    } else {
      metadata.spectating.push(userId);
      metadata.joined = metadata.joined.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
      metadata.names[userId] = userName;
    }
  } else if (customId.startsWith('leave_recruit')) {
    await refreshJoinMetadata();
    metadata.joined = metadata.joined.filter(id => id !== userId);
    if (metadata.spectating) {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
    }
    Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
  } else if (customId.startsWith('close_silent') || customId.startsWith('close')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ募集終了可能です。", flags: 64 } });
    const isSilent = customId.startsWith('close_silent');

    // 募集終了→ボタンなしで閉じる（サイレント以外は参加者に解散・締切通知メッセージを送信）
    // recruitmentsテーブルのstatusも'closed'に反映し、ポータル側が古い募集を
    // 「進行中」として拾い続けないようにする。
    ctx.waitUntil((async () => {
      try {
        await markRecruitmentStatus(env, interaction.message.id, 'closed');
        if (!isSilent) {
          const targetIds = [...new Set([metadata.owner, ...(metadata.joined || [])])].filter(Boolean);
          if (targetIds.length > 0) {
            const mentions = targetIds.map(id => `<@${id}>`).join(" ");
            const isFull = (metadata.joined || []).length >= (metadata.maxCount || 5);
            const channelId = interaction.channel_id || interaction.channel?.id;
            const notifyContent = isFull
              ? `🏁 **【募集終了】** 募集が締め切られました。\n通知: ${mentions}`
              : `⚠️ **【募集終了】人が集まらなかったため、この募集は終了（解散）となりました。**\n参加者の皆様、エントリーありがとうございました！またの機会にご参加ください。\n通知: ${mentions}`;
            
            if (channelId && botToken) {
              await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
                content: notifyContent,
                message_reference: { message_id: interaction.message.id },
                allowed_mentions: { users: targetIds }
              }).catch(e => console.error("募集終了通知の送信に失敗:", e));
            } else {
              await sendInteractionFollowup(appId, token, {
                content: notifyContent,
                allowed_mentions: { users: targetIds }
              }).catch(e => console.error("募集終了Followup送信に失敗:", e));
            }
          }
        }
      } catch (e) {
        console.error("recruitments テーブルの終了反映に失敗:", e);
      }
    })());
    const embed = createRecruitEmbed(metadata);
    embed.title = isSilent ? "🔕 募集終了" : "🚨 募集終了";
    embed.color = 0xff0000;
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [embed], components: [] } });
  }

  // 自動締切 & メンション (チーム分けは手動ボタンで実行)
  if (metadata.joined.length >= metadata.maxCount && (customId.startsWith('join_any') || customId.startsWith('join_role:'))) {
    ctx.waitUntil((async () => {
      const mentions = [...new Set([metadata.owner, ...metadata.joined])].map(id => `<@${id}>`).join(" ");

      // 満員時に参加者の希望レーン状況をまとめて投稿（チーム分けの参考に）。
      // ポータルでチーム分けするカスタムのみ対象。ノーマル/ARAMでは不要。
      let laneEmbed = null;
      try {
        if (metadata.mode !== 'カスタム') throw new Error('skip:not-custom');
        const { fetchSupabase } = await import('../utils/supabase.js');
        const ids = [...new Set([metadata.owner, ...metadata.joined])];
        const idsStr = ids.map((i) => `"${i}"`).join(',');
        const dbPlayers = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,name,role_preferences,ng_lane_1,ng_lane_2`);
        const roleCount = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0, ALL: 0 };
        const lines = ids.map((id) => {
          const p = (dbPlayers || []).find((x) => x.discord_id === id);
          const nm = metadata.names[id] || p?.name || '不明';
          if (!p || !p.role_preferences?.primary) return `▫️ **${nm}**: 未設定（/lane か「📍レーン設定」で登録を！）`;
          const pr = (p.role_preferences.primary || '-').toUpperCase();
          const sc = (p.role_preferences.secondary || '-').toUpperCase();
          if (roleCount[pr] !== undefined) roleCount[pr]++;
          const ng = [p.ng_lane_1, p.ng_lane_2].filter((v) => v && v !== '-').join(',');
          return `▫️ **${nm}**: ${pr} / ${sc}${ng ? `（NG: ${ng}）` : ''}`;
        });
        // レーン希望を「メイン＋サブ」でカバー人数として集計し、不足レーンを一目で分かるようにする
        const cover = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 };
        (dbPlayers || []).forEach((p) => {
          const pr = (p.role_preferences?.primary || '').toUpperCase();
          const sc = (p.role_preferences?.secondary || '').toUpperCase();
          ['TOP', 'JG', 'MID', 'ADC', 'SUP'].forEach((r) => {
            if (pr === r || sc === r || pr === 'ALL' || sc === 'ALL') cover[r]++;
          });
        });
        const bar = (n) => (n === 0 ? '🚨不足' : n === 1 ? '⚠️1人' : `${n}人`);
        const countLine =
          `**レーン希望（第一希望 / 対応可能）**\n` +
          `\`TOP\` ${roleCount.TOP} / ${bar(cover.TOP)}　\`JG \` ${roleCount.JG} / ${bar(cover.JG)}　\`MID\` ${roleCount.MID} / ${bar(cover.MID)}\n` +
          `\`ADC\` ${roleCount.ADC} / ${bar(cover.ADC)}　\`SUP\` ${roleCount.SUP} / ${bar(cover.SUP)}` +
          (roleCount.ALL ? `　（ALL希望 ${roleCount.ALL}名）` : '');

        // ランク内訳の表示は定期募集(定期カスタム)のみに限定し、都度募集(この募集パネル)には出さない(#③)
        laneEmbed = {
          title: '📍 参加者の希望レーン状況',
          description: `${countLine}\n\n${lines.join('\n')}`,
          color: 0x3498db,
          footer: { text: '表記: メイン / サブ（NG）。ポータルのチーム分けで自動考慮されます。' }
        };
      } catch (e) {
        if (String(e?.message) !== 'skip:not-custom') console.warn('lane summary failed:', e);
      }

      // 🪙 募集成立ボーナス（募集主+100〜200、参加者+50〜100）
      try {
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/bet/recruit-reward', {
          mode: metadata.mode,
          ownerDiscordId: metadata.owner,
          ownerName: metadata.names[metadata.owner],
          joinedDiscordIds: metadata.joined,
          joinedNames: metadata.joined.map(id => metadata.names[id]).filter(Boolean)
        });
      } catch (rewardErr) {
        console.warn('Recruit reward API error:', rewardErr);
      }

      await sendInteractionFollowup(appId, token, {
        content: `⚔️ **メンバー確定！** 対戦準備を開始してください。\n通知: ${mentions}`,
        ...(laneEmbed ? { embeds: [laneEmbed] } : {})
      });
    })());
    
    const closingMessage = (metadata.mode === 'ノーマル' || metadata.mode === 'ARAM')
      ? "\n🚨 **定員に達しました。対戦準備を開始してください！**" 
      : "\n🚨 **定員に達したため締め切りました。ポータル画面からチーム分けを行ってください。**";
      
    return Response.json({ type: 7, data: { content: createMessageContent(metadata) + closingMessage, embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }

  // ランク帯の内訳表示は定期募集のみに限定するため、都度募集のここでは付与しない(#③)
  return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
}

/**
 * 初参加者へのオンボーディングDM。
 * 名簿にレーン希望が未設定のまま参加すると、チーム分けでMMR未設定扱いになり
 * バランスが崩れる。参加ボタンを押した時点で本人に案内を送って予防する。
 */
async function sendOnboardingIfNeeded(env, userId) {
  try {
    const { fetchSupabase } = await import('../utils/supabase.js');
    const rows = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=role_preferences,ign`);
    const p = rows && rows[0];
    // 既にレーン希望が設定済みなら何もしない
    if (p && p.role_preferences && p.role_preferences.primary) return;

    const missing = [];
    if (!p) missing.push('・名簿への登録（管理者が「Discord同期」を実行すると自動登録されます）');
    if (!p || !p.role_preferences?.primary) missing.push('・**希望レーンの設定** → `/lane` コマンド、または募集パネルの「📍レーン設定」ボタン');
    if (p && !p.ign) missing.push('・Riot IDの登録 → 募集パネルの「🆔 IGN登録」ボタン（任意。ソロQ戦績と連携できます）');

    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: userId })
    });
    if (!dmRes.ok) return;
    const dm = await dmRes.json();
    await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '👋 KTMカスタムへの参加ありがとうございます！',
          description: `より良いチーム分けのために、以下の設定をお願いします：\n\n${missing.join('\n')}\n\n設定しておくと、あなたの希望レーンや「こだわり度」「格上許可」がチーム分けに反映されます。`,
          color: 0x00cfef,
          footer: { text: 'この案内は設定が完了すると表示されなくなります' }
        }]
      })
    });
  } catch (e) {
    console.warn('[Onboarding] DM送信スキップ:', e?.message);
  }
}

