/**
 * 募集(recruitments)の編集・削除権限チェック共通ロジック。
 * 募集主本人、またはシステム管理者(ADMIN_DISCORD_IDS)は常に許可する。
 * ktm_bot(components.js)とPortal(src/lib/recruitPermission.ts)の両方で
 * 同じ判定基準を使うこと。
 */
import { fetchSupabase } from './supabase.js';

export function getAdminDiscordIds(env) {
  const idsStr = env.ADMIN_DISCORD_IDS || '';
  return idsStr.split(',').map((id) => id.trim()).filter(Boolean);
}

export async function getRecruitmentByMessageId(env, messageId) {
  const rows = await fetchSupabase(env, 'recruitments', `discord_message_id=eq.${messageId}&select=*`);
  return rows && rows.length > 0 ? rows[0] : null;
}

export function canEditRecruitment(userId, recruitment, adminIds) {
  if (!recruitment) return false;
  return userId === recruitment.owner_discord_id || adminIds.includes(userId);
}

/** モーダル送信時などに募集レコードを新規作成する */
export async function createRecruitment(env, { messageId, channelId, ownerDiscordId, mode, maxCount }) {
  return fetchSupabase(env, 'recruitments', '', 'POST', {
    discord_message_id: messageId,
    discord_channel_id: channelId,
    owner_discord_id: ownerDiscordId,
    mode,
    max_count: maxCount,
    status: 'open',
  });
}

export async function markRecruitmentStatus(env, messageId, status) {
  return fetchSupabase(env, 'recruitments', `discord_message_id=eq.${messageId}`, 'PATCH', {
    status,
    updated_at: new Date().toISOString(),
  });
}
