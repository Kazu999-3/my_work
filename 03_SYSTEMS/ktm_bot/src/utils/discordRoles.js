// Discord のメンバーロール操作と、プレイスタイルロールの表示名。
// 2026-10-07: 通知ロールの切り替え（buttons/notifySubstitute.js）とプレイスタイルロール（buttons/portalBasics.js）に
// 同じ PUT/DELETE 呼び出しが個別に書かれていたのをまとめた。

const memberRoleUrl = (guildId, userId, roleId) =>
  `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;

/** メンバーにロールを付与する。失敗時は Discord の応答内容を含めて例外を投げる */
export async function addMemberRole(guildId, userId, roleId, botToken) {
  const res = await fetch(memberRoleUrl(guildId, userId, roleId), {
    method: "PUT",
    headers: { "Authorization": `Bot ${botToken}`, "Content-Length": "0" }
  });
  if (!res.ok) throw new Error(`Role assignment failed: ${res.status} ${await res.text()}`);
}

/** メンバーからロールを外す。失敗時は Discord の応答内容を含めて例外を投げる */
export async function removeMemberRole(guildId, userId, roleId, botToken) {
  const res = await fetch(memberRoleUrl(guildId, userId, roleId), {
    method: "DELETE",
    headers: { "Authorization": `Bot ${botToken}` }
  });
  if (!res.ok) throw new Error(`Role removal failed: ${res.status} ${await res.text()}`);
}

/**
 * プレイスタイル・志向性ロールの表示名（キーは custom_id `playstyle_role:<key>` と ktm_settings.discord_role_sync.playstyle_roles のキー）。
 * ⚠️ Discord 上のロール名は 04_PORTAL/src/lib/discordRoleSync.ts の PLAYSTYLE_ROLE_DEFINITIONS が作成時に付ける。
 * 名前を変える時は両方を揃えること（Bot と 04 は別々にデプロイされるためファイルを共有できない）。
 */
export const PLAYSTYLE_ROLE_NAMES = {
  soloq: '🥊 ソロキュー奮闘中',
  flex: '🤝 フレックス希望',
  aram: '❄️ ARAM・サクッと勢',
  casual: '☕ エンジョイ・まったり',
  learner: '📖 教わりたい',
};
