import { CONFIG } from '../config.js';
import { fetchGAS, patchInteractionResponse, sendDiscordMessage, sendInteractionFollowup } from '../utils/api.js';
import { handleLaneCommand, handleStatsCommand } from './commands.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, extractPlayersFromEmbed, getPortalComponents, getPortalEmbed, handleHelpPage, splitMessage } from '../ui/embeds.js';
import { parseMessageData, handleAutoMatchEnd } from '../utils/helpers.js';

export async function handleButtonInteraction(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const appId = interaction.application_id;
  const token = interaction.token;
  const botToken = env.DISCORD_TOKEN;

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
    if (value === 'portal_balance') return await handleBalanceCommand(interaction, env, ctx);
    if (value === 'portal_lane') return handleLaneCommand(interaction, env, ctx);
    if (value === 'portal_ign') return Response.json({ type: 9, data: { title: "📝 サモナー名登録", custom_id: "portal_ign_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "ign", label: "サモナー名 (Riot ID#Tag)", style: 1, placeholder: "Faker#KR1", required: true }] }] } });
    
    if (value === 'admin_fix_match') return Response.json({ type: 9, data: { title: "🛠️ 勝敗修正", custom_id: "admin_fix_match_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "winner", label: "正しい勝利チーム", style: 1, required: true }] }] } });
    if (value === 'admin_adjust_mmr') return Response.json({ type: 9, data: { title: "🛠️ MMR 手動調整", custom_id: "admin_adjust_mmr_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "target", label: "対象名", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "role", label: "ロール", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "amount", label: "新しいMMR", style: 1, required: true }] }] } });
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
  }

  // 自動締切 & メンション (チーム分けは手動ボタンで実行)
  if (metadata.joined.length >= metadata.maxCount && (customId.startsWith('join_any') || customId.startsWith('join_role:'))) {
    ctx.waitUntil((async () => {
      const mentions = [...new Set([metadata.owner, ...metadata.joined])].map(id => `<@${id}>`).join(" ");
      const players = metadata.joined.map(id => metadata.names[id]).slice(0, 10);
      const spectators = metadata.spectating.map(id => metadata.names[id]);
      
      // SYNC_TO_INPUT は不要になったため削除
      // try { await fetchGAS({ type: "SYNC_TO_INPUT", players, spectators }); } catch(err) {}
      
      await sendInteractionFollowup(appId, token, { content: `⚔️ **メンバー確定！** 対戦準備を開始してください（対戦入力シートへ転送しました）。\n通知: ${mentions}` });
    })());
    
    const closingMessage = (metadata.mode === 'ノーマル' || metadata.mode === 'ARAM')
      ? "\n🚨 **定員に達しました。対戦準備を開始してください！**" 
      : "\n🚨 **定員に達したため締め切りました。ポータル画面からチーム分けを行ってください。**";
      
    return Response.json({ type: 7, data: { content: createMessageContent(metadata) + closingMessage, embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }

  return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
}
