import { CONFIG } from '../config.js';
import { fetchGAS, patchInteractionResponse, sendDiscordMessage, sendInteractionFollowup } from '../utils/api.js';
import { executeBalance, handleBalanceCommand, handleLaneCommand, handleStatsCommand, performBalance } from './commands.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, extractPlayersFromEmbed, getPortalComponents, getPortalEmbed, handleHelpPage, splitMessage } from '../ui/embeds.js';
import { parseMessageData, handleAutoMatchEnd } from '../utils/helpers.js';

export async function handleButtonInteraction(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const appId = interaction.application_id;
  const token = interaction.token;
  const botToken = env.DISCORD_TOKEN;

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
  
  if (customId.startsWith('forge_show_')) {
    const [action, filePath] = customId.split(':');
    const label = action === 'forge_show_article' ? "📄 記事本文" : "🪩 SNS拡散案";
    
    ctx.waitUntil((async () => {
      try {
        const res = await fetch(`${env.LOCAL_API_URL || "https://antigravity-local.lhr.life"}/forge/get_content?file_path=${encodeURIComponent(filePath)}`);
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.detail || "取得失敗");
        
        const chunks = splitMessage(data.content);
        await sendInteractionFollowup(appId, token, { content: `✅ **${label}を取得しました** (1/${chunks.length}):\n\n\`\`\`markdown\n${chunks[0]}\n\`\`\``, flags: 64 });
        for (let i = 1; i < chunks.length; i++) {
          await sendInteractionFollowup(appId, token, { content: `(${i+1}/${chunks.length}):\n\n\`\`\`markdown\n${chunks[i]}\n\`\`\``, flags: 64 });
        }
      } catch (err) {
        await sendInteractionFollowup(appId, token, { content: `❌ **データ取得エラー**: ${err.message}`, flags: 64 });
      }
    })());
    
    return Response.json({ type: 4, data: { content: `⌛ ${label}を読み込み中...`, flags: 64 } });
  }

  if (customId === 'portal_menu') {
    const value = interaction.data.values[0];
    const channelId = interaction.channel_id;
    const messageId = interaction.message.id;
    const resetPortal = () => sendDiscordMessage(`channels/${channelId}/messages/${messageId}`, botToken, "PATCH", { embeds: [getPortalEmbed()], components: getPortalComponents(userId) });
    
    if (value === 'portal_recruit') return Response.json({
      type: 9, data: {
        title: "⚔️ 新規メンバー募集の設定", custom_id: "portal_recruit_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "モード", style: 1, value: "カスタム", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "最大人数", style: 1, value: "10", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 2, required: false }] }
        ]
      }
    });
    if (value === 'portal_stats') return handleStatsCommand(interaction, env, ctx);
    if (value === 'portal_balance') { ctx.waitUntil(resetPortal()); return await handleBalanceCommand(interaction, env, ctx); }
    if (value === 'portal_lane') return handleLaneCommand(interaction, env, ctx);
    if (value === 'admin_fix_match') return Response.json({ type: 9, data: { title: "🛠️ 勝敗修正", custom_id: "admin_fix_match_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "winner", label: "正しい勝利チーム", style: 1, required: true }] }] } });
    if (value === 'admin_adjust_mmr') return Response.json({ type: 9, data: { title: "🛠️ MMR 手動調整", custom_id: "admin_adjust_mmr_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "target", label: "対象名", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "role", label: "ロール", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "amount", label: "新しいMMR", style: 1, required: true }] }] } });
    if (value === 'portal_help') { ctx.waitUntil(resetPortal()); return Response.json({ type: 4, data: { ...handleHelpPage(), flags: 64 } }); }
    if (value === 'admin_sync_ranks') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      const discordName = interaction.member?.user?.global_name || interaction.member?.user?.username;
      ctx.waitUntil((async () => {
        try {
          const gasData = await fetchGAS({ type: "TRIGGER_RIOT_SYNC", discordName });
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

  if (customId === 'portal_menu_cancel') return Response.json({ type: 7, data: { content: "✅ 操作をキャンセルしました。", components: [] } });

  if (customId.startsWith('exec_init_mmr:')) {
    if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ この操作は管理者のみ実行可能です。", flags: 64 } });
    const isOverwriteAll = (customId.split(':')[1] === 'all');
    ctx.waitUntil((async () => {
      try {
        const gasData = await fetchGAS({ type: "INITIALIZE_MMR", isOverwriteAll });
        await patchInteractionResponse(appId, token, { content: `✅ **実行完了**: ${gasData.message}`, components: [] });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());
    return Response.json({ type: 7, data: { content: "⌛ 処理を開始しました。少々お待ちください...", components: [] } });
  }

  if (customId.startsWith('win_blue:') || customId.startsWith('win_red:')) {
    const ownerId = customId.split(':')[1];
    if (userId !== ownerId && userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 実行した本人のみ報告可能です。", flags: 64 } });
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
        const res = await fetchGAS({ type: "GET_OPGG_URLS", teamBlue: teamA, teamRed: teamB });
        if (res.status !== "SUCCESS") throw new Error(res.message || "通信エラー");
        
        let content = "🕵️ **OP.GG スカウティングレポート**\n以下のリンクから両チームの詳細な戦績を確認できます。\n\n";
        if (res.blueUrl) content += `🟦 **TEAM BLUE**\n${res.blueUrl}\n\n`;
        else content += `🟦 **TEAM BLUE**: 登録されているIGNがありません\n\n`;
        
        if (res.redUrl) content += `🟥 **TEAM RED**\n${res.redUrl}`;
        else content += `🟥 **TEAM RED**: 登録されているIGNがありません`;
        
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: content, flags: 64 });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());
    
    return Response.json({ type: 5, data: { flags: 64 } });
  }

  if (customId === 'rebalance') {
    // ━━━ デバッグ: まず即座に「処理中」を返す ━━━
    try {
      const meta = parseMessageData(interaction.message);
      const names = meta.joined.map(id => meta.names[id]).slice(0, 10);
      
      // 募集メタデータがない場合（Match announcement の場合）は Embed から直接抽出
      if (names.length === 0) {
        const embed0 = interaction.message?.embeds?.[0];
        if (!embed0) {
          // Embedなし → エラーを即時表示
          return Response.json({ type: 4, data: { content: "⚠️ **rebalance失敗**: メッセージにEmbedが見つかりません。", flags: 64 } });
        }
        const players = extractPlayersFromEmbed(embed0);
        let spectators = [];
        const specField = embed0.fields?.find(f => f.name.includes("待機"));
        if (specField) {
          spectators = specField.value.split(',').map(n => n.trim()).filter(n => n && n !== "なし");
        }
        
        if (players.length > 0) {
          const allNames = [...players.map(p => p.name), ...spectators];
          return await executeBalance(interaction, allNames, env, ctx, true);
        } else {
          // players抽出失敗 → フィールド内容をデバッグ表示
          const fieldNames = (embed0.fields || []).map(f => f.name).join(", ");
          const firstFieldVal = (embed0.fields?.[0]?.value || "").slice(0, 100);
          return Response.json({ type: 4, data: { content: `⚠️ **rebalance失敗**: Embedからプレイヤー抽出失敗\nfields: ${fieldNames}\n最初のfield値: ${firstFieldVal}`, flags: 64 } });
        }
      }
      return await executeBalance(interaction, names, env, ctx, true);
    } catch (err) {
      return Response.json({ type: 4, data: { content: `⚠️ **rebalance例外**: ${err.message}`, flags: 64 } });
    }
  }

  // 募集パネル操作
  const metadata = parseMessageData(interaction.message);
  const userName = interaction.member.user.global_name || interaction.member.user.username;
  if (customId.includes(':')) metadata.owner = customId.split(':').pop();

  if (customId.startsWith('edit_recruit_init')) {
    if (userId !== metadata.owner) return Response.json({ type: 4, data: { content: "⚠️ 募集主のみ編集可能です。", flags: 64 } });
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

  if (customId.startsWith('upgrade_to_10')) {
    if (userId !== metadata.owner) return Response.json({ type: 4, data: { content: "⚠️ 募集主のみ拡張可能です。", flags: 64 } });
    metadata.mode = 'カスタム'; metadata.maxCount = 10;
  } else if (customId.startsWith('join_any')) {
    if (metadata.joined.includes(userId) && !Object.values(metadata.roles).includes(userId)) {
      // 二度押しで離脱
      metadata.joined = metadata.joined.filter(id => id !== userId);
    } else if (metadata.joined.length < metadata.maxCount) {
      if (!metadata.joined.includes(userId)) metadata.joined.push(userId);
      metadata.names[userId] = userName;
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
    }
  } else if (customId.startsWith('join_role:')) {
    const role = customId.split(':')[1];
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
  } else if (customId.startsWith('spectate')) {
    if (!metadata.spectating.includes(userId)) {
      metadata.spectating.push(userId); metadata.names[userId] = userName;
      metadata.joined = metadata.joined.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
    } else {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
    }
  } else if (customId.startsWith('close')) {
    const embed = createRecruitEmbed(metadata); embed.title = "🚨 募集終了"; embed.color = 0xff0000;
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [embed], components: [{ type: 1, components: [{ type: 2, label: "📢 一括連絡", style: 1, custom_id: `broadcast_start:${metadata.owner}` }] }] } });
  } else if (customId.startsWith('broadcast_start:')) {
    return Response.json({ type: 9, data: { title: "📢 一括連絡", custom_id: `broadcast_modal:${metadata.owner}`, components: [{ type: 1, components: [{ type: 4, custom_id: "msg", label: "送信メッセージ", style: 2, required: true }] }] } });
  } else if (customId.startsWith('balance_from_recruit')) {
     return await executeBalance(interaction, metadata.joined.map(id => metadata.names[id]), env, ctx);
  } else if (customId.startsWith('check_live')) {
    const allIds = [...new Set([...metadata.joined, ...metadata.spectating])];
    if (allIds.length === 0) return Response.json({ type: 4, data: { content: "⚠️ 参加者がいません。", flags: 64 } });
    
    ctx.waitUntil((async () => {
      try {
        const res = await fetchGAS({ type: "GET_LIVE_STATUS", discordIds: allIds });
        if (res.status !== "SUCCESS") throw new Error(res.message || "通信エラー");
        
        let lines = ["📡 **メンバーのライブステータス**\n"];
        allIds.forEach(id => {
          const s = res.statuses[id];
          const stName = s ? (s.name || metadata.names[id] || "不明") : (metadata.names[id] || "不明");
          const stMsg = s ? s.message : "データなし";
          lines.push(`- **${stName}**: ${stMsg}`);
        });
        
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: lines.join("\n"), flags: 64 });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **ライブ取得エラー**: ${err.message}`, flags: 64 });
      }
    })());
    
    return Response.json({ type: 5, data: { flags: 64 } });
  }

  // 自動締切 & メンション (チーム分けは手動ボタンで実行)
  if (metadata.joined.length >= metadata.maxCount && (customId.startsWith('join_any') || customId.startsWith('join_role:'))) {
    ctx.waitUntil((async () => {
      const mentions = [...new Set([metadata.owner, ...metadata.joined])].map(id => `<@${id}>`).join(" ");
      const players = metadata.joined.map(id => metadata.names[id]).slice(0, 10);
      const spectators = metadata.spectating.map(id => metadata.names[id]);
      
      try {
        await fetchGAS({ type: "SYNC_TO_INPUT", players, spectators });
      } catch (err) {
        console.error("Auto Sync to Input Error:", err);
      }
      
      await sendInteractionFollowup(appId, token, { content: `⚔️ **メンバー確定！** 対戦準備を開始してください（対戦入力シートへ転送しました）。\n通知: ${mentions}` });
    })());
    
    const closingMessage = (metadata.mode === 'ノーマル' || metadata.mode === 'ARAM')
      ? "\n🚨 **定員に達しました。対戦準備を開始してください！**" 
      : "\n🚨 **定員に達したため締め切りました。チーム分けボタンから実行してください。**";
      
    return Response.json({ type: 7, data: { content: createMessageContent(metadata) + closingMessage, embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }

  return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
}
