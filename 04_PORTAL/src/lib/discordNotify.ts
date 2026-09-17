export const DEFAULT_SHOP_CHANNEL_ID = '1545806575770276061';

/**
 * ショップ専用Discordチャンネル（1545806575770276061 / #ショップ通知）へ通知を送信
 */
export async function sendShopNotification(payload: {
  content?: string;
  embeds?: any[];
}): Promise<boolean> {
  const shopWebhookUrl = process.env.DISCORD_SHOP_WEBHOOK_URL;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const shopChannelId = process.env.DISCORD_SHOP_CHANNEL_ID || DEFAULT_SHOP_CHANNEL_ID;

  // 1. ショップ専用Webhookがある場合はWebhookで送信
  if (shopWebhookUrl) {
    try {
      const res = await fetch(shopWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn('[discordNotify] Shop webhook send failed:', e);
    }
  }

  // 2. Discord Bot Token を使って指定チャンネル（#ショップ通知）へ直接送信
  if (botToken && shopChannelId) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${shopChannelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
      const errText = await res.text();
      console.warn(`[discordNotify] Bot channel message send failed (${res.status}):`, errText);
    } catch (e) {
      console.warn('[discordNotify] Bot channel send error:', e);
    }
  }

  // 3. フォールバック（試合速報Webhook）
  const fallbackWebhook = process.env.DISCORD_KTM_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (fallbackWebhook) {
    try {
      const res = await fetch(fallbackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      console.warn('[discordNotify] Fallback webhook send failed:', e);
    }
  }

  return false;
}

export const DEFAULT_RANK_CHANNEL_ID = '1485995428548972595';

/**
 * 🏆 最高ランク更新（昇格）時の祝賀通知をDiscordへ送信
 * 通知先: チャンネルID 1485995428548972595
 */
export async function sendRankUpgradeNotification(params: {
  playerName: string;
  discordId?: string | null;
  oldRank?: string | null;
  newRank: string;
  ign?: string | null;
}): Promise<boolean> {
  const { playerName, discordId, oldRank, newRank, ign } = params;

  // 新規登録時（oldRankが未設定またはUNRANKED）および newRankがUNRANKEDの場合は通知しない
  const cleanOld = (oldRank || '').toUpperCase().trim();
  const cleanNew = (newRank || '').toUpperCase().trim();
  if (!cleanOld || cleanOld === 'UNRANKED' || !cleanNew || cleanNew === 'UNRANKED') {
    return false;
  }

  const oldRankDisplay = oldRank || 'UNRANKED';

  const mention = discordId ? `<@${discordId}>` : `**${playerName}**`;
  const content = `🎉 **【最高ランク更新速報！】** ${mention} さんが最高ランクを更新しました！`;

  const embed = {
    title: '🏆 最高ランク更新（昇格）おめでとうございます！',
    description: `${mention} さんのSoloQ最高ランクが **${newRank}** に到達しました！✨\n次回カスタムでのキャリー・大活躍に期待しています！`,
    color: 0xF59E0B, // Amber/Gold
    fields: [
      { name: '👤 プレイヤー', value: playerName, inline: true },
      { name: '📈 ランク変動', value: `\`${oldRankDisplay}\` ➔ **🔥 ${newRank}**`, inline: true },
      ...(ign ? [{ name: '🎮 Riot ID', value: `\`${ign}\``, inline: true }] : []),
    ],
    footer: { text: 'KTM ポータル | ランク自動同期' },
    timestamp: new Date().toISOString(),
  };

  const payload = { content, embeds: [embed] };
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const rankChannelId = process.env.DISCORD_RANK_CHANNEL_ID || DEFAULT_RANK_CHANNEL_ID;
  const rankWebhookUrl = process.env.DISCORD_RANK_WEBHOOK_URL;

  // 1. 専用Webhookがある場合はWebhookで送信
  if (rankWebhookUrl) {
    try {
      const res = await fetch(rankWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn('[discordNotify] Rank webhook send failed:', e);
    }
  }

  // 2. 指定チャンネル (1485995428548972595) へBot Tokenで直接送信
  if (botToken && rankChannelId) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${rankChannelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
      const errText = await res.text();
      console.warn(`[discordNotify] Rank channel (${rankChannelId}) message send failed (${res.status}):`, errText);
    } catch (e) {
      console.warn('[discordNotify] Bot channel send error for rank notification:', e);
    }
  }

  // 3. フォールバック (メイン大会・試合速報Webhook)
  const fallbackWebhook = process.env.DISCORD_KTM_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (fallbackWebhook) {
    try {
      const res = await fetch(fallbackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      console.warn('[discordNotify] Rank upgrade fallback webhook send failed:', e);
    }
  }

  return false;
}

export const DEFAULT_ERROR_LOG_CHANNEL_ID = '1550118540038774865';

export interface PortalErrorLogParams {
  error: Error | string | unknown;
  source?: 'API' | 'CLIENT' | 'CRON' | 'SERVER_ACTION';
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userName?: string;
  context?: Record<string, any>;
}

// 同一エラーのスパム通知防止キャッシュ (キー: エラーサマリー, 値: 最終送信UNIXミリ秒)
const recentErrorsMap = new Map<string, number>();
const ERROR_DEBOUNCE_MS = 30000; // 30秒間は同一エラーの再送を抑制

/**
 * 🚨 ポータルで発生した例外・クラッシュを Discord 監視チャンネル (1550118540038774865) へ通知
 */
export async function notifyPortalError(params: PortalErrorLogParams): Promise<boolean> {
  const { error, source = 'API', path = 'UNKNOWN', method, statusCode, userId, userName, context } = params;

  let errMsg = '';
  let errStack = '';

  if (error instanceof Error) {
    errMsg = error.message || error.name;
    errStack = error.stack || '';
  } else if (typeof error === 'string') {
    errMsg = error;
  } else {
    try {
      errMsg = JSON.stringify(error);
    } catch {
      errMsg = String(error);
    }
  }

  // デバウンス判定
  const debounceKey = `${source}:${path}:${errMsg.slice(0, 100)}`;
  const now = Date.now();
  const lastSent = recentErrorsMap.get(debounceKey) || 0;
  if (now - lastSent < ERROR_DEBOUNCE_MS) {
    return false; // 短時間の重複送信をスキップ
  }
  recentErrorsMap.set(debounceKey, now);

  // 古いキャッシュのクリーンアップ (100件超えたら古いものを削除)
  if (recentErrorsMap.size > 100) {
    for (const [k, time] of recentErrorsMap.entries()) {
      if (now - time > ERROR_DEBOUNCE_MS * 2) {
        recentErrorsMap.delete(k);
      }
    }
  }

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: '📍 発生源', value: `\`${source}\``, inline: true },
    { name: '🧭 パス/URL', value: `\`${method ? `${method} ` : ''}${path}\``, inline: true },
  ];

  if (statusCode) {
    fields.push({ name: '📊 ステータス', value: `\`HTTP ${statusCode}\``, inline: true });
  }

  if (userId || userName) {
    fields.push({
      name: '👤 ユーザー',
      value: `${userName || '不明'} ${userId ? `(\`${userId}\`)` : ''}`,
      inline: true,
    });
  }

  fields.push({
    name: '🏷️ エラー内容',
    value: `\`\`\`${errMsg.slice(0, 300)}\`\`\``,
    inline: false,
  });

  if (errStack) {
    fields.push({
      name: '📜 スタックトレース (抜粋)',
      value: `\`\`\`text\n${errStack.slice(0, 500)}\n\`\`\``,
      inline: false,
    });
  }

  if (context && Object.keys(context).length > 0) {
    try {
      const ctxStr = JSON.stringify(context, null, 2);
      fields.push({
        name: '📦 付加情報 (Context)',
        value: `\`\`\`json\n${ctxStr.slice(0, 400)}\n\`\`\``,
        inline: false,
      });
    } catch {}
  }

  const embed = {
    title: `🚨 【KTM ポータル】${source} エラー検知`,
    color: 0xED4245, // 赤色
    fields,
    footer: { text: `KTM Portal Error Watcher | ${process.env.NODE_ENV || 'production'}` },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    content: `⚠️ **【ポータルエラー検知】** \`${path}\` にてエラーが発生しました`,
    embeds: [embed],
  };

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_ERROR_LOG_CHANNEL_ID || DEFAULT_ERROR_LOG_CHANNEL_ID;
  const webhookUrl = process.env.DISCORD_ERROR_LOG_WEBHOOK_URL;

  // 1. Webhook が設定されていれば Webhook で送信
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn('[discordNotify] Error log webhook send failed:', e);
    }
  }

  // 2. Bot Token で指定チャンネル (1550118540038774865) へ直接送信
  if (botToken && channelId) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
      const errText = await res.text();
      console.warn(`[discordNotify] Error log channel (${channelId}) message send failed (${res.status}):`, errText);
    } catch (e) {
      console.warn('[discordNotify] Bot channel send error for error notification:', e);
    }
  }

  // 3. フォールバック (メイン大会Webhook)
  const fallbackWebhook = process.env.DISCORD_KTM_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (fallbackWebhook) {
    try {
      const res = await fetch(fallbackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      console.warn('[discordNotify] Error fallback webhook send failed:', e);
    }
  }

  return false;
}

/**
 * 📩 Discord Bot Token を使用して対象ユーザーへ個別ダイレクトメッセージ (DM) を送信
 */
export async function sendDiscordDirectMessage(
  discordId: string,
  payload: {
    content?: string;
    embeds?: any[];
  }
): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken || !discordId) {
    console.warn('[discordNotify] Bot token or target discordId is missing for DM.');
    return false;
  }

  try {
    // 1. 対象ユーザーとのDMチャンネルを作成/取得
    const dmChannelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!dmChannelRes.ok) {
      const errText = await dmChannelRes.text();
      console.warn(`[discordNotify] Failed to open DM channel with ${discordId} (${dmChannelRes.status}):`, errText);
      return false;
    }

    const dmChannel = await dmChannelRes.json();
    const channelId = dmChannel.id;

    // 2. DMチャンネルへメッセージを送信
    const sendRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (sendRes.ok) {
      return true;
    } else {
      const sendErrText = await sendRes.text();
      console.warn(`[discordNotify] DM message send failed (${sendRes.status}):`, sendErrText);
      return false;
    }
  } catch (err) {
    console.warn('[discordNotify] Exception during sendDiscordDirectMessage:', err);
    return false;
  }
}



