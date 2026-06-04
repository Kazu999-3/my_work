import { CONFIG } from '../config.js';
import { fetchGAS, sendDiscordMessage } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { parseMessageData } from '../utils/helpers.js';

export async function handleModalSubmit(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member.user.id;

  if (customId === 'portal_recruit_modal') {
    const getVal = (cid) => interaction.data.components.find(c => c.components[0].custom_id === cid).components[0].value;
    const metadata = { mode: getVal('mode'), time: getVal('time'), maxCount: parseInt(getVal('max')), memo: getVal('memo'), owner: userId, joined: [], spectating: [], roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: {} };
    ctx.waitUntil(sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) }));
    return Response.json({ type: 4, data: { content: "✅ **募集を #募集板 に投下しました！**", flags: 64 } });
  }

  if (customId === 'portal_lane_modal') {
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value : "";
    };
    const main = getVal('main'), sub = getVal('sub'), ng1 = getVal('ng1'), ng2 = getVal('ng2'), weightRaw = getVal('weight');
    const weight = weightRaw ? parseInt(weightRaw) : undefined;
    
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        const { fetchSupabase, upsertPlayer } = await import('../utils/supabase.js');
        const existingData = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`);
        const player = existingData && existingData.length > 0 ? existingData[0] : { discord_id: userId, name: discordName, is_active: true };
        
        player.role_preferences = player.role_preferences || {};
        if (main) player.role_preferences.primary = main;
        if (sub) player.role_preferences.secondary = sub;
        if (ng1) player.ng_lane_1 = ng1;
        if (ng2) player.ng_lane_2 = ng2;
        if (weight) player.weight = weight;
        
        await upsertPlayer(env, player);
      } catch (err) {
        console.error("Modal Lane Update Error:", err);
      }
    })());

    return Response.json({ 
      type: 4, 
      data: { content: `✅ **レーン設定を受付ました**\nメイン:${main} / サブ:${sub} / NG1:${ng1} / NG2:${ng2}\n※反映まで数秒かかる場合があります。`, flags: 64 } 
    });
  }

  if (customId === 'admin_fix_match_modal') {
    const winner = interaction.data.components[0].components[0].value.toUpperCase();
    const { fetchPortalAPI } = await import('../utils/api.js');
    await fetchPortalAPI(env, '/api/admin/fix-match', { winner });
    return Response.json({ type: 4, data: { content: `✅ 直近の試合を **${winner} 勝利** に更新しました。`, flags: 64 } });
  }

  if (customId === 'admin_adjust_mmr_modal') {
    const getVal = (cid) => interaction.data.components[0].components[0] ? interaction.data.components.find(c => c.components[0].custom_id === cid)?.components[0]?.value : null;
    const { fetchPortalAPI } = await import('../utils/api.js');
    // カスタムモーダルの値取得が若干不安定な場合を考慮し安全に取得（すでに元のコードがあるのでそれに準拠）
    const targetName = interaction.data.components.find(c => c.components[0].custom_id === 'target').components[0].value;
    const role = interaction.data.components.find(c => c.components[0].custom_id === 'role').components[0].value;
    const amount = interaction.data.components.find(c => c.components[0].custom_id === 'amount').components[0].value;
    
    await fetchPortalAPI(env, '/api/admin/adjust-mmr', { targetName, role, amount });
    return Response.json({ type: 4, data: { content: `✅ ${targetName} の ${role} MMRを更新しました。`, flags: 64 } });
  }

  if (customId.startsWith('broadcast_modal:')) {
    const msg = interaction.data.components[0].components[0].value;
    const meta = parseMessageData(interaction.message);
    const mentions = [...new Set([...meta.joined, ...meta.spectating, meta.owner])].map(id => `<@${id}>`).join(" ");
    
    const channelId = interaction.channel_id;
    const msgId = interaction.message.id;
    
    ctx.waitUntil((async () => {
      try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bot ${env.DISCORD_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `📣 **募集主からの連絡**\n━━━━━━━━━━━━\n${msg}\n━━━━━━━━━━━━\n対象: ${mentions}`,
            message_reference: { message_id: msgId }
          })
        });
      } catch (err) {
        console.error("Broadcast Reply Error:", err);
      }
    })());
    
    return Response.json({ type: 4, data: { content: "✅ **参加者に一括連絡（返信メンション）を送信しました**", flags: 64 } });
  }

  if (customId.startsWith('edit_recruit_modal:')) {
    const getVal = (cid) => interaction.data.components.find(c => c.components[0].custom_id === cid).components[0].value;
    const metadata = parseMessageData(interaction.message);
    
    metadata.mode = getVal('mode');
    metadata.time = getVal('time');
    metadata.maxCount = parseInt(getVal('max')) || metadata.maxCount;
    metadata.memo = getVal('memo');
    
    return Response.json({
      type: 7, 
      data: {
        content: createMessageContent(metadata),
        embeds: [createRecruitEmbed(metadata)],
        components: createRecruitButtons(metadata)
      }
    });
  }

  return Response.json({ type: 1 });
}
