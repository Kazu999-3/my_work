import { CONFIG } from '../config.js';
import { fetchGAS, sendDiscordMessage } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { parseMessageData } from '../utils/helpers.js';
import { createRecruitment } from '../utils/recruitPermission.js';

export async function handleModalSubmit(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member.user.id;

  if (customId === 'portal_recruit_modal') {
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim() : "";
    };
    const rawMode = getVal('mode');
    const mode = (rawMode === 'ノーマル' || rawMode === 'カスタム' || rawMode === 'ARAM') ? rawMode : 'ノーマル';
    const maxCount = parseInt(getVal('max')) || (mode === 'カスタム' ? 10 : 5);
    const metadata = { mode, time: getVal('time'), maxCount, memo: getVal('memo'), owner: userId, joined: [], spectating: [], roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: {} };
    ctx.waitUntil((async () => {
      const res = await sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) });
      try {
        const sentMessage = await res.clone().json();
        // 埋め込みメタデータに加えて recruitments テーブルにも正規に記録する（課題②）。
        // これにより owner 判定が埋め込みJSONのパースだけに依存しなくなる。
        await createRecruitment(env, {
          messageId: sentMessage.id,
          channelId: CONFIG.RECRUIT_CHANNEL_ID,
          ownerDiscordId: userId,
          mode,
          maxCount,
        });
      } catch (e) {
        console.error("recruitments テーブルへの記録に失敗しました（埋め込みメタデータ側は投稿済み）:", e);
      }
    })());
    return Response.json({ type: 4, data: { content: "✅ **募集を #募集板 に投下しました！**", flags: 64 } });
  }

  if (customId === 'portal_ign_modal') {
    const ign = interaction.data.components.find(c => c.components[0].custom_id === 'ign').components[0].value;
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    const appId = interaction.application_id;
    const token = interaction.token;
    
    ctx.waitUntil((async () => {
      try {
        const { fetchSupabase } = await import('../utils/supabase.js');
        const { patchInteractionResponse } = await import('../utils/api.js');
        const existingData = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`);
        if (!existingData || existingData.length === 0) {
            await patchInteractionResponse(appId, token, { content: "⚠️ 名簿にあなたの Discord ID が見わたりませんでした。新メンバー同期を待つか、一度対戦に参加してください。" });
        } else {
            // Next.js ポータル API経由で IGN と PUUID を登録する
            const res = await fetch(`https://my-work-8jbd.vercel.app/api/player/update-puuid`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ discordId: userId, ign: ign })
            });
            const data = await res.json();
            if (data.status === "SUCCESS") {
              await patchInteractionResponse(appId, token, { content: `✅ LoL IGN を **${ign}** に設定し、Riot API との紐付け(PUUID)を完了しました！これ以降、ランク情報が自動同期されます。` });
            } else {
              await patchInteractionResponse(appId, token, { content: `⚠️ IGNは登録されましたが、PUUIDの取得に失敗しました: ${data.message}` });
            }
        }
      } catch (err) {
        console.error("Modal SetIGN Error:", err);
      }
    })());
    
    return Response.json({ 
      type: 4, 
      data: { content: "⌛ IGNの登録を開始しました。処理完了まで少々お待ちください...", flags: 64 } 
    });
  }

  if (customId === 'portal_lane_modal') {
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim().toUpperCase() : "";
    };
    let main = getVal('main'), sub = getVal('sub'), ng1 = getVal('ng1'), ng2 = getVal('ng2');
    if (main === 'ALL') {
      sub = '-';
    }
    const weightRaw = interaction.data.components.find(c => c.components[0].custom_id === 'weight')?.components[0].value;
    const weight = weightRaw ? parseInt(weightRaw) : undefined;
    
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        const { fetchSupabase, upsertPlayer } = await import('../utils/supabase.js');
        let existingData = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`);
        let player = existingData && existingData.length > 0 ? existingData[0] : null;
        
        if (!player) {
          // 名前で既存のプレイヤーを探す
          const nameEscaped = encodeURIComponent(discordName);
          const dataByName = await fetchSupabase(env, 'ktm_players', `name=eq.${nameEscaped}`);
          if (dataByName && dataByName.length > 0) {
            player = dataByName[0];
            player.discord_id = userId;
          }
        }
        
        if (!player) {
          player = { discord_id: userId, name: discordName, is_active: true };
        }
        
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
