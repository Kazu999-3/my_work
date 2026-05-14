import { CONFIG } from '../config.js';

/** Discord へのメッセージ送信・更新 (Webhook / PATCH) */
export async function sendDiscordMessage(endpoint, token, method, bodyJSON) {
  const url = `https://discord.com/api/v10/${endpoint}`;
  const headers = {
    "Authorization": `Bot ${token}`,
    "Content-Type": "application/json"
  };
  const res = await fetch(url, { method, headers, body: JSON.stringify(bodyJSON) });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Discord API Error (${endpoint}):`, errorText);
    throw new Error(`Discord API Error: ${errorText}`);
  }
  return res;
}

/** Interaction元メッセージへのPATCH更新 (Deferred用) */
export async function patchInteractionResponse(appId, token, bodyJSON) {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyJSON)
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Discord PATCH Error:", errorText);
    throw new Error(`Discord PATCH Error: ${errorText}`);
  }
  return res;
}

/** Interaction時のWebhook経由での追加メッセージ送信 */
export async function sendInteractionFollowup(appId, token, bodyJSON) {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyJSON)
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Discord Followup Error:", errorText);
    throw new Error(`Discord Followup Error: ${errorText}`);
  }
  return res;
}

/** GAS への通信ラップ */
export async function fetchGAS(payload) {
  const res = await fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}
