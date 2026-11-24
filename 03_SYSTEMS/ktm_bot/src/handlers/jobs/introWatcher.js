import { CONFIG } from '../../config.js';
import { fetchPortalAPI } from '../../utils/api.js';
import { notifyAdminError } from '../../utils/alert.js';

const ONBOARDING_START_MS = Date.parse('2026-10-08T07:00:00.000Z');
const ID_SHAPE_REGEX = /[^\s\n\r#]+\s*#\s*[a-zA-Z0-9ぁ-んァ-ヶー一-龠]+/;

/**
 * 自己紹介チャンネルの直近メッセージをチェックし、未処理メッセージを抽出する共通関数
 * @param {object} env
 * @returns {Promise<{ ok: boolean, pendingCount: number, checked: number, pendingAuthors: string[], pendingMessages: any[], error?: string, status?: number }>}
 */
export async function checkPendingIntros(env) {
  const token = env.DISCORD_TOKEN;
  if (!token) {
    return { ok: false, error: 'DISCORD_TOKEN is not configured', status: 500 };
  }

  const res = await fetch(`https://discord.com/api/v10/channels/${CONFIG.INTRO_CHANNEL_ID}/messages?limit=15`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) {
    const errBody = (await res.text().catch(() => '')).slice(0, 200);
    return { ok: false, error: `Discord API ${res.status}: ${errBody}`, status: 502 };
  }

  const messages = await res.json();
  const pendingMessages = (Array.isArray(messages) ? messages : []).filter((m) => {
    if (m.author?.bot) return false;
    const ts = Date.parse(m.timestamp);
    if (!Number.isFinite(ts) || ts < ONBOARDING_START_MS) return false;
    const hasCheck = Array.isArray(m.reactions) && m.reactions.some((r) => r.emoji?.name === '✅');
    if (hasCheck) return false;
    return typeof m.content === 'string' && ID_SHAPE_REGEX.test(m.content);
  });

  return {
    ok: true,
    pendingCount: pendingMessages.length,
    checked: Array.isArray(messages) ? messages.length : 0,
    pendingAuthors: pendingMessages.map((m) => m.author?.global_name || m.author?.username || m.author?.id),
    pendingMessages,
  };
}

/**
 * 定期実行ジョブ: 未処理の自己紹介を監視し、存在する場合のみ Portal の process-intro を呼び出す
 * @param {object} env
 * @returns {Promise<{ action: 'skipped' | 'processed' | 'error', reason?: string, pendingCount?: number, checked?: number, portalResult?: any, error?: string }>}
 */
export async function watchPendingIntros(env) {
  try {
    const checkResult = await checkPendingIntros(env);
    if (!checkResult.ok) {
      const err = new Error(checkResult.error || 'Check pending intros failed');
      await notifyAdminError(env, err, { action: 'intro_watch（自己紹介監視プリチェック）' }).catch(() => {});
      return { action: 'error', reason: checkResult.error };
    }

    if (checkResult.pendingCount === 0) {
      return {
        action: 'skipped',
        reason: '未処理自己紹介0件（Vercel起動スキップ）',
        checked: checkResult.checked,
      };
    }

    console.log(`[intro_watch] ${checkResult.pendingCount}件の未処理自己紹介を検知。Portal process-intro を実行します...`);

    const portalResult = await fetchPortalAPI(env, '/api/onboarding/process-intro', {});
    return {
      action: 'processed',
      pendingCount: checkResult.pendingCount,
      pendingAuthors: checkResult.pendingAuthors,
      portalResult,
    };
  } catch (err) {
    console.error('[intro_watch] エラー発生:', err);
    await notifyAdminError(env, err, { action: 'intro_watch（自己紹介オンボーディング実行）' }).catch(() => {});
    return {
      action: 'error',
      reason: err?.message || String(err),
    };
  }
}
