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


