import { fetchSupabase } from './supabase.js';

/**
 * カスタム募集のエントリー・辞退・変更操作を監査ログテーブルに記録する
 * （失敗してもユーザーのボタン操作には影響を与えない安全設計）
 */
export async function recordRecruitmentActivity(env, {
  messageId,
  recruitmentType, // 'periodic_sat' | 'periodic_sun' | 'spontaneous'
  channelId,
  userId,
  userName,
  action, // 'JOIN' | 'LEAVE' | 'SWITCH_STYLE' | 'PROXY_ADD'
  style = null, // 'full' | 'single' | 'late' | null
  metadata = {}
}) {
  try {
    if (!env?.SUPABASE_URL || !env?.SUPABASE_KEY) return;
    await fetchSupabase(env, 'recruitment_activity_logs', '', 'POST', {
      message_id: String(messageId),
      recruitment_type: recruitmentType,
      channel_id: channelId ? String(channelId) : null,
      user_id: String(userId),
      user_name: userName || 'Unknown',
      action,
      style: style || null,
      metadata: metadata || {}
    });
  } catch (err) {
    console.warn('[recruitmentAudit] Failed to record activity log:', err);
  }
}
