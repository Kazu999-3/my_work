import { CONFIG } from '../../config.js';
import { patchInteractionResponse, sendDiscordMessage, sendInteractionFollowup } from '../../utils/api.js';
import { handleLaneCommand, handleStatsCommand } from '../commands.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, extractPlayersFromEmbed, handleHelpPage } from '../../ui/embeds.js';
import { handleAutoMatchEnd } from '../../utils/helpers.js';
import { notifyAdminError } from '../../utils/alert.js';

// 管理メニュー・クイック募集・MMR初期化・勝敗ボタン・OP.GG偵察
// 2026-10-07: handlers/components.js（1,486行）のボタン処理から分割。処理は分割前と同じ（元の判定順のまま）。
/** 該当するボタンなら応答を返し、該当しなければ undefined（次の処理へ）を返す */
export async function handleAdminQuickButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
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
          const { fetchPortalAPI } = await import('../../utils/api.js');
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
    const quickAppId = interaction.application_id;
    const quickToken = interaction.token;

    ctx.waitUntil((async () => {
      const { patchInteractionResponse } = await import('../../utils/api.js');
      try {
        const res = await sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, botToken, "POST", {
          content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata)
        });

        // ⚠️ 2026-09-29 是正: 以前は成否を確認せず、無条件に「⚡ 投下しました！」を返していた。
        // カード投稿が失敗すると**募集が存在しないのに成功表示**になり、募集主は来ない人を待つ。
        // `sendDiscordMessage` は失敗時も throw せずレスポンスを返すため、明示的に確認する。
        // （portal_recruit_modal と同じ問題。本日5件目の「waitUntil＋無条件✅」パターン）
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try { detail += `: ${(await res.clone().text()).slice(0, 200)}`; } catch { /* noop */ }
          await patchInteractionResponse(quickAppId, quickToken, {
            content: `❌ **募集の投稿に失敗しました**（${detail}）\n※募集は作成されていません。時間をおいてもう一度お試しください。`
          }).catch(() => {});
          await notifyAdminError(env, new Error(`クイック即募集のカード投稿に失敗: ${detail}`), {
            action: 'quick_recruit（クイック即募集）', customId, userId
          });
          return;
        }

        await patchInteractionResponse(quickAppId, quickToken, {
          content: `⚡ **${qMode}${qMax}人の募集を #募集板 に投下しました！**（時刻やメモは募集カードの「⚙️ 募集を編集」ボタンから後で設定できます）`
        }).catch(() => {});

        const sentMessage = await res.clone().json();
        const { createRecruitment } = await import('../../utils/recruitPermission.js');
        await createRecruitment(env, {
          messageId: sentMessage.id, channelId: CONFIG.RECRUIT_CHANNEL_ID,
          ownerDiscordId: userId, mode: qMode, maxCount: parseInt(qMax) || 10,
        });
        const { fetchPortalAPI } = await import('../../utils/api.js');
        await fetchPortalAPI(env, '/api/push/notify-recruit', { mode: qMode, time: '' }).catch(() => {});
      } catch (e) {
        console.error("quick_recruit error:", e);
        await patchInteractionResponse(quickAppId, quickToken, {
          content: `❌ **募集の投稿でエラーが発生しました**: ${e.message}\n※#募集板 にカードが出ているか確認してください。`
        }).catch(() => {});
        await notifyAdminError(env, e, { action: 'quick_recruit（クイック即募集）', customId, userId });
      }
    })());
    // 成否が確定するまで断定しない（結果は上の waitUntil が上書きする）
    return Response.json({ type: 5, data: { flags: 64 } });
  }

  if (customId === 'portal_menu_cancel') return Response.json({ type: 7, data: { content: "✅ 操作をキャンセルしました。", components: [] } });

  if (customId.startsWith('exec_init_mmr:')) {
    if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ この操作は管理者のみ実行可能です。", flags: 64 } });
    const isOverwriteAll = (customId.split(':')[1] === 'all');
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../../utils/api.js');
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
        const { getPlayersByNames } = await import('../../utils/supabase.js');
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

  return undefined;
}
