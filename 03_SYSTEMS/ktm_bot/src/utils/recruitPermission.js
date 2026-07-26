/**
 * 募集(recruitments)テーブルへの記録・状態更新と、システム管理者(ADMIN_DISCORD_IDS)の解決。
 * 編集・削除の可否そのものは components.js 側で募集メッセージのメタデータ(owner)を
 * 基準に判定している（DBの recruitments 行はベストエフォート作成のため、
 * これに依存すると作成失敗時に募集主本人が編集できなくなる恐れがある）。
 */
import { fetchSupabase } from './supabase.js';

export function getAdminDiscordIds(env) {
  const idsStr = env.ADMIN_DISCORD_IDS || '';
  return idsStr.split(',').map((id) => id.trim()).filter(Boolean);
}

/** モーダル送信時などに募集レコードを新規作成する。startAt(ISO)があれば開始リマインド対象になる。 */
export async function createRecruitment(env, { messageId, channelId, ownerDiscordId, mode, maxCount, startAt = null }) {
  const row = {
    discord_message_id: messageId,
    discord_channel_id: channelId,
    owner_discord_id: ownerDiscordId,
    mode,
    max_count: maxCount,
    status: 'open',
  };
  if (startAt) row.start_at = startAt;
  return fetchSupabase(env, 'recruitments', '', 'POST', row);
}

export async function markRecruitmentStatus(env, messageId, status) {
  return fetchSupabase(env, 'recruitments', `discord_message_id=eq.${messageId}`, 'PATCH', {
    status,
    updated_at: new Date().toISOString(),
  });
}
