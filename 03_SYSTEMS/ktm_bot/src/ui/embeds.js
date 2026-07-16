import { CONFIG } from '../config.js';

export function createRecruitEmbed(metadata) {
  const isFull = metadata.joined.length >= metadata.maxCount;
  const title = isFull ? "⚔️ メンバー確定" : `⚔️ KTM メンバー募集 [${metadata.joined.length}/${metadata.maxCount}]`;
  
  const ownerName = metadata.names[metadata.owner] || "不明";
  const visibleFooter = `モード: ${metadata.mode} | 募集主: ${ownerName}`;
  
  // 透明ピクセルのURLパラメータにメタデータを仕込む (完全に不可視)
  const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));
  const pixelUrl = `https://raw.githubusercontent.com/nikolay-govorov/1x1-transparent-pixel/master/1x1.png?metadata=${encodedMetadata}`;

  return { 
    title, 
    description: renderRoles(metadata), 
    color: isFull ? 0xe74c3c : 0x2ecc71, 
    thumbnail: { url: pixelUrl },
    footer: { text: visibleFooter }, 
    timestamp: new Date().toISOString() 
  };
}

export function renderRoles(data) {
  const icons = { Top: '🛡️', Jg: '⚔️', Mid: '🧙', Adc: '🏹', Sup: '🩹' };
  let lines = [];
  if (data.mode === 'ノーマル') {
    lines.push("🟦 **TEAM ROLES**");
    ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].forEach(r => lines.push(`${icons[r]} **${r}**: ${data.roles[r] ? `<@${data.roles[r]}>` : "◽"}`));
    const pooled = data.joined.filter(id => !Object.values(data.roles).includes(id));
    if (pooled.length > 0) pooled.forEach(id => lines.push(`- <@${id}>`));
  } else {
    lines.push("👥 **PARTICIPANTS POOL**");
    data.joined.forEach((id, i) => lines.push(`${i+1}. <@${id}>`));
    for (let i = data.joined.length + 1; i <= data.maxCount; i++) lines.push(`${i}. ◽`);
  }
  const specHeader = (data.mode === 'ノーマル' || data.mode === 'ARAM') ? "⏳ **カスタム待機**" : "👁️ **SPECTATORS**";
  if (data.spectating.length > 0) { lines.push(`\n${specHeader}`); data.spectating.forEach(id => lines.push(`- <@${id}>`)); }
  return lines.join('\n');
}

export function createRecruitButtons(metadata) {
  const isFull = metadata.joined.length >= metadata.maxCount;

  // Row 1: 参加メイン
  const row1 = [];
  if (!isFull) {
    row1.push({ type: 2, label: "✋ どこでも参加", style: 1, custom_id: `join_any:${metadata.owner}` });
  } else {
    row1.push({ type: 2, label: "✅ 募集完了 (ポータルでチーム分け)", style: 2, custom_id: `recruit_completed`, disabled: true });
  }

  // Row 2: 管理・設定（一括連絡ボタンは削除。募集への返信でメンション可能）
  const row2 = [
    { type: 2, label: "⚙️ 募集編集", style: 2, custom_id: `edit_recruit_init:${metadata.owner}` }
  ];
  if (!isFull && metadata.mode !== 'カスタム' && metadata.joined.length >= 5) {
    row2.push({ type: 2, label: "🚀 10人に拡張", style: 1, custom_id: `upgrade_to_10:${metadata.owner}` });
  }

  // Row 3: システム・終了
  const row3 = [
    { type: 2, label: "🚩 募集終了", style: 2, custom_id: `close:${metadata.owner}` },
    { type: 2, label: "👥 代理追加", style: 2, custom_id: `proxy_add_init:${metadata.owner}` },
    { type: 2, label: "🗑️ 削除", style: 4, custom_id: `delete_recruit:${metadata.owner}` }
  ];

  const comps = [
    { type: 1, components: row1 },
    { type: 1, components: row2 },
    { type: 1, components: row3 }
  ];

  // Row 4: ロール選択 (ノーマル時のみ)
  if (!isFull && metadata.mode === 'ノーマル') {
    comps.push({ type: 1, components: ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].map(r => ({ type: 2, label: r, style: 2, custom_id: `join_role:${r}:${metadata.owner}` })) });
  }

  return comps;
}

