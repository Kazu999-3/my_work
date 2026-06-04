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
    const clone = res.clone();
    const errorText = await clone.text();
    console.error(`Discord API Error (${endpoint}): ${res.status} ${errorText}`);
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

/** GAS への通信ラップ (レガシー) */
export async function fetchGAS(payload) {
  const res = await fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GAS HTTP Error: ${res.status} - ${errorText}`);
  }
  const data = await res.json();
  if (data && data.status && data.status !== "SUCCESS") {
    throw new Error(data.message || `GAS Error: ${JSON.stringify(data)}`);
  }
  return data;
}

/** Webポータル (Next.js) API への通信ラップ */
export async function fetchPortalAPI(env, endpointPath, payload, method = "POST") {
  const baseUrl = env.PORTAL_API_URL || "https://ktm-portal.vercel.app";
  const url = `${baseUrl}${endpointPath}`;
  
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  
  if (payload && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(payload);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Portal API Error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

