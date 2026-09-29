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

  // ⚠️ 2026-09-29: 配送結果を返すようにした。
  // 以前は成功/失敗を一切返さず、送信に失敗しても console.error だけが残っていた。
  // エラー管理チャンネルが消えていた・Botに投稿権限が無かった場合、**アラート経路自体が
  // 壊れていることに誰も気づけない**（アラートを頼りにしている以上、ここが最後の砦になる）。
  // 呼び出し元は戻り値を無視してもよいが、自己診断（/trigger-scheduled?mode=selftest_alert）
  // はこの結果を使って「実際に届いたか」を報告する。
  try {
    // 1. Webhook が設定されている場合は優先して送信
    if (env?.ADMIN_WEBHOOK_URL) {
      const res = await fetch(env.ADMIN_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
      if (!res.ok) {
        console.error(`[ADMIN_ALERT] Webhook送信に失敗: HTTP ${res.status}`);
      }
      return { delivered: res.ok, via: 'webhook', status: res.status };
    }

    // 2. 指定のエラー管理用チャンネルへ直接送信
    const channelId = env?.ADMIN_LOG_CHANNEL_ID || CONFIG.ERROR_LOG_CHANNEL_ID || "1550118540038774865";
    const token = env?.DISCORD_TOKEN;
    if (!channelId || !token) {
      const reason = !token ? 'DISCORD_TOKEN が未設定' : 'チャンネルIDが解決できない';
      console.error(`[ADMIN_ALERT] 送信先が無いため通知できません: ${reason}`);
      return { delivered: false, via: 'none', error: reason };
    }

    const res = await sendDiscordMessage(`channels/${channelId}/messages`, token, 'POST', {
      embeds: [embed]
    });
    if (!res.ok) {
      // sendDiscordMessage 側でも console.error するが、ここで「アラートが届いていない」ことを
      // 明示的に記録する（チャンネル削除・権限不足・IDの誤りがこの経路で表面化する）
      console.error(`[ADMIN_ALERT] チャンネル ${channelId} への通知に失敗: HTTP ${res.status}`);
    }
    return { delivered: res.ok, via: 'channel', channelId, status: res.status };
  } catch (notifyErr) {
    // アラート送信自体の失敗で本体をクラッシュさせない
    console.error('Failed to dispatch admin alert:', notifyErr);
    return { delivered: false, via: 'exception', error: notifyErr?.message || String(notifyErr) };
  }
}
