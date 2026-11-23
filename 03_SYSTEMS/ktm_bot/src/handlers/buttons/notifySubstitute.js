import { addMemberRole, removeMemberRole } from '../../utils/discordRoles.js';
import { CONFIG } from '../../config.js';
import { patchInteractionResponse } from '../../utils/api.js';

// 募集通知のON/OFF
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
          await removeMemberRole(guildId, userId, roleId, botToken);
          await patchInteractionResponse(appId, token, { content: "🔔 **募集通知ロールを解除しました。**\n以降、メンバー募集時の通知は届きません。" });
        } else {
          // ロール付与
          await addMemberRole(guildId, userId, roleId, botToken);
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

  return undefined;
}