export function getPortalEmbed() { 
  return { 
    title: "🛡️ KTM 司令塔: ポータルOS", 
    description: "ドロップダウンから操作を選択してください。", 
    color: 0x34495e, 
    footer: { text: "KTM Sovereign OS v3.0 Portal" } 
  }; 
}

export function getPortalComponents(userId) {
  const row1 = [
    { type: 2, label: "⚔️ 募集開始", style: 3, custom_id: "portal_recruit" },
    { type: 2, label: "📊 マイ戦績", style: 1, custom_id: "portal_stats" },
    { type: 2, label: "📍 レーン設定", style: 2, custom_id: "portal_lane" },
    { type: 2, label: "📝 サモナー名登録", style: 2, custom_id: "portal_ign" }
  ];
  
  const row2 = [
    { type: 2, label: "🔔 募集通知 (ON/OFF)", style: 2, custom_id: "toggle_recruit_notification" },
    { type: 2, label: "🌐 Webポータルへアクセス", style: 5, url: "https://my-work-8jbd.vercel.app/leaderboard" }
  ];
  
  return [
    { type: 1, components: row1 },
    { type: 1, components: row2 }
  ];
}

export function handleHelpPage() {
  const pages = [
    { title: "📜 KTM ガイド (1/3): 基本", description: "VCへ入り、レーンを設定して参加しましょう。", color: 0x3498db },
    { title: "⚔️ KTM ガイド (2/3): 募集", description: "参加/10人拡張などのボタンが利用可能です。", color: 0x2ecc71 },
    { title: "📊 KTM ガイド (3/3): レート", description: "対戦結果に基づき MMR が公平なマッチを生成します。", color: 0xe67e22 }
  ];
  return { embeds: pages };
}

export function createMessageContent(metadata) { 
  const lines = [];
  if (CONFIG.NOTIFICATION_ROLE_ID) {
    lines.push(`<@&${CONFIG.NOTIFICATION_ROLE_ID}>`);
  }
  if (metadata.time) {
    lines.push(`⏰ **開始予定**: ${metadata.time}`);
  }
  if (metadata.memo) {
    lines.push(`💬 **メモ**: ${metadata.memo}`);
  }
  return lines.join('\n').trim(); 
}

/** チーム分けEmbedからプレイヤー情報抽出 */
export function extractPlayersFromEmbed(embed) {
  const players = []; 
  const fields = embed.fields || [];
  const teamAField = fields.find(f => f.name.includes("Team A"));
  const teamBField = fields.find(f => f.name.includes("Team B"));

  const parseLine = (line, team) => {
    // `ROLE` プレイヤー名 (カッコ内は任意) の形式に対応
    // 例: `TOP` りくや  /  `TOP` りくや (1234)  /  `TOP` りくや (3.0)
    const match = line.match(/`([^`]+)`\s+(.+?)(?:\s*\(.*\))?\s*$/);
    if (!match) return null;
    return { role: match[1].trim(), name: match[2].trim(), team };
  };

  if (teamAField) teamAField.value.split('\n').forEach(l => { const p = parseLine(l, 'BLUE'); if (p) players.push(p); });
  if (teamBField) teamBField.value.split('\n').forEach(l => { const p = parseLine(l, 'RED'); if (p) players.push(p); });
  return players;
}

/** 文字数分割 */
export function splitMessage(text, limit = 1800) {
  const chunks = [];
  let current = "";
  text.split('\n').forEach(line => {
    if ((current.length + line.length + 1) > limit) {
      if (current) chunks.push(current);
      current = "";
    }
    current += line + "\n";
  });
  if (current) chunks.push(current);
  return chunks;
}
