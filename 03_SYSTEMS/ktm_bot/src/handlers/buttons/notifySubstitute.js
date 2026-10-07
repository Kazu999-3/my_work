import { CONFIG } from '../../config.js';
import { patchInteractionResponse, sendDiscordMessage } from '../../utils/api.js';

// 募集通知のON/OFF、代打募集（ノーマル/ARAM）
// 2026-10-07: handlers/components.js（1,486行）のボタン処理から分割。処理は分割前と同じ（元の判定順のまま）。
/** 該当するボタンなら応答を返し、該当しなければ undefined（次の処理へ）を返す */
export async function handleNotifySubstituteButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
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
        } catch (e) {
          // 意図的に空: これは「エラーをユーザーへ伝える処理」自体の失敗。
          // ここで更に通知を試みても同じ経路で失敗する可能性が高く、打てる手が無い。
          // 外側のcatchがエラー内容をログに残しており、ユーザーにはロール操作の失敗が見えている。
        }
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


  return undefined;
}
