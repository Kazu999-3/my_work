var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-0S1tsa/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-0S1tsa/checked-fetch.js"() {
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// .wrangler/tmp/bundle-0S1tsa/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
var init_strip_cf_connecting_ip_header = __esm({
  ".wrangler/tmp/bundle-0S1tsa/strip-cf-connecting-ip-header.js"() {
    __name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        return Reflect.apply(target, thisArg, [
          stripCfConnectingIPHeader.apply(null, argArray)
        ]);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// src/config.js
var CONFIG;
var init_config = __esm({
  "src/config.js"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    CONFIG = {
      ADMIN_ID: "697220229964759130",
      GAS_URL: "https://script.google.com/macros/s/AKfycbwpSuT-cSMkTHz2iUConeLDjdCE9mAHy0SeGOp_krX5OVjHJumpXq7LxIZ3eXFPuZAv/exec",
      RECRUIT_CHANNEL_ID: "1485995531434987541",
      MATCH_CHANNEL_ID: "1487077567939743995",
      STATS_CHANNEL_ID: "1489910822368186468",
      NOTIFICATION_ROLE_ID: "1513531261950492833"
    };
  }
});

// src/utils/api.js
var api_exports = {};
__export(api_exports, {
  fetchGAS: () => fetchGAS,
  fetchPortalAPI: () => fetchPortalAPI,
  patchInteractionResponse: () => patchInteractionResponse,
  sendDiscordMessage: () => sendDiscordMessage,
  sendInteractionFollowup: () => sendInteractionFollowup
});
async function sendDiscordMessage(endpoint, token, method, bodyJSON) {
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
async function patchInteractionResponse(appId, token, bodyJSON) {
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
async function sendInteractionFollowup(appId, token, bodyJSON) {
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
async function fetchGAS(payload) {
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
async function fetchPortalAPI(env, endpointPath, payload, method = "POST") {
  const baseUrl = env.PORTAL_API_URL || "https://my-work-8jbd.vercel.app";
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
var init_api = __esm({
  "src/utils/api.js"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_config();
    __name(sendDiscordMessage, "sendDiscordMessage");
    __name(patchInteractionResponse, "patchInteractionResponse");
    __name(sendInteractionFollowup, "sendInteractionFollowup");
    __name(fetchGAS, "fetchGAS");
    __name(fetchPortalAPI, "fetchPortalAPI");
  }
});

// src/ui/embeds.js
var embeds_exports = {};
__export(embeds_exports, {
  createMessageContent: () => createMessageContent,
  createRecruitButtons: () => createRecruitButtons,
  createRecruitEmbed: () => createRecruitEmbed,
  extractPlayersFromEmbed: () => extractPlayersFromEmbed,
  getPortalComponents: () => getPortalComponents,
  getPortalEmbed: () => getPortalEmbed,
  handleHelpPage: () => handleHelpPage,
  renderRoles: () => renderRoles,
  splitMessage: () => splitMessage
});
function createRecruitEmbed(metadata) {
  const isFull = metadata.joined.length >= metadata.maxCount;
  const title = isFull ? "\u2694\uFE0F \u30E1\u30F3\u30D0\u30FC\u78BA\u5B9A" : `\u2694\uFE0F KTM \u30E1\u30F3\u30D0\u30FC\u52DF\u96C6 [${metadata.joined.length}/${metadata.maxCount}]`;
  const ownerName = metadata.names[metadata.owner] || "\u4E0D\u660E";
  const visibleFooter = `\u30E2\u30FC\u30C9: ${metadata.mode} | \u52DF\u96C6\u4E3B: ${ownerName}`;
  const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));
  const pixelUrl = `https://raw.githubusercontent.com/nikolay-govorov/1x1-transparent-pixel/master/1x1.png?metadata=${encodedMetadata}`;
  return {
    title,
    description: renderRoles(metadata),
    color: isFull ? 15158332 : 3066993,
    thumbnail: { url: pixelUrl },
    footer: { text: visibleFooter },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function renderRoles(data) {
  const icons = { Top: "\u{1F6E1}\uFE0F", Jg: "\u2694\uFE0F", Mid: "\u{1F9D9}", Adc: "\u{1F3F9}", Sup: "\u{1FA79}" };
  let lines = [];
  if (data.mode === "\u30CE\u30FC\u30DE\u30EB") {
    lines.push("\u{1F7E6} **TEAM ROLES**");
    ["Top", "Jg", "Mid", "Adc", "Sup"].forEach((r) => lines.push(`${icons[r]} **${r}**: ${data.roles[r] ? `<@${data.roles[r]}>` : "\u25FD"}`));
    const pooled = data.joined.filter((id) => !Object.values(data.roles).includes(id));
    if (pooled.length > 0)
      pooled.forEach((id) => lines.push(`- <@${id}>`));
  } else {
    lines.push("\u{1F465} **PARTICIPANTS POOL**");
    data.joined.forEach((id, i) => lines.push(`${i + 1}. <@${id}>`));
    for (let i = data.joined.length + 1; i <= data.maxCount; i++)
      lines.push(`${i}. \u25FD`);
  }
  const specHeader = data.mode === "\u30CE\u30FC\u30DE\u30EB" || data.mode === "ARAM" ? "\u23F3 **\u30AB\u30B9\u30BF\u30E0\u5F85\u6A5F**" : "\u{1F441}\uFE0F **SPECTATORS**";
  if (data.spectating.length > 0) {
    lines.push(`
${specHeader}`);
    data.spectating.forEach((id) => lines.push(`- <@${id}>`));
  }
  return lines.join("\n");
}
function createRecruitButtons(metadata) {
  const isFull = metadata.joined.length >= metadata.maxCount;
  const spectateLabel = metadata.mode === "\u30CE\u30FC\u30DE\u30EB" || metadata.mode === "ARAM" ? "\u23F3 \u30AB\u30B9\u30BF\u30E0\u5F85\u6A5F" : "\u{1F441}\uFE0F \u89B3\u6226\u5E0C\u671B";
  const row1 = [];
  if (!isFull) {
    row1.push({ type: 2, label: "\u270B \u3069\u3053\u3067\u3082\u53C2\u52A0", style: 1, custom_id: `join_any:${metadata.owner}` });
  } else {
    if (metadata.mode === "\u30CE\u30FC\u30DE\u30EB" || metadata.mode === "ARAM") {
      row1.push({ type: 2, label: "\u2705 \u52DF\u96C6\u5B8C\u4E86 (\u540C\u671F\u6E08)", style: 2, custom_id: `recruit_completed`, disabled: true });
    } else {
      row1.push({ type: 2, label: "\u{1F3C6} \u30C1\u30FC\u30E0\u5206\u3051\u5B9F\u884C", style: 3, custom_id: `balance_from_recruit:${metadata.owner}` });
    }
  }
  row1.push({ type: 2, label: spectateLabel, style: 2, custom_id: `spectate:${metadata.owner}` });
  const row2 = [
    { type: 2, label: "\u2699\uFE0F \u52DF\u96C6\u7DE8\u96C6", style: 2, custom_id: `edit_recruit_init:${metadata.owner}` },
    { type: 2, label: "\u{1F4E2} \u4E00\u62EC\u9023\u7D61", style: 1, custom_id: `broadcast_start:${metadata.owner}` }
  ];
  if (!isFull && metadata.mode !== "\u30AB\u30B9\u30BF\u30E0" && metadata.joined.length >= 5) {
    row2.push({ type: 2, label: "\u{1F680} 10\u4EBA\u306B\u62E1\u5F35", style: 1, custom_id: `upgrade_to_10:${metadata.owner}` });
  }
  const row3 = [
    { type: 2, label: "\u{1F6A9} \u52DF\u96C6\u7D42\u4E86", style: 2, custom_id: `close:${metadata.owner}` },
    { type: 2, label: "\u{1F465} \u4EE3\u7406\u8FFD\u52A0", style: 2, custom_id: `proxy_add_init:${metadata.owner}` }
  ];
  const comps = [
    { type: 1, components: row1 },
    { type: 1, components: row2 },
    { type: 1, components: row3 }
  ];
  if (!isFull && metadata.mode === "\u30CE\u30FC\u30DE\u30EB") {
    comps.push({ type: 1, components: ["Top", "Jg", "Mid", "Adc", "Sup"].map((r) => ({ type: 2, label: r, style: 2, custom_id: `join_role:${r}:${metadata.owner}` })) });
  }
  return comps;
}
function getPortalEmbed() {
  return {
    title: "\u{1F6E1}\uFE0F KTM \u53F8\u4EE4\u5854: \u30DD\u30FC\u30BF\u30EBOS",
    description: "\u30C9\u30ED\u30C3\u30D7\u30C0\u30A6\u30F3\u304B\u3089\u64CD\u4F5C\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    color: 3426654,
    footer: { text: "KTM Sovereign OS v3.0 Portal" }
  };
}
function getPortalComponents(userId) {
  const row1 = [
    { type: 2, label: "\u2694\uFE0F \u52DF\u96C6\u958B\u59CB", style: 3, custom_id: "portal_recruit" },
    { type: 2, label: "\u{1F4CA} \u30DE\u30A4\u6226\u7E3E", style: 1, custom_id: "portal_stats" },
    { type: 2, label: "\u{1F4CD} \u30EC\u30FC\u30F3\u8A2D\u5B9A", style: 2, custom_id: "portal_lane" },
    { type: 2, label: "\u{1F4DD} \u30B5\u30E2\u30CA\u30FC\u540D\u767B\u9332", style: 2, custom_id: "portal_ign" }
  ];
  const row2 = [
    { type: 2, label: "\u{1F514} \u52DF\u96C6\u901A\u77E5 (ON/OFF)", style: 2, custom_id: "toggle_recruit_notification" },
    { type: 2, label: "\u{1F310} Web\u30DD\u30FC\u30BF\u30EB\u3078\u30A2\u30AF\u30BB\u30B9", style: 5, url: "https://my-work-8jbd.vercel.app/leaderboard" }
  ];
  return [
    { type: 1, components: row1 },
    { type: 1, components: row2 }
  ];
}
function handleHelpPage() {
  const pages = [
    { title: "\u{1F4DC} KTM \u30AC\u30A4\u30C9 (1/3): \u57FA\u672C", description: "VC\u3078\u5165\u308A\u3001\u30EC\u30FC\u30F3\u3092\u8A2D\u5B9A\u3057\u3066\u53C2\u52A0\u3057\u307E\u3057\u3087\u3046\u3002", color: 3447003 },
    { title: "\u2694\uFE0F KTM \u30AC\u30A4\u30C9 (2/3): \u52DF\u96C6", description: "\u53C2\u52A0/\u30AB\u30B9\u30BF\u30E0\u5F85\u6A5F/10\u4EBA\u62E1\u5F35\u306A\u3069\u306E\u30DC\u30BF\u30F3\u304C\u5229\u7528\u53EF\u80FD\u3067\u3059\u3002", color: 3066993 },
    { title: "\u{1F4CA} KTM \u30AC\u30A4\u30C9 (3/3): \u30EC\u30FC\u30C8", description: "\u5BFE\u6226\u7D50\u679C\u306B\u57FA\u3065\u304D MMR \u304C\u516C\u5E73\u306A\u30DE\u30C3\u30C1\u3092\u751F\u6210\u3057\u307E\u3059\u3002", color: 15105570 }
  ];
  return { embeds: pages };
}
function createMessageContent(metadata) {
  const lines = [];
  if (CONFIG.NOTIFICATION_ROLE_ID) {
    lines.push(`<@&${CONFIG.NOTIFICATION_ROLE_ID}>`);
  }
  if (metadata.time) {
    lines.push(`\u23F0 **\u958B\u59CB\u4E88\u5B9A**: ${metadata.time}`);
  }
  if (metadata.memo) {
    lines.push(`\u{1F4AC} **\u30E1\u30E2**: ${metadata.memo}`);
  }
  return lines.join("\n").trim();
}
function extractPlayersFromEmbed(embed) {
  const players = [];
  const fields = embed.fields || [];
  const teamAField = fields.find((f) => f.name.includes("Team A"));
  const teamBField = fields.find((f) => f.name.includes("Team B"));
  const parseLine = /* @__PURE__ */ __name((line, team) => {
    const match = line.match(/`([^`]+)`\s+(.+?)(?:\s*\(.*\))?\s*$/);
    if (!match)
      return null;
    return { role: match[1].trim(), name: match[2].trim(), team };
  }, "parseLine");
  if (teamAField)
    teamAField.value.split("\n").forEach((l) => {
      const p = parseLine(l, "BLUE");
      if (p)
        players.push(p);
    });
  if (teamBField)
    teamBField.value.split("\n").forEach((l) => {
      const p = parseLine(l, "RED");
      if (p)
        players.push(p);
    });
  return players;
}
function splitMessage(text, limit = 1800) {
  const chunks = [];
  let current = "";
  text.split("\n").forEach((line) => {
    if (current.length + line.length + 1 > limit) {
      if (current)
        chunks.push(current);
      current = "";
    }
    current += line + "\n";
  });
  if (current)
    chunks.push(current);
  return chunks;
}
var init_embeds = __esm({
  "src/ui/embeds.js"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_config();
    __name(createRecruitEmbed, "createRecruitEmbed");
    __name(renderRoles, "renderRoles");
    __name(createRecruitButtons, "createRecruitButtons");
    __name(getPortalEmbed, "getPortalEmbed");
    __name(getPortalComponents, "getPortalComponents");
    __name(handleHelpPage, "handleHelpPage");
    __name(createMessageContent, "createMessageContent");
    __name(extractPlayersFromEmbed, "extractPlayersFromEmbed");
    __name(splitMessage, "splitMessage");
  }
});

// src/utils/supabase.js
var supabase_exports = {};
__export(supabase_exports, {
  fetchSupabase: () => fetchSupabase,
  getPlayersByNames: () => getPlayersByNames,
  upsertPlayer: () => upsertPlayer
});
async function fetchSupabase(env, table, query = "", method = "GET", body = null) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
  const headers = {
    "apikey": env.SUPABASE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
  const options = { method, headers };
  if (body)
    options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase Error (${method} ${table}): ${res.status} ${errText}`);
  }
  if (method !== "DELETE") {
    return await res.json();
  }
  return null;
}
async function getPlayersByNames(env, names) {
  if (!names || names.length === 0)
    return [];
  const namesStr = names.map((n) => `"${encodeURIComponent(n)}"`).join(",");
  const query = `name=in.(${namesStr})`;
  return await fetchSupabase(env, "ktm_players", query);
}
async function upsertPlayer(env, player) {
  const headers = {
    "apikey": env.SUPABASE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
  let url;
  let method;
  const payload = { ...player };
  if (player.id) {
    url = `${env.SUPABASE_URL}/rest/v1/ktm_players?id=eq.${player.id}`;
    method = "PATCH";
    delete payload.id;
    delete payload.created_at;
  } else {
    url = `${env.SUPABASE_URL}/rest/v1/ktm_players`;
    method = "POST";
  }
  const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase ${method} Error: ${res.status} ${errText}`);
  }
  return await res.json();
}
var init_supabase = __esm({
  "src/utils/supabase.js"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    __name(fetchSupabase, "fetchSupabase");
    __name(getPlayersByNames, "getPlayersByNames");
    __name(upsertPlayer, "upsertPlayer");
  }
});

// .wrangler/tmp/bundle-0S1tsa/middleware-loader.entry.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// .wrangler/tmp/bundle-0S1tsa/middleware-insertion-facade.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/utils/security.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
async function verifySignature(body, signature, timestamp, publicKey) {
  try {
    if (!signature || !timestamp || !publicKey)
      return false;
    const hexToUint8Array = /* @__PURE__ */ __name((hex) => {
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < arr.length; i++)
        arr[i] = parseInt(hex.substr(i * 2, 2), 16);
      return arr;
    }, "hexToUint8Array");
    const encoder = new TextEncoder();
    const timestampData = encoder.encode(timestamp);
    const bodyData = encoder.encode(body);
    const messageData = new Uint8Array(timestampData.length + bodyData.length);
    messageData.set(timestampData);
    messageData.set(bodyData, timestampData.length);
    const key = await crypto.subtle.importKey(
      "raw",
      hexToUint8Array(publicKey),
      { name: "Ed25519", namedCurve: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify("Ed25519", key, hexToUint8Array(signature), messageData);
  } catch (err) {
    return false;
  }
}
__name(verifySignature, "verifySignature");

// src/handlers/commands.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_config();
init_api();
init_embeds();
init_supabase();

// src/utils/helpers.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_config();
init_api();
function parseMessageData(message) {
  const content = message.content || "";
  const embed = message.embeds?.[0] || {};
  const footer = embed.footer?.text || "";
  const desc = embed.description || "";
  const timeMatch = content.match(/⏰ \*\*開始予定\*\*: ([\s\S]*?)(?=\n💬 \*\*メモ\*\*|$)/);
  const memoMatch = content.match(/💬 \*\*メモ\*\*: ([\s\S]*)/);
  let data = null;
  const thumbUrl = embed.thumbnail?.url || "";
  if (thumbUrl.includes("metadata=")) {
    try {
      const encodedData = thumbUrl.split("metadata=")[1];
      data = JSON.parse(decodeURIComponent(encodedData));
    } catch (e) {
      console.error("Thumbnail metadata decode error:", e);
    }
  }
  if (!data) {
    const metaMatch = desc.match(/\[[\u200b\u17b5]*\]\(http:\/\/metadata\?owner=([^&)]+)(?:&names=([^)]+))?\)/);
    data = {
      owner: metaMatch ? metaMatch[1] : "\u4E0D\u660E",
      maxCount: parseInt(embed.title?.match(/\[\d+\/(\d+)\]/)?.[1] || 10),
      mode: footer.match(/モード: ([^ |\[\n\u200b]+)/)?.[1] || "\u30AB\u30B9\u30BF\u30E0",
      time: timeMatch ? timeMatch[1].trim() : "",
      memo: memoMatch ? memoMatch[1].trim() : "",
      joined: [],
      spectating: [],
      roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null },
      names: {}
    };
    let isSpectatorSection = false;
    desc.split("\n").forEach((line) => {
      if (line.includes("SPECTATORS") || line.includes("\u30AB\u30B9\u30BF\u30E0\u5F85\u6A5F")) {
        isSpectatorSection = true;
        return;
      }
      const ids = line.match(/<@(\d+)>/g);
      if (!ids)
        return;
      ids.forEach((m) => {
        const id = m.match(/\d+/)[0];
        if (isSpectatorSection) {
          data.spectating.push(id);
        } else {
          data.joined.push(id);
          ["Top", "Jg", "Mid", "Adc", "Sup"].forEach((r) => {
            if (line.includes(r))
              data.roles[r] = id;
          });
        }
        data.names[id] = "\u30E6\u30FC\u30B6\u30FC";
      });
    });
    data.joined = [...new Set(data.joined)];
    if (metaMatch && metaMatch[2]) {
      try {
        const decodedNames = decodeURIComponent(metaMatch[2]);
        decodedNames.split(",").forEach((pair) => {
          const eqIdx = pair.indexOf("=");
          if (eqIdx > 0) {
            const id = pair.substring(0, eqIdx);
            const name = pair.substring(eqIdx + 1);
            if (id && name)
              data.names[id] = name;
          }
        });
      } catch (e) {
        console.error("Old metadata decode error:", e);
      }
    }
  }
  if (message.mentions)
    message.mentions.forEach((u) => data.names[u.id] = u.global_name || u.username);
  return data;
}
__name(parseMessageData, "parseMessageData");
async function handleAutoMatchEnd(interaction, players, winnerTeam, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;
  ctx.waitUntil((async () => {
    try {
      const { fetchPortalAPI: fetchPortalAPI2 } = await Promise.resolve().then(() => (init_api(), api_exports));
      const payload = {
        winningTeam: winnerTeam,
        gameDuration: 0,
        participants: players.map((p) => ({
          name: p.name,
          team: p.team,
          role: p.role,
          kills: 0,
          deaths: 0,
          assists: 0
        }))
      };
      const resultData = await fetchPortalAPI2(env, "/api/match/record", payload);
      if (resultData && resultData.matchId) {
        setTimeout(async () => {
          try {
            console.log(`Triggering match-sync for matchId: ${resultData.matchId}`);
            await fetchPortalAPI2(env, "/api/riot/match-sync", { matchId: resultData.matchId });
          } catch (err) {
            console.error("Match Sync Delayed Error:", err);
          }
        }, 18e4);
      }
    } catch (err) {
      console.error("AutoLog Error:", err);
    }
  })());
  const updatedEmbed = interaction.message.embeds[0];
  updatedEmbed.title = `\u2705 \u8A66\u5408\u7D42\u4E86: ${winnerTeam} \u52DD\u5229\u3067\u8A18\u9332\u3055\u308C\u307E\u3057\u305F`;
  updatedEmbed.color = winnerTeam === "BLUE" ? 3447003 : 15158332;
  if (!updatedEmbed.footer)
    updatedEmbed.footer = {};
  updatedEmbed.footer.text = `\u2705 \u8A18\u9332\u5B8C\u4E86 | \u7D043\u5206\u5F8C\u306B\u30EA\u30B6\u30EB\u30C8\u81EA\u52D5\u53D6\u5F97... (ID: ${Math.floor(Date.now() / 1e3).toString(16)})`;
  const postMatchComponents = [{
    type: 1,
    components: [
      { type: 2, label: "\u{1F504} \u6B21\u306E\u8A66\u5408\u3092\u632F\u308B", style: 3, custom_id: "rebalance" }
    ]
  }];
  return Response.json({
    type: 7,
    data: { embeds: [updatedEmbed], components: postMatchComponents }
  });
}
__name(handleAutoMatchEnd, "handleAutoMatchEnd");

// src/handlers/commands.js
function handleRecruitDirect(interaction) {
  const options = interaction.data.options || [];
  const getOpt = /* @__PURE__ */ __name((name) => options.find((o) => o.name === name)?.value, "getOpt");
  const mode = getOpt("mode") || "\u30AB\u30B9\u30BF\u30E0";
  const time = getOpt("time") || "";
  const max = parseInt(getOpt("max") || (mode === "\u30AB\u30B9\u30BF\u30E0" ? 10 : 5));
  const memo = getOpt("memo") || "";
  const userId = interaction.member.user.id;
  const initialJoined = [userId];
  const names = {};
  names[userId] = interaction.member.user.global_name || interaction.member.user.username;
  const resolvedUsers = interaction.data.resolved?.users || {};
  for (let i = 1; i <= 5; i++) {
    const pId = getOpt(`player${i}`);
    if (pId && !initialJoined.includes(pId)) {
      initialJoined.push(pId);
      const user = resolvedUsers[pId];
      if (user) {
        names[pId] = user.global_name || user.username || "Unknown";
      }
    }
  }
  const metadata = {
    mode,
    time,
    maxCount: max,
    memo,
    owner: userId,
    joined: initialJoined,
    spectating: [],
    roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null },
    names
  };
  return Response.json({
    type: 4,
    data: {
      content: createMessageContent(metadata),
      embeds: [createRecruitEmbed(metadata)],
      components: createRecruitButtons(metadata)
    }
  });
}
__name(handleRecruitDirect, "handleRecruitDirect");
function handleStatsCommand(interaction, env, ctx) {
  const discordId = interaction.member.user.id;
  const appId = interaction.application_id;
  const token = interaction.token;
  const discordName = interaction.member.user.global_name || interaction.member.user.username;
  ctx.waitUntil((async () => {
    try {
      const { fetchPortalAPI: fetchPortalAPI2 } = await Promise.resolve().then(() => (init_api(), api_exports));
      const data = await fetchPortalAPI2(env, "/api/player/stats", { discordId, discordName });
      if (data.status === "NOT_FOUND") {
        await patchInteractionResponse(appId, token, { content: "\u26A0\uFE0F \u3042\u306A\u305F\u306E Discord ID \u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002" });
        return;
      }
      const s = data.stats;
      const recentIcons = s.recent.map((m) => m.win ? "\u{1F7E6}" : "\u{1F7E5}").reverse().join("");
      const embed = {
        title: `\u{1F4CA} \u6226\u7E3E\u677F: ${data.player}`,
        fields: [
          { name: "\u{1F3C6} \u7DCF\u5408", value: `${s.total.g}\u6226 ${s.total.w}\u52DD \u52DD\u7387${(s.total.w / s.total.g * 100).toFixed(1)}%`, inline: true },
          { name: "\u{1F552} \u76F4\u8FD15\u8A66\u5408", value: recentIcons || "\u30C7\u30FC\u30BF\u306A\u3057", inline: true },
          { name: "\u{1F3EE} \u73FE\u5728\u306E\u4E0D\u904B\u5EA6 (Pity)", value: `**${data.pity || 0}** pts`, inline: true },
          { name: "\u{1F4CD} \u30DD\u30B8\u30B7\u30E7\u30F3\u5225 (MMR)", value: Object.entries(s.roles).map(([r, rs]) => {
            const mmr = data.mmrs[r] || 1200;
            return `${r}: **${mmr}** (${rs.g}\u6226 Win:${rs.g > 0 ? (rs.w / rs.g * 100).toFixed(0) : 0}%)`;
          }).join("\n"), inline: false }
        ],
        color: 3447003
      };
      if (data.rivalry && (data.rivalry.nemesis || data.rivalry.prey)) {
        let rivalryText = "";
        if (data.rivalry.nemesis)
          rivalryText += `\u{1F480} \u3088\u304F\u30AD\u30EB\u3055\u308C\u308B\u76F8\u624B: **${data.rivalry.nemesis.name}** (${data.rivalry.nemesis.count}\u56DE)
`;
        if (data.rivalry.prey)
          rivalryText += `\u{1F525} \u3088\u304F\u30AD\u30EB\u3059\u308B\u76F8\u624B: **${data.rivalry.prey.name}** (${data.rivalry.prey.count}\u56DE)`;
        embed.fields.push({ name: "\u2694\uFE0F \u5BBF\u547D\u306E\u30E9\u30A4\u30D0\u30EB", value: rivalryText || "\u30C7\u30FC\u30BF\u306A\u3057", inline: false });
      }
      const components = [];
      if (data.lolIgn && data.lolIgn.includes("#")) {
        const [name, tag] = data.lolIgn.split("#");
        const opggUrl = `https://www.op.gg/summoners/jp/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
        components.push({
          type: 1,
          components: [{ type: 2, label: "\u{1F310} OP.GG \u3067\u8A73\u7D30\u3092\u898B\u308B", style: 5, url: opggUrl }]
        });
      }
      await sendDiscordMessage(`channels/${CONFIG.STATS_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [embed] });
      await patchInteractionResponse(appId, token, { content: "\u2705 #\u6226\u7E3E\u677F \u306B\u767A\u8868\u3057\u307E\u3057\u305F\uFF01", components });
    } catch (e) {
      console.error(e);
      try {
        await patchInteractionResponse(appId, token, { content: `\u26A0\uFE0F \u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ${e.message}` });
      } catch (innerErr) {
      }
    }
  })());
  return Response.json({ type: 5, data: { flags: 64 } });
}
__name(handleStatsCommand, "handleStatsCommand");
async function handleAnnounceMatch(payload, env, ctx) {
  const { teamBlue = [], teamRed = [], spectators = [] } = payload || {};
  console.log("Received AnnounceMatch Payload:", JSON.stringify({ blue: teamBlue.length, red: teamRed.length, spec: spectators.length }));
  const renderTeam = /* @__PURE__ */ __name((team) => {
    if (!Array.isArray(team) || team.length === 0)
      return "\u306A\u3057";
    return team.map((p) => {
      const role = String(p.role || p.currentRole || "???").trim();
      const name = String(p.name || "Unknown").trim();
      const main = String(p.mainLane || "").toUpperCase();
      const sub = String(p.subLane || "").toUpperCase();
      const isMain = main === role || main === "ALL" || main === "";
      const isSub = !isMain && sub === role;
      const icon = isMain ? "\u2705" : isSub ? "\u{1F504}" : "\u26A0\uFE0F";
      const note = !isMain && main && main !== "ALL" ? ` (\u672C\u6765:${main})` : "";
      return `\`${role.padEnd(3)}\` ${icon} ${name}${note}`;
    }).join("\n") || "\u306A\u3057";
  }, "renderTeam");
  const embed = {
    title: "\u2694\uFE0F \u30C1\u30FC\u30E0\u5206\u3051\u306E\u7D50\u679C (from Spreadsheet)",
    color: 3066993,
    fields: [
      {
        name: "\u{1F7E6} Team A (Blue)",
        value: renderTeam(teamBlue),
        inline: true
      },
      {
        name: "\u{1F7E5} Team B (Red)",
        value: renderTeam(teamRed),
        inline: true
      }
    ],
    footer: { text: "KTM Bot | Spreadsheet Proxy" },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (Array.isArray(spectators) && spectators.length > 0) {
    embed.fields.push({
      name: "\u23F3 \u30AB\u30B9\u30BF\u30E0\u5F85\u6A5F",
      value: spectators.map((n) => String(n).trim()).join(", ") || "\u306A\u3057",
      inline: false
    });
  }
  const components = [
    {
      type: 1,
      components: [
        { type: 2, label: "\u{1F7E6} BLUE \u52DD\u5229", style: 1, custom_id: "win_blue:admin" },
        { type: 2, label: "\u{1F7E5} RED \u52DD\u5229", style: 4, custom_id: "win_red:admin" },
        { type: 2, label: "\u{1F504} \u6B21\u306E\u8A66\u5408\u3092\u632F\u308B", style: 3, custom_id: "rebalance" },
        { type: 2, label: "\u{1F575}\uFE0F OP.GG \u30B9\u30AB\u30A6\u30C6\u30A3\u30F3\u30B0", style: 2, custom_id: "opgg_scout" }
      ]
    }
  ];
  try {
    const res = await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [embed], components });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Discord send error:", res.status, errorText);
      return new Response(JSON.stringify({ status: "ERROR", message: `Discord API Error: ${res.status} - ${errorText}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return Response.json({ status: "SUCCESS" });
  } catch (err) {
    console.error("handleAnnounceMatch unexpected error:", err.message);
    return new Response(JSON.stringify({ status: "ERROR", message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleAnnounceMatch, "handleAnnounceMatch");
function handleLaneCommand(interaction, env, ctx) {
  const options = interaction.data.options || [];
  if (options.length > 0) {
    const getOpt = /* @__PURE__ */ __name((name) => options.find((o) => o.name === name)?.value, "getOpt");
    const main = getOpt("main"), sub = getOpt("sub") || "", ng1 = getOpt("ng1") || "", ng2 = getOpt("ng2") || "";
    const weight = getOpt("weight");
    const allowHigher = getOpt("allow_higher");
    const userId = interaction.member.user.id;
    const appId = interaction.application_id;
    const token = interaction.token;
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        const existingData = await fetchSupabase(env, "ktm_players", `discord_id=eq.${userId}`);
        const player = existingData && existingData.length > 0 ? existingData[0] : { discord_id: userId, name: discordName, is_active: true };
        player.role_preferences = player.role_preferences || {};
        if (main)
          player.role_preferences.primary = main;
        if (sub)
          player.role_preferences.secondary = sub;
        if (ng1)
          player.ng_lane_1 = ng1;
        if (ng2)
          player.ng_lane_2 = ng2;
        if (weight)
          player.weight = parseInt(weight);
        if (allowHigher !== void 0)
          player.allow_higher = allowHigher === "true" || allowHigher === true;
        await upsertPlayer(env, player);
        await patchInteractionResponse(appId, token, { content: `\u2705 **\u5F15\u6570\u304B\u3089\u30EC\u30FC\u30F3\u8A2D\u5B9A\u3092\u5B8C\u4E86\u3057\u307E\u3057\u305F**
\u30E1\u30A4\u30F3:${main} / \u30B5\u30D6:${sub} / \u3053\u3060\u308F\u308A:${weight || "\u672A\u6307\u5B9A"} / \u683C\u4E0A\u8A31\u53EF:${allowHigher !== void 0 ? allowHigher : "\u672A\u6307\u5B9A"}` });
      } catch (err) {
        console.error("Lane Update Error:", err);
        await patchInteractionResponse(appId, token, { content: `\u274C **\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F:** ${err.message}` }).catch((e) => console.error("Error reporting failed:", e));
      }
    })());
    return Response.json({ type: 5 });
  }
  return Response.json({
    type: 9,
    data: {
      title: "\u{1F4CD} \u5E0C\u671B\u30EC\u30FC\u30F3\u30FBNG\u30EC\u30FC\u30F3\u306E\u8A2D\u5B9A",
      custom_id: "portal_lane_modal",
      components: [
        { type: 1, components: [{ type: 4, custom_id: "main", label: "\u30E1\u30A4\u30F3\u30EC\u30FC\u30F3", style: 1, placeholder: "TOP/JG/MID/ADC/SUP/ALL", required: true }] },
        { type: 1, components: [{ type: 4, custom_id: "sub", label: "\u30B5\u30D6\u30EC\u30FC\u30F3", style: 1, required: false }] },
        { type: 1, components: [{ type: 4, custom_id: "weight", label: "\u3053\u3060\u308F\u308A\u5EA6 (1:\u7D76\u5BFE, 2:\u901A\u5E38, 3:\u67D4\u8EDF)", style: 1, placeholder: "1, 2, or 3", required: false }] },
        { type: 1, components: [{ type: 4, custom_id: "ng1", label: "NG\u30EC\u30FC\u30F31", style: 1, required: false }] },
        { type: 1, components: [{ type: 4, custom_id: "ng2", label: "NG\u30EC\u30FC\u30F32", style: 1, required: false }] }
      ]
    }
  });
}
__name(handleLaneCommand, "handleLaneCommand");
async function handleSetIgn(interaction, env, ctx) {
  const options = interaction.data?.options || [];
  const ign = options.find((o) => o.name === "name" || o.name === "\u30B5\u30E2\u30CA\u30FC\u540D")?.value;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const appId = interaction.application_id;
  const token = interaction.token;
  if (!ign) {
    const errorBody = JSON.stringify({ type: 4, data: { content: "\u26A0\uFE0F \u30B5\u30E2\u30CA\u30FC\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", flags: 64 } });
    return new Response(errorBody, { headers: { "Content-Type": "application/json" } });
  }
  const discordName = (interaction.member?.user || interaction.user).global_name || (interaction.member?.user || interaction.user).username;
  ctx.waitUntil((async () => {
    try {
      const existingData = await fetchSupabase(env, "ktm_players", `discord_id=eq.${userId}`);
      if (!existingData || existingData.length === 0) {
        await patchInteractionResponse(appId, token, { content: "\u26A0\uFE0F \u540D\u7C3F\u306B\u3042\u306A\u305F\u306E Discord ID \u304C\u898B\u308F\u305F\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u65B0\u30E1\u30F3\u30D0\u30FC\u540C\u671F\u3092\u5F85\u3064\u304B\u3001\u4E00\u5EA6\u5BFE\u6226\u306B\u53C2\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
      } else {
        const res = await fetch(`https://my-work-8jbd.vercel.app/api/player/update-puuid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discordId: userId, ign })
        });
        const data = await res.json();
        if (data.status === "SUCCESS") {
          await patchInteractionResponse(appId, token, { content: `\u2705 LoL IGN \u3092 **${ign}** \u306B\u8A2D\u5B9A\u3057\u3001Riot API \u3068\u306E\u7D10\u4ED8\u3051(PUUID)\u3092\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01\u3053\u308C\u4EE5\u964D\u3001\u30E9\u30F3\u30AF\u60C5\u5831\u304C\u81EA\u52D5\u540C\u671F\u3055\u308C\u307E\u3059\u3002` });
        } else {
          await patchInteractionResponse(appId, token, { content: `\u26A0\uFE0F IGN\u306F\u767B\u9332\u3055\u308C\u307E\u3057\u305F\u304C\u3001PUUID\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${data.message}` });
        }
      }
    } catch (err) {
      console.error("SetIGN Error:", err);
      await patchInteractionResponse(appId, token, { content: `\u274C \u767B\u9332\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ${err.message}` });
    }
  })());
  const successBody = JSON.stringify({
    type: 4,
    data: { content: "\u231B IGN\u306E\u767B\u9332\u3092\u958B\u59CB\u3057\u307E\u3057\u305F\u3002\u51E6\u7406\u5B8C\u4E86\u307E\u3067\u5C11\u3005\u304A\u5F85\u3061\u304F\u3060\u3055\u3044...", flags: 64 }
  });
  return new Response(successBody, { headers: { "Content-Type": "application/json" } });
}
__name(handleSetIgn, "handleSetIgn");
async function executeBalance(interaction, names, env, ctx, isRebalance = false) {
  const appId = interaction.application_id;
  const token = interaction.token;
  const authorId = interaction.member?.user?.id || interaction.user?.id;
  ctx.waitUntil((async () => {
    try {
      const progressEmbed = {
        title: "\u2699\uFE0F \u30C1\u30FC\u30E0\u5206\u3051\u8A08\u7B97\u4E2D...",
        description: "\u30DD\u30FC\u30BF\u30EBAPI\u7D4C\u7531\u3067\u6700\u9069\u306A\u30C1\u30FC\u30E0\u3092\u8A08\u7B97\u3057\u3066\u3044\u307E\u3059\u3002\u3057\u3070\u3089\u304F\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002",
        color: 15965202,
        footer: { text: "KTM Balancer | \u51E6\u7406\u4E2D..." }
      };
      if (isRebalance) {
        await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [progressEmbed] });
      } else {
        await patchInteractionResponse(appId, token, { embeds: [progressEmbed], components: [] });
      }
      let validNames = [...new Set(
        (names || []).map((n) => String(n).trim()).filter((n) => n && n !== "\u30E6\u30FC\u30B6\u30FC" && n !== "\u4E0D\u660E")
      )];
      if (validNames.length < 10) {
        throw new Error(`\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\uFF08\u73FE\u5728: ${validNames.length}\u540D\uFF09\u300210\u540D\u5FC5\u8981\u3067\u3059\u3002`);
      }
      let participants = [];
      try {
        if (interaction.message) {
          const metadata = parseMessageData(interaction.message);
          if (metadata && metadata.roles) {
            const fixedUsers = {};
            Object.entries(metadata.roles).forEach(([role, id]) => {
              if (id) {
                fixedUsers[id] = role.toUpperCase();
              }
            });
            participants = validNames.map((name) => {
              const dId = Object.keys(metadata.names || {}).find((key) => metadata.names[key] === name);
              const fixedRole = dId ? fixedUsers[dId] : null;
              return {
                name,
                isFixed: !!fixedRole,
                fixedRole: fixedRole || null
              };
            });
          }
        }
      } catch (e) {
        console.error("Failed to parse fixed players:", e);
      }
      if (participants.length === 0) {
        participants = validNames.map((name) => ({ name, isFixed: false, fixedRole: null }));
      }
      const portalUrl = env.PORTAL_API_URL || env.LOCAL_API_URL || "https://ktm-portal.vercel.app";
      const res = await fetch(`${portalUrl}/api/balancer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants })
      });
      if (!res.ok) {
        throw new Error(`\u30DD\u30FC\u30BF\u30EBAPI\u30A8\u30E9\u30FC: ${res.status} - ${await res.text()}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const { teamBlue, teamRed, spectators, balanceReport, banProtect } = data;
      const renderTeam = /* @__PURE__ */ __name((team) => {
        if (!Array.isArray(team) || team.length === 0)
          return "\u306A\u3057";
        return team.map((p) => {
          const role = String(p.currentRole || "FILL").trim();
          const name = String(p.name || "Unknown").trim();
          const main = String(p.mainLane || "").toUpperCase();
          const sub = String(p.subLane || "").toUpperCase();
          const isMain = main === role || main === "ALL" || main === "";
          const isSub = !isMain && sub === role;
          const icon = isMain ? "\u2705" : isSub ? "\u{1F504}" : "\u26A0\uFE0F";
          const note = !isMain && main && main !== "ALL" ? ` (\u672C\u6765:${main})` : "";
          return `\`${role.padEnd(3)}\` ${icon} ${name}${note}`;
        }).join("\n") || "\u306A\u3057";
      }, "renderTeam");
      const embed = {
        title: "\u2694\uFE0F \u30C1\u30FC\u30E0\u5206\u3051\u306E\u7D50\u679C (KTM Balancer)",
        color: 3066993,
        fields: [
          { name: "\u{1F7E6} Team A (Blue)", value: renderTeam(teamBlue), inline: true },
          { name: "\u{1F7E5} Team B (Red)", value: renderTeam(teamRed), inline: true }
        ],
        footer: { text: `\u52DD\u7387\u5E73\u6E96\u5316\uFF06\u683C\u5DEE\u30D7\u30ED\u30C6\u30AF\u30C8\u9069\u7528\u6E08\u307F | ID: ${Math.floor(Date.now() / 1e3).toString(16)}` },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (Array.isArray(spectators) && spectators.length > 0) {
        embed.fields.push({
          name: "\u23F3 \u30AB\u30B9\u30BF\u30E0\u5F85\u6A5F",
          value: spectators.map((n) => String(n).trim()).join(", ") || "\u306A\u3057",
          inline: false
        });
      }
      if (Array.isArray(balanceReport) && balanceReport.length > 0) {
        embed.fields.push({
          name: "\u{1F4CB} \u30D0\u30E9\u30F3\u30B9\u5206\u6790\u30EC\u30DD\u30FC\u30C8",
          value: balanceReport.join("\n"),
          inline: false
        });
      }
      let contentMessage = isRebalance ? "" : "\u{1F195} **MATCH START**: \u65B0\u3057\u3044\u8A66\u5408\u304C\u7D44\u307E\u308C\u307E\u3057\u305F\u3002";
      if (banProtect && banProtect.targetName) {
        contentMessage += `
\u{1F6A8} **\u683C\u5DEE\u6551\u6E08BAN\u30D7\u30ED\u30C6\u30AF\u30C8\u9069\u7528**: **${banProtect.targetName}** \u3055\u3093\u306F\u3001BAN\u3055\u308C\u305F\u304F\u306A\u3044\u7279\u5B9A\u306E1\u30C1\u30E3\u30F3\u30D4\u30AA\u30F3\u3092\u30C1\u30E3\u30C3\u30C8\u3067\u4F1D\u3048\u3066\u304F\u3060\u3055\u3044\u3002\u6575\u30C1\u30FC\u30E0\u306F\u305D\u308C\u3092BAN\u3057\u306A\u3044\u3088\u3046\u3054\u5354\u529B\u3092\u304A\u9858\u3044\u3057\u307E\u3059\uFF08\u7D33\u58EB\u5354\u5B9A\u30EB\u30FC\u30EB\uFF09\u3002`;
      }
      const components = [
        {
          type: 1,
          components: [
            { type: 2, label: "\u{1F7E6} BLUE \u52DD\u5229", style: 1, custom_id: `win_blue:${authorId}` },
            { type: 2, label: "\u{1F7E5} RED \u52DD\u5229", style: 4, custom_id: `win_red:${authorId}` },
            { type: 2, label: "\u{1F504} \u6B21\u306E\u8A66\u5408\u3092\u632F\u308B", style: 3, custom_id: "rebalance" },
            { type: 2, label: "\u{1F575}\uFE0F OP.GG \u30B9\u30AB\u30A6\u30C6\u30A3\u30F3\u30B0", style: 2, custom_id: "opgg_scout" }
          ]
        }
      ];
      if (isRebalance) {
        await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: contentMessage, embeds: [embed], components });
      } else {
        await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: "\u{1F195} **MATCH START**: \u65B0\u3057\u3044\u8A66\u5408\u304C\u7D44\u307E\u308C\u307E\u3057\u305F\u3002" });
        await patchInteractionResponse(appId, token, { content: contentMessage, embeds: [embed], components });
      }
    } catch (err) {
      console.error("executeBalance Error:", err);
      const errEmbed = {
        title: "\u274C \u30C1\u30FC\u30E0\u5206\u3051\u30A8\u30E9\u30FC",
        description: `\`\`\`
${err.message}
\`\`\``,
        color: 15158332,
        footer: { text: "\u518D\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044" }
      };
      try {
        if (isRebalance) {
          await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [errEmbed] });
        } else {
          await patchInteractionResponse(appId, token, { embeds: [errEmbed], components: [] });
        }
      } catch (innerErr) {
        console.error("Error reporting failed:", innerErr);
      }
    }
  })());
  return Response.json({ type: 5 });
}
__name(executeBalance, "executeBalance");
async function handleBalanceCommand(interaction, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;
  ctx.waitUntil((async () => {
    try {
      await patchInteractionResponse(appId, token, { content: "\u26A0\uFE0F **\u30C1\u30FC\u30E0\u5206\u3051\u3092\u5B9F\u884C\u3059\u308B\u306B\u306F\u3001\u52DF\u96C6\u30D1\u30CD\u30EB\u306E\u300C\u{1F3C6} \u30C1\u30FC\u30E0\u5206\u3051\u5B9F\u884C\u300D\u30DC\u30BF\u30F3\u3092\u3054\u5229\u7528\u304F\u3060\u3055\u3044\u3002**" });
    } catch (err) {
      console.error("handleBalanceCommand Error:", err);
    }
  })());
  return Response.json({ type: 5 });
}
__name(handleBalanceCommand, "handleBalanceCommand");
async function handleMemoCommand(interaction, env, ctx) {
  const options = interaction.data?.options || [];
  const content = options.find((o) => o.name === "content" || o.name === "\u5185\u5BB9")?.value;
  const appId = interaction.application_id;
  const token = interaction.token;
  if (!content) {
    return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u30E1\u30E2\u5185\u5BB9\u307E\u305F\u306FURL\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", flags: 64 } });
  }
  ctx.waitUntil((async () => {
    try {
      const portalUrl = env.PORTAL_API_URL || env.LOCAL_API_URL || "https://ktm-portal.vercel.app";
      const payload = {};
      if (content.startsWith("http://") || content.startsWith("https://")) {
        payload.url = content;
      } else {
        payload.text = content;
      }
      const res = await fetch(`${portalUrl}/api/admin/knowledge/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await patchInteractionResponse(appId, token, {
          content: `\u{1F9E0} **\u30CA\u30EC\u30C3\u30B8\u30D9\u30FC\u30B9\u306B\u767B\u9332\u30FB\u8981\u7D04\u3057\u307E\u3057\u305F\uFF01**
**\u30BF\u30A4\u30C8\u30EB**: ${data.data.title}
**\u30B8\u30E3\u30F3\u30EB**: ${data.data.genre}
**\u8981\u7D04**: ${data.data.content}`
        });
      } else {
        await patchInteractionResponse(appId, token, {
          content: `\u274C **\u767B\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F**: ${data.error || "\u672A\u77E5\u306E\u30A8\u30E9\u30FC"}`
        });
      }
    } catch (err) {
      console.error("Memo command error:", err);
      await patchInteractionResponse(appId, token, {
        content: `\u274C **\u901A\u4FE1\u30A8\u30E9\u30FC**: ${err.message}`
      });
    }
  })());
  return Response.json({
    type: 4,
    data: { content: "\u{1F9E0} AI\u304C\u30CA\u30EC\u30C3\u30B8\u30D9\u30FC\u30B9\u3078\u306E\u5206\u985E\u30FB\u8981\u7D04\u51E6\u7406\u3092\u884C\u3063\u3066\u3044\u307E\u3059\u3002\u5C11\u3005\u304A\u5F85\u3061\u304F\u3060\u3055\u3044...", flags: 64 }
  });
}
__name(handleMemoCommand, "handleMemoCommand");

// src/handlers/components.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_config();
init_api();
init_embeds();
async function handleButtonInteraction(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const appId = interaction.application_id;
  const token = interaction.token;
  const botToken = env.DISCORD_TOKEN;
  if (customId === "toggle_recruit_notification") {
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    if (!roleId) {
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u901A\u77E5\u30ED\u30FC\u30EBID\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002", flags: 64 } });
    }
    const guildId = interaction.guild_id;
    if (!guildId) {
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u30B5\u30FC\u30D0\u30FCID\u304C\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", flags: 64 } });
    }
    const userRoles = interaction.member?.roles || [];
    const hasRole = userRoles.includes(roleId);
    ctx.waitUntil((async () => {
      try {
        if (hasRole) {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bot ${botToken}`
            }
          });
          if (!res.ok)
            throw new Error(`Role removal failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, { content: "\u{1F514} **\u52DF\u96C6\u901A\u77E5\u30ED\u30FC\u30EB\u3092\u89E3\u9664\u3057\u307E\u3057\u305F\u3002**\n\u4EE5\u964D\u3001\u30E1\u30F3\u30D0\u30FC\u52DF\u96C6\u6642\u306E\u901A\u77E5\u306F\u5C4A\u304D\u307E\u305B\u3093\u3002" });
        } else {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bot ${botToken}`,
              "Content-Length": "0"
            }
          });
          if (!res.ok)
            throw new Error(`Role assignment failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, { content: "\u{1F514} **\u52DF\u96C6\u901A\u77E5\u30ED\u30FC\u30EB\u3092\u4ED8\u4E0E\u3057\u307E\u3057\u305F\uFF01**\n\u4EE5\u964D\u3001\u30E1\u30F3\u30D0\u30FC\u52DF\u96C6\u6642\u306B\u901A\u77E5\uFF08\u30E1\u30F3\u30B7\u30E7\u30F3\uFF09\u304C\u5C4A\u304F\u3088\u3046\u306B\u306A\u308A\u307E\u3059\u3002" });
        }
      } catch (err) {
        console.error("Toggle Role Error:", err);
        try {
          await patchInteractionResponse(appId, token, { content: `\u274C **\u30ED\u30FC\u30EB\u64CD\u4F5C\u30A8\u30E9\u30FC**: ${err.message}
Bot\u306E\u30ED\u30FC\u30EB\u6A29\u9650\u306E\u9806\u4F4D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002` });
        } catch (e) {
        }
      }
    })());
    return Response.json({ type: 5, data: { flags: 64 } });
  }
  if (customId.startsWith("proxy_add_init:")) {
    const ownerId = customId.split(":")[1];
    if (userId !== ownerId)
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u52DF\u96C6\u4E3B\u306E\u307F\u4EE3\u7406\u8FFD\u52A0\u304C\u53EF\u80FD\u3067\u3059\u3002", flags: 64 } });
    return Response.json({
      type: 4,
      data: {
        content: "\u{1F4CB} **\u8FFD\u52A0\u3057\u305F\u3044\u30E1\u30F3\u30D0\u30FC\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044**",
        flags: 64,
        components: [{ type: 1, components: [{ type: 5, custom_id: `proxy_add_submit:${ownerId}:${interaction.message.id}`, placeholder: "\u30E6\u30FC\u30B6\u30FC\u3092\u9078\u629E...", min_values: 1, max_values: 5 }] }]
      }
    });
  }
  if (customId.startsWith("proxy_add_submit:")) {
    const [, , origMsgId] = customId.split(":");
    const targetUserIds = interaction.data.values || [];
    const resolvedUsers = interaction.data.resolved?.users || {};
    ctx.waitUntil((async () => {
      try {
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages/${origMsgId}`, { headers: { "Authorization": `Bot ${botToken}` } });
        if (!msgRes.ok)
          throw new Error("\u5143\u30E1\u30C3\u30BB\u30FC\u30B8\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
        const origMsg = await msgRes.json();
        const metadata2 = parseMessageData(origMsg);
        let addedCount = 0;
        targetUserIds.forEach((tId) => {
          if (metadata2.joined.length < metadata2.maxCount && !metadata2.joined.includes(tId)) {
            metadata2.joined.push(tId);
            metadata2.names[tId] = resolvedUsers[tId]?.global_name || resolvedUsers[tId]?.username || "Unknown";
            metadata2.spectating = metadata2.spectating.filter((id) => id !== tId);
            addedCount++;
          }
        });
        if (addedCount > 0) {
          await sendDiscordMessage(`channels/${interaction.channel_id}/messages/${origMsgId}`, botToken, "PATCH", {
            content: createMessageContent(metadata2),
            embeds: [createRecruitEmbed(metadata2)],
            components: createRecruitButtons(metadata2)
          });
          await sendInteractionFollowup(appId, token, { content: `\u2705 <@${userId}> \u304C\u30E1\u30F3\u30D0\u30FC\u3092 ${addedCount} \u540D\u8FFD\u52A0\u3057\u307E\u3057\u305F\u3002`, flags: 0 });
        }
      } catch (err) {
        console.error("ProxyAdd Error:", err);
        await sendInteractionFollowup(appId, token, { content: `\u274C **\u30A8\u30E9\u30FC**: ${err.message}`, flags: 64 });
      }
    })());
    return Response.json({ type: 7, data: { content: "\u231B \u30E1\u30F3\u30D0\u30FC\u3092\u8FFD\u52A0\u51E6\u7406\u4E2D\u3067\u3059...", components: [] } });
  }
  const isPortalAction = customId.startsWith("portal_") || customId.startsWith("admin_");
  if (isPortalAction && !customId.startsWith("admin_fix_match_submit") && customId !== "portal_menu_cancel") {
    const value = customId;
    const channelId = interaction.channel_id;
    const messageId = interaction.message.id;
    if (value === "portal_recruit")
      return Response.json({
        type: 9,
        data: {
          title: "\u2694\uFE0F \u65B0\u898F\u30E1\u30F3\u30D0\u30FC\u52DF\u96C6\u306E\u8A2D\u5B9A",
          custom_id: "portal_recruit_modal",
          components: [
            { type: 1, components: [{ type: 4, custom_id: "mode", label: "\u30E2\u30FC\u30C9", style: 1, value: "\u30CE\u30FC\u30DE\u30EB", required: true }] },
            { type: 1, components: [{ type: 4, custom_id: "time", label: "\u958B\u59CB\u4E88\u5B9A\u6642\u523B", style: 1, required: false }] },
            { type: 1, components: [{ type: 4, custom_id: "max", label: "\u6700\u5927\u4EBA\u6570", style: 1, value: "5", required: false }] },
            { type: 1, components: [{ type: 4, custom_id: "memo", label: "\u4E00\u8A00\u30E1\u30E2", style: 2, required: false }] }
          ]
        }
      });
    if (value === "portal_stats")
      return handleStatsCommand(interaction, env, ctx);
    if (value === "portal_balance")
      return await handleBalanceCommand(interaction, env, ctx);
    if (value === "portal_lane")
      return handleLaneCommand(interaction, env, ctx);
    if (value === "portal_ign")
      return Response.json({ type: 9, data: { title: "\u{1F4DD} \u30B5\u30E2\u30CA\u30FC\u540D\u767B\u9332", custom_id: "portal_ign_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "ign", label: "\u30B5\u30E2\u30CA\u30FC\u540D (Riot ID#Tag)", style: 1, placeholder: "Faker#KR1", required: true }] }] } });
    if (value === "admin_fix_match")
      return Response.json({ type: 9, data: { title: "\u{1F6E0}\uFE0F \u52DD\u6557\u4FEE\u6B63", custom_id: "admin_fix_match_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "winner", label: "\u6B63\u3057\u3044\u52DD\u5229\u30C1\u30FC\u30E0", style: 1, required: true }] }] } });
    if (value === "admin_adjust_mmr")
      return Response.json({ type: 9, data: { title: "\u{1F6E0}\uFE0F MMR \u624B\u52D5\u8ABF\u6574", custom_id: "admin_adjust_mmr_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "target", label: "\u5BFE\u8C61\u540D", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "role", label: "\u30ED\u30FC\u30EB", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "amount", label: "\u65B0\u3057\u3044MMR", style: 1, required: true }] }] } });
    if (value === "portal_help")
      return Response.json({ type: 4, data: { ...handleHelpPage(), flags: 64 } });
    if (value === "admin_sync_ranks") {
      if (userId !== CONFIG.ADMIN_ID)
        return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u7BA1\u7406\u8005\u306E\u307F\u5B9F\u884C\u53EF\u80FD\u3067\u3059\u3002", flags: 64 } });
      const discordName = interaction.member?.user?.global_name || interaction.member?.user?.username;
      ctx.waitUntil((async () => {
        try {
          const { fetchPortalAPI: fetchPortalAPI2 } = await Promise.resolve().then(() => (init_api(), api_exports));
          const gasData = await fetchPortalAPI2(env, "/api/riot/sync-ranks", { discordName });
          await patchInteractionResponse(appId, token, { content: `\u2705 **\u540C\u671F\u5B8C\u4E86**: ${gasData.message}`, components: [] });
        } catch (err) {
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
          await sendInteractionFollowup(appId, token, { content: `\u274C **\u540C\u671F\u30A8\u30E9\u30FC**: ${err.message}`, flags: 64 });
        }
      })());
      return Response.json({ type: 7, data: { content: "\u231B Riot API \u3068\u540C\u671F\u4E2D\u3067\u3059\uFF08\u6700\u59275\u5206\uFF09...", components: [] } });
    }
    if (value === "admin_init_mmr") {
      return Response.json({
        type: 4,
        data: {
          content: "\u{1F6E1}\uFE0F **MMR\u306E\u4E00\u62EC\u521D\u671F\u5316\u3092\u5B9F\u884C\u3057\u307E\u3059\u304B\uFF1F**",
          components: [{ type: 1, components: [{ type: 2, label: "\u26A0\uFE0F \u5168\u54E1\u4E0A\u66F8\u304D", style: 4, custom_id: "exec_init_mmr:all" }, { type: 2, label: "\u2705 \u672A\u8A2D\u5B9A\u306E\u307F", style: 3, custom_id: "exec_init_mmr:new_only" }, { type: 2, label: "\u30AD\u30E3\u30F3\u30BB\u30EB", style: 2, custom_id: "portal_menu_cancel" }] }],
          flags: 64
        }
      });
    }
  }
  if (customId === "portal_menu_cancel")
    return Response.json({ type: 7, data: { content: "\u2705 \u64CD\u4F5C\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002", components: [] } });
  if (customId.startsWith("exec_init_mmr:")) {
    if (userId !== CONFIG.ADMIN_ID)
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u3053\u306E\u64CD\u4F5C\u306F\u7BA1\u7406\u8005\u306E\u307F\u5B9F\u884C\u53EF\u80FD\u3067\u3059\u3002", flags: 64 } });
    const isOverwriteAll = customId.split(":")[1] === "all";
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI: fetchPortalAPI2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const gasData = await fetchPortalAPI2(env, "/api/admin/init-mmr", { isOverwriteAll });
        await patchInteractionResponse(appId, token, { content: `\u2705 **\u5B9F\u884C\u5B8C\u4E86**: ${gasData.message}`, components: [] });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `\u274C **\u30A8\u30E9\u30FC**: ${err.message}`, flags: 64 });
      }
    })());
    return Response.json({ type: 7, data: { content: "\u231B \u51E6\u7406\u3092\u958B\u59CB\u3057\u307E\u3057\u305F\u3002\u5C11\u3005\u304A\u5F85\u3061\u304F\u3060\u3055\u3044...", components: [] } });
  }
  if (customId.startsWith("win_blue:") || customId.startsWith("win_red:")) {
    const winner = customId.startsWith("win_blue") ? "BLUE" : "RED";
    const players = extractPlayersFromEmbed(interaction.message.embeds[0]);
    return await handleAutoMatchEnd(interaction, players, winner, env, ctx);
  }
  if (customId === "opgg_scout") {
    const players = extractPlayersFromEmbed(interaction.message.embeds[0]);
    if (players.length === 0)
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u30D7\u30EC\u30A4\u30E4\u30FC\u60C5\u5831\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", flags: 64 } });
    const teamA = players.filter((p) => p.team === "BLUE").map((p) => p.name);
    const teamB = players.filter((p) => p.team === "RED").map((p) => p.name);
    ctx.waitUntil((async () => {
      try {
        const { getPlayersByNames: getPlayersByNames2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
        const allNames = [...teamA, ...teamB];
        const playersData = await getPlayersByNames2(env, allNames);
        const getIgn = /* @__PURE__ */ __name((name) => {
          const p = playersData.find((pd) => pd.name === name);
          return p && p.ign && p.ign.includes("#") ? encodeURIComponent(p.ign) : null;
        }, "getIgn");
        const blueIgns = teamA.map(getIgn).filter((ign) => ign !== null);
        const redIgns = teamB.map(getIgn).filter((ign) => ign !== null);
        let content = "\u{1F575}\uFE0F **OP.GG \u30B9\u30AB\u30A6\u30C6\u30A3\u30F3\u30B0\u30EC\u30DD\u30FC\u30C8**\n\u4EE5\u4E0B\u306E\u30EA\u30F3\u30AF\u304B\u3089\u4E21\u30C1\u30FC\u30E0\u306E\u8A73\u7D30\u306A\u6226\u7E3E\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002\n\n";
        if (blueIgns.length > 0) {
          content += `\u{1F7E6} **TEAM BLUE**
https://www.op.gg/multisearch/jp?summoners=${blueIgns.join(encodeURIComponent(","))}

`;
        } else {
          content += `\u{1F7E6} **TEAM BLUE**: \u767B\u9332\u3055\u308C\u3066\u3044\u308BIGN\u304C\u3042\u308A\u307E\u305B\u3093

`;
        }
        if (redIgns.length > 0) {
          content += `\u{1F7E5} **TEAM RED**
https://www.op.gg/multisearch/jp?summoners=${redIgns.join(encodeURIComponent(","))}`;
        } else {
          content += `\u{1F7E5} **TEAM RED**: \u767B\u9332\u3055\u308C\u3066\u3044\u308BIGN\u304C\u3042\u308A\u307E\u305B\u3093`;
        }
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content, flags: 64 });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `\u274C **\u30A8\u30E9\u30FC**: ${err.message}`, flags: 64 });
      }
    })());
    return Response.json({ type: 5, data: { flags: 64 } });
  }
  if (customId === "rebalance") {
    try {
      const meta = parseMessageData(interaction.message);
      const names = meta.joined.map((id) => meta.names[id]).slice(0, 10);
      if (names.length === 0) {
        const embed0 = interaction.message?.embeds?.[0];
        if (!embed0) {
          return Response.json({ type: 4, data: { content: "\u26A0\uFE0F **rebalance\u5931\u6557**: \u30E1\u30C3\u30BB\u30FC\u30B8\u306BEmbed\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", flags: 64 } });
        }
        const players = extractPlayersFromEmbed(embed0);
        let spectators = [];
        const specField = embed0.fields?.find((f) => f.name.includes("\u5F85\u6A5F"));
        if (specField) {
          spectators = specField.value.split(",").map((n) => n.trim()).filter((n) => n && n !== "\u306A\u3057");
        }
        if (players.length > 0) {
          const allNames = [...players.map((p) => p.name), ...spectators];
          return await executeBalance(interaction, allNames, env, ctx, true);
        } else {
          const fieldNames = (embed0.fields || []).map((f) => f.name).join(", ");
          const firstFieldVal = (embed0.fields?.[0]?.value || "").slice(0, 100);
          return Response.json({ type: 4, data: { content: `\u26A0\uFE0F **rebalance\u5931\u6557**: Embed\u304B\u3089\u30D7\u30EC\u30A4\u30E4\u30FC\u62BD\u51FA\u5931\u6557
fields: ${fieldNames}
\u6700\u521D\u306Efield\u5024: ${firstFieldVal}`, flags: 64 } });
        }
      }
      return await executeBalance(interaction, names, env, ctx, true);
    } catch (err) {
      return Response.json({ type: 4, data: { content: `\u26A0\uFE0F **rebalance\u4F8B\u5916**: ${err.message}`, flags: 64 } });
    }
  }
  const metadata = parseMessageData(interaction.message);
  const userName = interaction.member.user.global_name || interaction.member.user.username;
  if (customId.includes(":"))
    metadata.owner = customId.split(":").pop();
  if (customId.startsWith("edit_recruit_init")) {
    if (userId !== metadata.owner)
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u52DF\u96C6\u4E3B\u306E\u307F\u7DE8\u96C6\u53EF\u80FD\u3067\u3059\u3002", flags: 64 } });
    return Response.json({
      type: 9,
      data: {
        title: "\u2699\uFE0F \u52DF\u96C6\u5185\u5BB9\u306E\u7DE8\u96C6",
        custom_id: `edit_recruit_modal:${metadata.owner}`,
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "\u30E2\u30FC\u30C9", style: 1, value: metadata.mode, required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "\u958B\u59CB\u4E88\u5B9A\u6642\u523B", style: 1, value: metadata.time || "", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "\u6700\u5927\u4EBA\u6570", style: 1, value: metadata.maxCount.toString(), required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "\u4E00\u8A00\u30E1\u30E2", style: 2, value: metadata.memo || "", required: false }] }
        ]
      }
    });
  }
  if (customId.startsWith("upgrade_to_10")) {
    if (userId !== metadata.owner)
      return Response.json({ type: 4, data: { content: "\u26A0\uFE0F \u52DF\u96C6\u4E3B\u306E\u307F\u62E1\u5F35\u53EF\u80FD\u3067\u3059\u3002", flags: 64 } });
    metadata.mode = "\u30AB\u30B9\u30BF\u30E0";
    metadata.maxCount = 10;
  } else if (customId.startsWith("join_any")) {
    if (metadata.joined.includes(userId) && !Object.values(metadata.roles).includes(userId)) {
      metadata.joined = metadata.joined.filter((id) => id !== userId);
    } else if (metadata.joined.length < metadata.maxCount) {
      if (!metadata.joined.includes(userId))
        metadata.joined.push(userId);
      metadata.names[userId] = userName;
      metadata.spectating = metadata.spectating.filter((id) => id !== userId);
      Object.keys(metadata.roles).forEach((r) => {
        if (metadata.roles[r] === userId)
          metadata.roles[r] = null;
      });
    }
  } else if (customId.startsWith("join_role:")) {
    const role = customId.split(":")[1];
    if (metadata.roles[role] === userId) {
      metadata.roles[role] = null;
      metadata.joined = metadata.joined.filter((id) => id !== userId);
    } else {
      Object.keys(metadata.roles).forEach((r) => {
        if (metadata.roles[r] === userId)
          metadata.roles[r] = null;
      });
      if (!metadata.roles[role] && metadata.joined.length < metadata.maxCount) {
        metadata.roles[role] = userId;
        metadata.names[userId] = userName;
        if (!metadata.joined.includes(userId))
          metadata.joined.push(userId);
        metadata.spectating = metadata.spectating.filter((id) => id !== userId);
      }
    }
  } else if (customId.startsWith("spectate")) {
    if (!metadata.spectating.includes(userId)) {
      metadata.spectating.push(userId);
      metadata.names[userId] = userName;
      metadata.joined = metadata.joined.filter((id) => id !== userId);
      Object.keys(metadata.roles).forEach((r) => {
        if (metadata.roles[r] === userId)
          metadata.roles[r] = null;
      });
    } else {
      metadata.spectating = metadata.spectating.filter((id) => id !== userId);
    }
  } else if (customId.startsWith("close")) {
    const embed = createRecruitEmbed(metadata);
    embed.title = "\u{1F6A8} \u52DF\u96C6\u7D42\u4E86";
    embed.color = 16711680;
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [embed], components: [{ type: 1, components: [{ type: 2, label: "\u{1F4E2} \u4E00\u62EC\u9023\u7D61", style: 1, custom_id: `broadcast_start:${metadata.owner}` }] }] } });
  } else if (customId.startsWith("broadcast_start:")) {
    return Response.json({ type: 9, data: { title: "\u{1F4E2} \u4E00\u62EC\u9023\u7D61", custom_id: `broadcast_modal:${metadata.owner}`, components: [{ type: 1, components: [{ type: 4, custom_id: "msg", label: "\u9001\u4FE1\u30E1\u30C3\u30BB\u30FC\u30B8", style: 2, required: true }] }] } });
  } else if (customId.startsWith("balance_from_recruit")) {
    return await executeBalance(interaction, metadata.joined.map((id) => metadata.names[id]), env, ctx);
  }
  if (metadata.joined.length >= metadata.maxCount && (customId.startsWith("join_any") || customId.startsWith("join_role:"))) {
    ctx.waitUntil((async () => {
      const mentions = [.../* @__PURE__ */ new Set([metadata.owner, ...metadata.joined])].map((id) => `<@${id}>`).join(" ");
      const players = metadata.joined.map((id) => metadata.names[id]).slice(0, 10);
      const spectators = metadata.spectating.map((id) => metadata.names[id]);
      await sendInteractionFollowup(appId, token, { content: `\u2694\uFE0F **\u30E1\u30F3\u30D0\u30FC\u78BA\u5B9A\uFF01** \u5BFE\u6226\u6E96\u5099\u3092\u958B\u59CB\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u5BFE\u6226\u5165\u529B\u30B7\u30FC\u30C8\u3078\u8EE2\u9001\u3057\u307E\u3057\u305F\uFF09\u3002
\u901A\u77E5: ${mentions}` });
    })());
    const closingMessage = metadata.mode === "\u30CE\u30FC\u30DE\u30EB" || metadata.mode === "ARAM" ? "\n\u{1F6A8} **\u5B9A\u54E1\u306B\u9054\u3057\u307E\u3057\u305F\u3002\u5BFE\u6226\u6E96\u5099\u3092\u958B\u59CB\u3057\u3066\u304F\u3060\u3055\u3044\uFF01**" : "\n\u{1F6A8} **\u5B9A\u54E1\u306B\u9054\u3057\u305F\u305F\u3081\u7DE0\u3081\u5207\u308A\u307E\u3057\u305F\u3002\u30C1\u30FC\u30E0\u5206\u3051\u30DC\u30BF\u30F3\u304B\u3089\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002**";
    return Response.json({ type: 7, data: { content: createMessageContent(metadata) + closingMessage, embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }
  return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
}
__name(handleButtonInteraction, "handleButtonInteraction");

// src/handlers/modals.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_config();
init_api();
init_embeds();
async function handleModalSubmit(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member.user.id;
  if (customId === "portal_recruit_modal") {
    const getVal = /* @__PURE__ */ __name((cid) => {
      const row = interaction.data.components.find((c) => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim() : "";
    }, "getVal");
    const rawMode = getVal("mode");
    const mode = rawMode === "\u30CE\u30FC\u30DE\u30EB" || rawMode === "\u30AB\u30B9\u30BF\u30E0" || rawMode === "ARAM" ? rawMode : "\u30CE\u30FC\u30DE\u30EB";
    const maxCount = parseInt(getVal("max")) || (mode === "\u30AB\u30B9\u30BF\u30E0" ? 10 : 5);
    const metadata = { mode, time: getVal("time"), maxCount, memo: getVal("memo"), owner: userId, joined: [], spectating: [], roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: {} };
    ctx.waitUntil(sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) }));
    return Response.json({ type: 4, data: { content: "\u2705 **\u52DF\u96C6\u3092 #\u52DF\u96C6\u677F \u306B\u6295\u4E0B\u3057\u307E\u3057\u305F\uFF01**", flags: 64 } });
  }
  if (customId === "portal_ign_modal") {
    const ign = interaction.data.components.find((c) => c.components[0].custom_id === "ign").components[0].value;
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    const appId = interaction.application_id;
    const token = interaction.token;
    ctx.waitUntil((async () => {
      try {
        const { fetchSupabase: fetchSupabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
        const { patchInteractionResponse: patchInteractionResponse2 } = await Promise.resolve().then(() => (init_api(), api_exports));
        const existingData = await fetchSupabase2(env, "ktm_players", `discord_id=eq.${userId}`);
        if (!existingData || existingData.length === 0) {
          await patchInteractionResponse2(appId, token, { content: "\u26A0\uFE0F \u540D\u7C3F\u306B\u3042\u306A\u305F\u306E Discord ID \u304C\u898B\u308F\u305F\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u65B0\u30E1\u30F3\u30D0\u30FC\u540C\u671F\u3092\u5F85\u3064\u304B\u3001\u4E00\u5EA6\u5BFE\u6226\u306B\u53C2\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
        } else {
          const res = await fetch(`https://my-work-8jbd.vercel.app/api/player/update-puuid`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ discordId: userId, ign })
          });
          const data = await res.json();
          if (data.status === "SUCCESS") {
            await patchInteractionResponse2(appId, token, { content: `\u2705 LoL IGN \u3092 **${ign}** \u306B\u8A2D\u5B9A\u3057\u3001Riot API \u3068\u306E\u7D10\u4ED8\u3051(PUUID)\u3092\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01\u3053\u308C\u4EE5\u964D\u3001\u30E9\u30F3\u30AF\u60C5\u5831\u304C\u81EA\u52D5\u540C\u671F\u3055\u308C\u307E\u3059\u3002` });
          } else {
            await patchInteractionResponse2(appId, token, { content: `\u26A0\uFE0F IGN\u306F\u767B\u9332\u3055\u308C\u307E\u3057\u305F\u304C\u3001PUUID\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${data.message}` });
          }
        }
      } catch (err) {
        console.error("Modal SetIGN Error:", err);
      }
    })());
    return Response.json({
      type: 4,
      data: { content: "\u231B IGN\u306E\u767B\u9332\u3092\u958B\u59CB\u3057\u307E\u3057\u305F\u3002\u51E6\u7406\u5B8C\u4E86\u307E\u3067\u5C11\u3005\u304A\u5F85\u3061\u304F\u3060\u3055\u3044...", flags: 64 }
    });
  }
  if (customId === "portal_lane_modal") {
    const getVal = /* @__PURE__ */ __name((cid) => {
      const row = interaction.data.components.find((c) => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim().toUpperCase() : "";
    }, "getVal");
    const main = getVal("main"), sub = getVal("sub"), ng1 = getVal("ng1"), ng2 = getVal("ng2");
    const weightRaw = interaction.data.components.find((c) => c.components[0].custom_id === "weight")?.components[0].value;
    const weight = weightRaw ? parseInt(weightRaw) : void 0;
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        const { fetchSupabase: fetchSupabase2, upsertPlayer: upsertPlayer2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
        const existingData = await fetchSupabase2(env, "ktm_players", `discord_id=eq.${userId}`);
        const player = existingData && existingData.length > 0 ? existingData[0] : { discord_id: userId, name: discordName, is_active: true };
        player.role_preferences = player.role_preferences || {};
        if (main)
          player.role_preferences.primary = main;
        if (sub)
          player.role_preferences.secondary = sub;
        if (ng1)
          player.ng_lane_1 = ng1;
        if (ng2)
          player.ng_lane_2 = ng2;
        if (weight)
          player.weight = weight;
        await upsertPlayer2(env, player);
      } catch (err) {
        console.error("Modal Lane Update Error:", err);
      }
    })());
    return Response.json({
      type: 4,
      data: { content: `\u2705 **\u30EC\u30FC\u30F3\u8A2D\u5B9A\u3092\u53D7\u4ED8\u307E\u3057\u305F**
\u30E1\u30A4\u30F3:${main} / \u30B5\u30D6:${sub} / NG1:${ng1} / NG2:${ng2}
\u203B\u53CD\u6620\u307E\u3067\u6570\u79D2\u304B\u304B\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u3002`, flags: 64 }
    });
  }
  if (customId === "admin_fix_match_modal") {
    const winner = interaction.data.components[0].components[0].value.toUpperCase();
    const { fetchPortalAPI: fetchPortalAPI2 } = await Promise.resolve().then(() => (init_api(), api_exports));
    await fetchPortalAPI2(env, "/api/admin/fix-match", { winner });
    return Response.json({ type: 4, data: { content: `\u2705 \u76F4\u8FD1\u306E\u8A66\u5408\u3092 **${winner} \u52DD\u5229** \u306B\u66F4\u65B0\u3057\u307E\u3057\u305F\u3002`, flags: 64 } });
  }
  if (customId === "admin_adjust_mmr_modal") {
    const getVal = /* @__PURE__ */ __name((cid) => interaction.data.components[0].components[0] ? interaction.data.components.find((c) => c.components[0].custom_id === cid)?.components[0]?.value : null, "getVal");
    const { fetchPortalAPI: fetchPortalAPI2 } = await Promise.resolve().then(() => (init_api(), api_exports));
    const targetName = interaction.data.components.find((c) => c.components[0].custom_id === "target").components[0].value;
    const role = interaction.data.components.find((c) => c.components[0].custom_id === "role").components[0].value;
    const amount = interaction.data.components.find((c) => c.components[0].custom_id === "amount").components[0].value;
    await fetchPortalAPI2(env, "/api/admin/adjust-mmr", { targetName, role, amount });
    return Response.json({ type: 4, data: { content: `\u2705 ${targetName} \u306E ${role} MMR\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F\u3002`, flags: 64 } });
  }
  if (customId.startsWith("broadcast_modal:")) {
    const msg = interaction.data.components[0].components[0].value;
    const meta = parseMessageData(interaction.message);
    const mentions = [.../* @__PURE__ */ new Set([...meta.joined, ...meta.spectating, meta.owner])].map((id) => `<@${id}>`).join(" ");
    const channelId = interaction.channel_id;
    const msgId = interaction.message.id;
    ctx.waitUntil((async () => {
      try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bot ${env.DISCORD_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `\u{1F4E3} **\u52DF\u96C6\u4E3B\u304B\u3089\u306E\u9023\u7D61**
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
${msg}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u5BFE\u8C61: ${mentions}`,
            message_reference: { message_id: msgId }
          })
        });
      } catch (err) {
        console.error("Broadcast Reply Error:", err);
      }
    })());
    return Response.json({ type: 4, data: { content: "\u2705 **\u53C2\u52A0\u8005\u306B\u4E00\u62EC\u9023\u7D61\uFF08\u8FD4\u4FE1\u30E1\u30F3\u30B7\u30E7\u30F3\uFF09\u3092\u9001\u4FE1\u3057\u307E\u3057\u305F**", flags: 64 } });
  }
  if (customId.startsWith("edit_recruit_modal:")) {
    const getVal = /* @__PURE__ */ __name((cid) => interaction.data.components.find((c) => c.components[0].custom_id === cid).components[0].value, "getVal");
    const metadata = parseMessageData(interaction.message);
    metadata.mode = getVal("mode");
    metadata.time = getVal("time");
    metadata.maxCount = parseInt(getVal("max")) || metadata.maxCount;
    metadata.memo = getVal("memo");
    return Response.json({
      type: 7,
      data: {
        content: createMessageContent(metadata),
        embeds: [createRecruitEmbed(metadata)],
        components: createRecruitButtons(metadata)
      }
    });
  }
  return Response.json({ type: 1 });
}
__name(handleModalSubmit, "handleModalSubmit");

