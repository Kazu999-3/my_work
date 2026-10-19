import { discordFetch } from './discordFetch';
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
      const res = await discordFetch(shopWebhookUrl, {
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
      const res = await discordFetch(`https://discord.com/api/v10/channels/${shopChannelId}/messages`, {
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
      const res = await discordFetch(fallbackWebhook, {
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
export async function sendRankUpgradeNotification(_params: {
  playerName: string;
  discordId?: string | null;
  oldRank?: string | null;
  newRank: string;
  ign?: string | null;
}): Promise<boolean> {
  // ユーザー方針（2026-10-20）: 昇格時の通知・ボーナス挙動は不要のため常時スキップ
  return false;
}

export const DEFAULT_ERROR_LOG_CHANNEL_ID = '1550118540038774865';

// エラーログ(#エラーログ)は失敗だけを集める場所（2026-10-08 ユーザー判断: 成功報告は流さない）。
// 04・05・ワーカー・健康診断の失敗をここへ集約するため、どこで起きたかを app で示す。
// 例外: 毎朝の健康診断は異常が無くても毎日ここへ送る（2026-10-19 ユーザー指示。notifyHealthReport）。
export type ErrorLogApp = '04' | '05' | 'worker' | 'health';
const ERROR_LOG_APP_LABEL: Record<ErrorLogApp, string> = {
  '04': '04 ポータル',
  '05': '05 Pilot',
  worker: 'ワーカー',
  health: '健康診断',
};

export interface PortalErrorLogParams {
  error: Error | string | unknown;
  app?: ErrorLogApp;
  source?: 'API' | 'CLIENT' | 'CRON' | 'SERVER_ACTION' | 'TASK';
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
  const { error, app = '04', source = 'API', path = 'UNKNOWN', method, statusCode, userId, userName, context } = params;
  const appLabel = ERROR_LOG_APP_LABEL[app] ?? ERROR_LOG_APP_LABEL['04'];

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
  const debounceKey = `${app}:${source}:${path}:${errMsg.slice(0, 100)}`;
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
    title: `🚨 【${appLabel}】${source} エラー検知`,
    color: 0xED4245, // 赤色
    fields,
    footer: { text: `KTM Portal Error Watcher | ${process.env.NODE_ENV || 'production'}` },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    content: `⚠️ **【${appLabel}】** \`${path}\` で失敗が発生しました`,
    embeds: [embed],
    // エラー文には外部から送られた文字列が入るため、@everyone 等のメンションを一切鳴らさない
    allowed_mentions: { parse: [] },
  };

  return deliverToErrorLog(payload);
}

/** #エラーログ への送信（Webhook → Bot → 大会Webhook の順に試す）。エラー通知と毎朝の健康診断で共用する。 */
async function deliverToErrorLog(payload: Record<string, any>): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_ERROR_LOG_CHANNEL_ID || DEFAULT_ERROR_LOG_CHANNEL_ID;
  const webhookUrl = process.env.DISCORD_ERROR_LOG_WEBHOOK_URL;

  // 1. Webhook が設定されていれば Webhook で送信
  if (webhookUrl) {
    try {
      const res = await discordFetch(webhookUrl, {
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
      const res = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
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
      const res = await discordFetch(fallbackWebhook, {
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

export interface HealthReportParams {
  worst: 'OK' | 'WARN' | 'FAIL';
  counts: { OK?: number; WARN?: number; FAIL?: number };
  body: string;
}

/**
 * 🩺 毎朝の健康診断（scripts/production_health_report.py）の結果を #エラーログ へ送る。
 * 2026-10-19 ユーザー指示: 05 の通知ベルには出さず、Discord の #エラーログ に毎朝送る。
 * 異常が無い日も送る（届かない＝健康診断自体が止まった、と気づけるようにするため）。
 * 結果に応じて色を変え、異常がある時だけ本文の前に目立つ一行を付ける。
 */
export async function notifyHealthReport(params: HealthReportParams): Promise<boolean> {
  const { worst, counts, body } = params;
  const fail = counts.FAIL || 0;
  const warn = counts.WARN || 0;
  const ok = counts.OK || 0;
  const head = worst === 'FAIL' ? `🚨 異常 ${fail}件` : worst === 'WARN' ? `⚠️ 注意 ${warn}件` : '✅ 異常なし';
  const color = worst === 'FAIL' ? 0xed4245 : worst === 'WARN' ? 0xfee75c : 0x57f287;

  const embed = {
    title: `🩺 毎朝の健康診断: ${head}`,
    description: body.slice(0, 4000) || '（項目なし）',
    color,
    footer: { text: `異常 ${fail} / 注意 ${warn} / 正常 ${ok}` },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    content: worst === 'FAIL' ? '🚨 **【健康診断】** 異常があります（GitHub Issue も起票済み）' : undefined,
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };
  return deliverToErrorLog(payload);
}

// 互換エイリアス
export const sendErrorNotification = notifyPortalError;

/**
 * 📩 Discord Bot Token を使用して対象ユーザーへ個別ダイレクトメッセージ (DM) を送信
 */
export async function sendDiscordDirectMessage(
  discordId: string,
  payload: {
    content?: string;
    embeds?: any[];
    components?: any[];
  }
): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken || !discordId) {
    console.warn('[discordNotify] Bot token or target discordId is missing for DM.');
    return false;
  }

  try {
    // 1. 対象ユーザーとのDMチャンネルを作成/取得
    const dmChannelRes = await discordFetch('https://discord.com/api/v10/users/@me/channels', {
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
    const sendRes = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
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

/**
 * カスタムの試合進行状況に合わせて、指定のボイスチャットチャンネル名を自動更新する
 * （例: 「１戦目進行中・交代歓迎」「インターバル・交代募集中」など）
 */
export async function updateCustomVoiceChannelStatus(statusText: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CUSTOM_STATUS_VC_ID || '1548675524086472796';

  if (!botToken || !channelId) {
    console.warn('[discordNotify] Cannot update VC channel: DISCORD_BOT_TOKEN or channelId not set');
    return false;
  }

  try {
    const res = await discordFetch(`https://discord.com/api/v10/channels/${channelId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: statusText }),
    });

    if (res.ok) {
      console.log(`[discordNotify] VC channel name updated to: "${statusText}"`);
      return true;
    } else {
      const errText = await res.text();
      console.warn(`[discordNotify] Failed to update VC channel name (${res.status}):`, errText);
      return false;
    }
  } catch (err) {
    console.warn('[discordNotify] Exception during updateCustomVoiceChannelStatus:', err);
    return false;
  }
}



