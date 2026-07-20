import { CONFIG } from '../config.js';
import { fetchGAS, patchInteractionResponse, sendDiscordMessage, sendInteractionFollowup } from '../utils/api.js';
import { handleLaneCommand, handleStatsCommand } from './commands.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, extractPlayersFromEmbed, getPortalComponents, getPortalEmbed, handleHelpPage, splitMessage } from '../ui/embeds.js';
import { parseMessageData, handleAutoMatchEnd } from '../utils/helpers.js';
import { getAdminDiscordIds, markRecruitmentStatus } from '../utils/recruitPermission.js';

export async function handleButtonInteraction(interaction, env, ctx) {
  let customId = interaction.data.custom_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // 募集主メニュー（セレクト）を、既存のボタン用アクションIDに読み替えて以降の処理をそのまま再利用する。
  // これで権限チェック等の既存ロジックを一切変えずにUIだけセレクト化できる。
  if (customId.startsWith('recruit_manage:') && Array.isArray(interaction.data.values) && interaction.data.values.length > 0) {
    const owner = customId.split(':')[1];
    const val = interaction.data.values[0];
    const map = { edit: 'edit_recruit_init', upgrade: 'upgrade_to_10', proxy: 'proxy_add_init', close: 'close', delete: 'delete_recruit' };
    if (map[val]) customId = `${map[val]}:${owner}`;
  } else if (customId.startsWith('recruit_manage:')) {
    // 何も選ばれずに閉じられた場合は募集メッセージをそのまま維持
    const metadata = parseMessageData(interaction.message);
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }
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

  if (customId.startsWith('upgrade_to_10')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ拡張可能です。", flags: 64 } });
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
  } else if (customId.startsWith('close')) {
    // 募集終了→ボタンなしで閉じる（返信メンションで一括連絡してください）
    // recruitmentsテーブルのstatusも'closed'に反映し、ポータル側が古い募集を
    // 「進行中」として拾い続けないようにする。
    ctx.waitUntil((async () => {
      try {
        await markRecruitmentStatus(env, interaction.message.id, 'closed');
      } catch (e) {
        console.error("recruitments テーブルの終了反映に失敗:", e);
      }
    })());
    const embed = createRecruitEmbed(metadata); embed.title = "🚨 募集終了"; embed.color = 0xff0000;
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [embed], components: [] } });
  }

  // 自動締切 & メンション (チーム分けは手動ボタンで実行)
  if (metadata.joined.length >= metadata.maxCount && (customId.startsWith('join_any') || customId.startsWith('join_role:'))) {
    ctx.waitUntil((async () => {
      const mentions = [...new Set([metadata.owner, ...metadata.joined])].map(id => `<@${id}>`).join(" ");

      // 満員時に参加者の希望レーン状況をまとめて投稿（チーム分けの参考に）
      let laneEmbed = null;
      try {
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
        const countLine = `**第一希望の分布**: TOP:${roleCount.TOP} JG:${roleCount.JG} MID:${roleCount.MID} ADC:${roleCount.ADC} SUP:${roleCount.SUP}${roleCount.ALL ? ` ALL:${roleCount.ALL}` : ''}`;

        // レート帯の内訳（しきい値の上下に何人いるか）
        let tierLine = '';
        try {
          const th = CONFIG.MMR_TIER_THRESHOLD || 1350;
          const withMmr = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=mmr`);
          const mmrs = (withMmr || []).map((p) => p.mmr || 1200);
          if (mmrs.length > 0) {
            const sorted = [...mmrs].sort((a, b) => b - a);
            tierLine = `\n**レート帯**（しきい値 ${th}）: 🔼${th}以上 ${mmrs.filter(m => m >= th).length}名 ／ 🔽${th}未満 ${mmrs.filter(m => m < th).length}名`
              + `\n最高 ${sorted[0]} / 最低 ${sorted[sorted.length - 1]}（幅 ${sorted[0] - sorted[sorted.length - 1]}）`;
          }
        } catch (e) { /* 集計失敗は無視 */ }
        laneEmbed = {
          title: '📍 参加者の希望レーン状況',
          description: `${countLine}${tierLine}\n\n${lines.join('\n')}`,
          color: 0x3498db,
          footer: { text: '表記: メイン / サブ（NG）。ポータルのチーム分けで自動考慮されます。' }
        };
      } catch (e) {
        console.warn('lane summary failed:', e);
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

  // 募集メッセージ本体にレート帯の内訳を表示する（参加ボタンを押す時点で構成が分かるように）
  const tierLine = await buildTierLine(env, metadata.joined || []);
  return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata, tierLine)], components: createRecruitButtons(metadata) } });
}

/** 参加者のdiscord_id配列から「🔼しきい値以上 N名 ／ 🔽未満 N名」の1行を作る */
async function buildTierLine(env, joinedIds) {
  if (!joinedIds || joinedIds.length === 0) return '';
  try {
    const { fetchSupabase } = await import('../utils/supabase.js');
    const th = CONFIG.MMR_TIER_THRESHOLD || 1350;
    const idsStr = joinedIds.map((i) => `"${i}"`).join(',');
    const ps = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=mmr`);
    const mmrs = (ps || []).map((p) => p.mmr || 1200);
    if (mmrs.length === 0) return '';
    const upper = mmrs.filter((m) => m >= th).length;
    const lower = mmrs.filter((m) => m < th).length;
    const unknown = joinedIds.length - mmrs.length;
    const sorted = [...mmrs].sort((a, b) => b - a);
    return `**レート帯**（${th}基準）: 🔼${upper}名 ／ 🔽${lower}名`
      + (unknown > 0 ? ` ／ ❓未登録${unknown}名` : '')
      + (mmrs.length >= 2 ? `　幅${sorted[0] - sorted[sorted.length - 1]}` : '');
  } catch (e) {
    return '';
  }
}