// src/handlers/scheduled.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_config();
async function handleScheduledEvent(event, env, ctx) {
  console.log("Scheduled event triggered:", JSON.stringify(event));
  const cronExpression = event.cron || "";
  const mode = event.mode || "";
  if (cronExpression === "0 12 * * 6" || mode === "create") {
    await createWeeklyEvents(env);
  } else {
    await sendEventUsersNotification(env);
  }
}
__name(handleScheduledEvent, "handleScheduledEvent");
async function createWeeklyEvents(env) {
  console.log("Starting weekly event creation...");
  try {
    const channelId = CONFIG.MATCH_CHANNEL_ID || "1487077567939743995";
    console.log(`Fetching channel info for channel: ${channelId}`);
    const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: {
        "Authorization": `Bot ${env.DISCORD_TOKEN}`
      }
    });
    if (!channelRes.ok) {
      throw new Error(`Failed to fetch channel info: ${channelRes.status} ${await channelRes.text()}`);
    }
    const channelInfo = await channelRes.json();
    const guildId = channelInfo.guild_id;
    if (!guildId) {
      throw new Error("Guild ID not found in channel response.");
    }
    console.log(`Resolved Guild ID: ${guildId}`);
    const now = /* @__PURE__ */ new Date();
    const dayOfWeek = now.getUTCDay();
    let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    if (daysUntilSaturday === 0) {
      daysUntilSaturday = 7;
    }
    const scheduledStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilSaturday,
      12,
      0,
      0,
      0
      // JST 21:00 = UTC 12:00
    ));
    const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1e3);
    const startTimeISO = scheduledStart.toISOString();
    const endTimeISO = scheduledEnd.toISOString();
    console.log(`Target Event Start Time (UTC): ${startTimeISO}`);
    console.log(`Target Event End Time (UTC): ${endTimeISO}`);
    console.log("Fetching existing scheduled events...");
    const existingRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
      headers: {
        "Authorization": `Bot ${env.DISCORD_TOKEN}`
      }
    });
    if (!existingRes.ok) {
      throw new Error(`Failed to fetch existing events: ${existingRes.status} ${await existingRes.text()}`);
    }
    const existingEvents = await existingRes.json();
    const eventTemplates = [
      {
        name: "\u3010\u5B9A\u671F\u3011\u30B7\u30EB\u30D0\u30FC\u4EE5\u4E0B\u30AB\u30B9\u30BF\u30E0",
        description: "\u6BCE\u9031\u5B9A\u671F\u958B\u50AC\u306E\u30B7\u30EB\u30D0\u30FC\u4EE5\u4E0B\u5BFE\u8C61\u30AB\u30B9\u30BF\u30E0\u6226\u3067\u3059\u3002\u53C2\u52A0\u5E0C\u671B\u306E\u65B9\u306F\u300C\u8208\u5473\u3042\u308A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\uFF01"
      },
      {
        name: "\u3010\u5B9A\u671F\u3011\u30B4\u30EB\u30D7\u30E9\u4EE5\u4E0B\u30AB\u30B9\u30BF\u30E0",
        description: "\u6BCE\u9031\u5B9A\u671F\u958B\u50AC\u306E\u30B4\u30EB\u30D7\u30E9\u4EE5\u4E0B\u5BFE\u8C61\u30AB\u30B9\u30BF\u30E0\u6226\u3067\u3059\u3002\u53C2\u52A0\u5E0C\u671B\u306E\u65B9\u306F\u300C\u8208\u5473\u3042\u308A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\uFF01"
      }
    ];
    const createdEvents = [];
    const skippedEventNames = [];
    for (const template of eventTemplates) {
      const isDuplicate = existingEvents.some((e) => {
        const sameName = e.name === template.name;
        const sameTime = new Date(e.scheduled_start_time).getTime() === scheduledStart.getTime();
        const notCanceled = e.status !== 4;
        return sameName && sameTime && notCanceled;
      });
      if (isDuplicate) {
        console.log(`Event "${template.name}" already exists for ${startTimeISO}. Skipping creation.`);
        skippedEventNames.push(template.name);
        const dupEvent = existingEvents.find(
          (e) => e.name === template.name && new Date(e.scheduled_start_time).getTime() === scheduledStart.getTime() && e.status !== 4
        );
        if (dupEvent) {
          createdEvents.push(dupEvent);
        }
        continue;
      }
      console.log(`Creating scheduled event: ${template.name}`);
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${env.DISCORD_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: template.name,
          privacy_level: 2,
          // GUILD_ONLY
          scheduled_start_time: startTimeISO,
          scheduled_end_time: endTimeISO,
          description: template.description,
          entity_type: 3,
          // EXTERNAL
          entity_metadata: {
            location: "\u30AA\u30F3\u30E9\u30A4\u30F3"
          }
        })
      });
      if (!res.ok) {
        console.error(`Failed to create event ${template.name}: ${res.status} ${await res.text()}`);
      } else {
        const createdEvent = await res.json();
        console.log(`Successfully created event ${template.name} with ID: ${createdEvent.id}`);
        createdEvents.push(createdEvent);
      }
    }
    const newCreatedCount = eventTemplates.length - skippedEventNames.length;
    if (newCreatedCount > 0 && createdEvents.length > 0) {
      console.log("Sending announcement message with event links...");
      const eventLinks = createdEvents.map((e) => {
        return `\u{1F539} **${e.name}**
\u{1F449} https://discord.com/events/${guildId}/${e.id}`;
      }).join("\n\n");
      const messageContent = `\u{1F4C5} **\u6765\u9031\u306E\u3010\u5B9A\u671F\u3011\u30AB\u30B9\u30BF\u30E0\u30A4\u30D9\u30F3\u30C8\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F\uFF01**
\u53C2\u52A0\u4E88\u5B9A\u306E\u65B9\u306F\u3001\u4EE5\u4E0B\u306E\u30EA\u30F3\u30AF\u304B\u3089\u300C\u8208\u5473\u3042\u308A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\uFF01

${eventLinks}

@everyone`;
      const announceRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${env.DISCORD_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: messageContent
        })
      });
      if (!announceRes.ok) {
        console.error(`Failed to send announcement message: ${announceRes.status} ${await announceRes.text()}`);
      } else {
        console.log("Announcement message sent successfully!");
      }
    } else {
      console.log("No new events created (all were duplicates). Skipping announcement to prevent double notifications.");
    }
  } catch (err) {
    console.error("Error in createWeeklyEvents:", err);
  }
}
__name(createWeeklyEvents, "createWeeklyEvents");
async function sendEventUsersNotification(env) {
  console.log("Starting event users extraction notification...");
  try {
    const channelId = CONFIG.MATCH_CHANNEL_ID || "1487077567939743995";
    const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: {
        "Authorization": `Bot ${env.DISCORD_TOKEN}`
      }
    });
    if (!channelRes.ok) {
      throw new Error(`Failed to fetch channel info: ${channelRes.status} ${await channelRes.text()}`);
    }
    const channelInfo = await channelRes.json();
    const guildId = channelInfo.guild_id;
    if (!guildId) {
      throw new Error("Guild ID not found in channel response.");
    }
    const eventsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
      headers: {
        "Authorization": `Bot ${env.DISCORD_TOKEN}`
      }
    });
    if (!eventsRes.ok) {
      throw new Error(`Failed to fetch scheduled events: ${eventsRes.status} ${await eventsRes.text()}`);
    }
    const scheduledEvents = await eventsRes.json();
    console.log(`Fetched ${scheduledEvents.length} events from guild.`);
    const now = Date.now();
    const maxStartLimit = now + 48 * 60 * 60 * 1e3;
    const targetEvents = scheduledEvents.filter((e) => {
      const startTime = new Date(e.scheduled_start_time).getTime();
      const isWithin48h = startTime >= now && startTime <= maxStartLimit;
      const hasTeiki = e.name && e.name.includes("\u3010\u5B9A\u671F\u3011");
      const isActive = e.status === 1 || e.status === 2;
      return isWithin48h && hasTeiki && isActive;
    });
    console.log(`Found ${targetEvents.length} target events matching criteria.`);
    if (targetEvents.length === 0) {
      console.log("No matching scheduled events found within 48 hours containing '\u3010\u5B9A\u671F\u3011'. Skipping notification.");
      return;
    }
    const eventDetails = [];
    for (const targetEvent of targetEvents) {
      console.log(`Fetching users for event: ${targetEvent.name} (${targetEvent.id})`);
      const usersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${targetEvent.id}/users?limit=100&with_member=true`, {
        headers: {
          "Authorization": `Bot ${env.DISCORD_TOKEN}`
        }
      });
      if (!usersRes.ok) {
        console.error(`Failed to fetch users for event ${targetEvent.id}: ${usersRes.status} ${await usersRes.text()}`);
        continue;
      }
      const eventUsers = await usersRes.json();
      eventDetails.push({
        event: targetEvent,
        users: eventUsers
      });
    }
    if (eventDetails.length === 0) {
      console.log("No user details retrieved. Skipping notification.");
      return;
    }
    let statusMessage = "";
    let embedColor = 3447003;
    const eventCount = eventDetails.length;
    const count0 = eventDetails[0]?.users.length || 0;
    const name0 = eventDetails[0]?.event.name || "";
    if (eventCount === 1) {
      if (count0 >= 10) {
        statusMessage = `\u{1F525} **\u958B\u50AC\u78BA\u5B9A\uFF01**
\u300C${name0}\u300D\u304C\u5358\u4F53\u306710\u4EBA\u4EE5\u4E0A\u306B\u9054\u3057\u3066\u3044\u307E\u3059\uFF01\u3053\u306E\u307E\u307E\u958B\u50AC\u3057\u307E\u3059\u3002`;
        embedColor = 3066993;
      } else {
        statusMessage = `\u26A0\uFE0F **\u30E1\u30F3\u30D0\u30FC\u52DF\u96C6\u4E2D\uFF01**
\u73FE\u5728\u306E\u53C2\u52A0\u4E88\u5B9A\u8005\u306F **${count0}\u540D** \u3067\u3059\u3002\u30AB\u30B9\u30BF\u30E0\u958B\u50AC\uFF0810\u4EBA\uFF09\u307E\u3067\u3042\u3068 **${10 - count0}\u540D** \u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\u3002\u53C2\u52A0\u3067\u304D\u308B\u65B9\u306F\u300C\u8208\u5473\u3042\u308A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\uFF01`;
        embedColor = 15158332;
      }
    } else {
      const count1 = eventDetails[1]?.users.length || 0;
      const name1 = eventDetails[1]?.event.name || "";
      const totalCount = count0 + count1;
      if (count0 >= 10 || count1 >= 10) {
        if (count0 >= 10 && count1 >= 10) {
          statusMessage = `\u{1F525} **\u30C0\u30D6\u30EB\u958B\u50AC\u78BA\u5B9A\uFF01**
\u300C${name0}\u300D\u3068\u300C${name1}\u300D\u304C\u305D\u308C\u305E\u308C\u5358\u4F53\u306710\u4EBA\u4EE5\u4E0A\u306B\u9054\u3057\u3066\u3044\u307E\u3059\uFF01\u4E21\u65B9\u306E\u90E8\u5C4B\u3067\u958B\u50AC\u3057\u307E\u3059\u3002`;
        } else {
          const reachedName = count0 >= 10 ? name0 : name1;
          statusMessage = `\u{1F525} **\u958B\u50AC\u78BA\u5B9A\uFF01**
\u300C${reachedName}\u300D\u304C\u5358\u4F53\u306710\u4EBA\u4EE5\u4E0A\u306B\u9054\u3057\u3066\u3044\u307E\u3059\uFF01\u3053\u306E\u307E\u307E\u958B\u50AC\u3057\u307E\u3059\u3002`;
        }
        embedColor = 3066993;
      } else if (totalCount >= 10) {
        statusMessage = `\u{1F4E2} **\u5408\u540C\u958B\u50AC\u898B\u8FBC\u307F\uFF01**
\u5358\u4F53\u3067\u306F10\u4EBA\u672A\u6E80\u3067\u3059\u304C\u3001\u8DB3\u3059\u3068\u5408\u8A08 **${totalCount}\u540D** \u306B\u9054\u3057\u3066\u3044\u308B\u305F\u3081\u3001\u5408\u540C\u30AB\u30B9\u30BF\u30E0\u304C\u958B\u50AC\u53EF\u80FD\u3067\u3059\uFF01`;
        embedColor = 15844367;
      } else {
        statusMessage = `\u26A0\uFE0F **\u30E1\u30F3\u30D0\u30FC\u52DF\u96C6\u4E2D\uFF01**
\u73FE\u5728\u306E\u5408\u8A08\u53C2\u52A0\u4E88\u5B9A\u8005\u306F **${totalCount}\u540D** \u3067\u3059\u3002\u30AB\u30B9\u30BF\u30E0\u958B\u50AC\uFF0810\u4EBA\uFF09\u307E\u3067\u3042\u3068 **${10 - totalCount}\u540D** \u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\u3002\u53C2\u52A0\u3067\u304D\u308B\u65B9\u306F\u300C\u8208\u5473\u3042\u308A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\uFF01`;
        embedColor = 15158332;
      }
    }
    const embedFields = eventDetails.map((ed) => {
      const { event: targetEvent, users: eventUsers } = ed;
      const userListText = eventUsers.map((eu, index) => {
        const displayName = eu.member?.nick || eu.user.global_name || eu.user.username;
        return `\`${String(index + 1).padStart(2, "0")}.\` <@${eu.user.id}> (${displayName})`;
      }).join("\n") || "\u300C\u8208\u5473\u3042\u308A\u300D\u3092\u62BC\u3057\u3066\u3044\u308B\u30D7\u30EC\u30A4\u30E4\u30FC\u306F\u3044\u307E\u305B\u3093\u3002";
      const eventDate = new Date(targetEvent.scheduled_start_time);
      const formattedDate = eventDate.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short"
      });
      return {
        name: `\u{1F4DD} ${targetEvent.name} (${eventUsers.length}\u540D)`,
        value: `**\u958B\u50AC\u4E88\u5B9A**: ${formattedDate} (JST)

${userListText}`,
        inline: false
      };
    });
    const embed = {
      title: `\u{1F4C5} \u3010\u5B9A\u671F\u3011\u30A4\u30D9\u30F3\u30C8\u300C\u8208\u5473\u3042\u308A\u300D\u8868\u660E\u30E1\u30F3\u30D0\u30FC\u72B6\u6CC1`,
      description: statusMessage,
      color: embedColor,
      fields: embedFields,
      footer: {
        text: "KTM Bot | \u5B9A\u671F\u901A\u77E5\u30B7\u30B9\u30C6\u30E0"
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const sendRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${env.DISCORD_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ embeds: [embed] })
    });
    if (!sendRes.ok) {
      console.error(`Failed to send message to channel ${channelId}: ${sendRes.status} ${await sendRes.text()}`);
    } else {
      console.log(`Integrated notification sent successfully.`);
    }
  } catch (err) {
    console.error("Error in sendEventUsersNotification:", err);
  }
}
__name(sendEventUsersNotification, "sendEventUsersNotification");

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const DISCORD_TOKEN = env.DISCORD_TOKEN;
    if (url.pathname === "/announce-match" && request.method === "POST") {
      const gasSecret = request.headers.get("x-gas-secret");
      const expectedSecret = env.INTERNAL_GAS_SECRET || "ktm_v3_internal_secret_2026";
      if (gasSecret !== expectedSecret) {
        console.error(`Unauthorized GAS request: received=${gasSecret}, expected=${expectedSecret}`);
        return new Response("Unauthorized", { status: 401 });
      }
      const payload = await request.json();
      return await handleAnnounceMatch(payload, { ...env, DISCORD_TOKEN }, ctx);
    }
    if (url.pathname === "/post-report" && request.method === "POST") {
      const gasSecret = request.headers.get("x-gas-secret");
      const expectedSecret = env.INTERNAL_GAS_SECRET || "ktm_v3_internal_secret_2026";
      if (gasSecret !== expectedSecret) {
        return new Response("Unauthorized", { status: 401 });
      }
      const payload = await request.json();
      const channelId = payload.channelId || "1485636511679651871";
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${DISCORD_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: payload.content || "",
          embeds: payload.embeds || []
        })
      });
      if (!res.ok) {
        return new Response(`Discord Error: ${await res.text()}`, { status: 500 });
      }
      return new Response("OK", { status: 200 });
    }
    if (url.pathname === "/trigger-scheduled" && request.method === "GET") {
      const authKey = url.searchParams.get("key");
      const expectedSecret = env.INTERNAL_GAS_SECRET || "ktm_v3_internal_secret_2026";
      if (authKey !== expectedSecret) {
        console.error(`Unauthorized trigger attempt: key=${authKey}`);
        return new Response("Unauthorized", { status: 401 });
      }
      const mode = url.searchParams.get("mode") || "";
      ctx.waitUntil((async () => {
        try {
          await handleScheduledEvent({ cron: "manual", mode }, { ...env, DISCORD_TOKEN }, ctx);
        } catch (e) {
          console.error("Manual trigger error:", e);
        }
      })());
      return new Response("Scheduled event triggered successfully", { status: 200 });
    }
    if (request.method !== "POST")
      return new Response("Method Not Allowed", { status: 405 });
    const signature = request.headers.get("x-signature-ed25519");
    const timestamp = request.headers.get("x-signature-timestamp");
    const body = await request.text();
    const DISCORD_PUBLIC_KEY = env.DISCORD_PUBLIC_KEY || "76e0b420148ce039566dd37ee6dd9f23840d701e1d95920d8b001c6779378915";
    const isVerified = await verifySignature(body, signature, timestamp, DISCORD_PUBLIC_KEY);
    if (!isVerified)
      return new Response("Invalid signature", { status: 401 });
    try {
      const interaction = JSON.parse(body);
      if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), { headers: { "Content-Type": "application/json" } });
      }
      if (interaction.type === 2) {
        const name = interaction.data.name;
        const context = { ...env, DISCORD_TOKEN };
        if (name === "ign")
          return await handleSetIgn(interaction, context, ctx);
        if (name === "recruit")
          return handleRecruitDirect(interaction);
        if (name === "stats")
          return handleStatsCommand(interaction, context, ctx);
        if (name === "lane")
          return handleLaneCommand(interaction, context, ctx);
        if (name === "memo")
          return await handleMemoCommand(interaction, context, ctx);
        if (name === "panel") {
          return Response.json({
            type: 4,
            data: {
              content: "\u{1F39B}\uFE0F **KTM \u7DCF\u5408\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB\u30D1\u30CD\u30EB**\n\u4F7F\u3044\u305F\u3044\u6A5F\u80FD\u306E\u30DC\u30BF\u30F3\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
              embeds: [],
              components: (await Promise.resolve().then(() => (init_embeds(), embeds_exports))).getPortalComponents(interaction.member?.user?.id || interaction.user?.id)
            }
          });
        }
      }
      if (interaction.type === 3)
        return await handleButtonInteraction(interaction, { ...env, DISCORD_TOKEN }, ctx);
      if (interaction.type === 5)
        return await handleModalSubmit(interaction, { ...env, DISCORD_TOKEN }, ctx);
    } catch (err) {
      console.error("Interaction Error:", err);
      const errBody = JSON.stringify({
        type: 4,
        data: { content: `\u26A0\uFE0F **\u7DCA\u6025\u30A8\u30E9\u30FC**: ${err.message}
\`\`\`${err.stack}\`\`\``, flags: 64 }
      });
      return new Response(errBody, { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ type: 1 }), { headers: { "Content-Type": "application/json" } });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledEvent(event, env, ctx));
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0S1tsa/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0S1tsa/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
