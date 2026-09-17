import { sendDiscordMessage } from './api.js';
import { CONFIG } from '../config.js';

/**
 * KTM Botの例外や非同期処理の失敗を管理者に通知するヘルパー
 * @param {object} env - Cloudflare Workers 環境オブジェクト
 * @param {Error|string} error - 発生したエラー
 * @param {object} [context] - エラー発生時のコンテキスト情報 (command, userId, customId など)
 */
export async function notifyAdminError(env, error, context = {}) {
  const errMsg = error?.message || String(error);
  const errStack = error?.stack ? error.stack.slice(0, 1000) : 'No stack trace';
  const timestamp = new Date().toISOString();

  // 構造化ログを出力
  console.error('[ADMIN_ALERT]', JSON.stringify({
    timestamp,
    error: errMsg,
    stack: errStack,
    context
  }));

  // Discord Embed の作成
  const fields = [
    { name: '⏰ 発生時刻', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    { name: '🏷️ エラー概要', value: `\`\`\`${errMsg.slice(0, 250)}\`\`\``, inline: false },
  ];

  if (context.command) {
    fields.push({ name: '⌨️ コマンド', value: `\`/${context.command}\``, inline: true });
  }
  if (context.customId) {
    fields.push({ name: '🔘 ボタン/モーダルID', value: `\`${context.customId}\``, inline: true });
  }
  if (context.userId) {
    fields.push({ name: '👤 実行ユーザー', value: `<@${context.userId}> (\`${context.userId}\`)`, inline: true });
  }

  fields.push({
    name: '📜 スタックトレース',
    value: `\`\`\`text\n${errStack.slice(0, 600)}\n\`\`\``,
    inline: false
  });

  const embed = {
    title: '🚨 【KTM Bot】システム例外アラート',
    color: 0xed4245, // 赤色
    fields,
    footer: { text: `KTM Bot SRE Watcher | env: ${env?.ENVIRONMENT || 'production'}` },
    timestamp
  };

  try {
    // 1. Webhook が設定されている場合は優先して送信
    if (env?.ADMIN_WEBHOOK_URL) {
      await fetch(env.ADMIN_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
      return;
    }

    // 2. 管理用チャンネルIDが設定されている場合はチャンネルへ送信
    const channelId = env?.ADMIN_LOG_CHANNEL_ID;
    if (channelId && env?.DISCORD_TOKEN) {
      await sendDiscordMessage(`channels/${channelId}/messages`, env.DISCORD_TOKEN, 'POST', {
        embeds: [embed]
      });
    }
  } catch (notifyErr) {
    // アラート送信自体の失敗で本体をクラッシュさせない
    console.error('Failed to dispatch admin alert:', notifyErr);
  }
}
