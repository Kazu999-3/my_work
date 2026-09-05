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
