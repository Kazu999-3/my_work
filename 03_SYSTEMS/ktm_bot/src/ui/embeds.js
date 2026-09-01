import { CONFIG } from '../config.js';
import { RECRUITMENT_COLORS } from '../utils/recruitmentStatus.js';

function renderProgressBar(current, max) {
  const totalBlocks = 10;
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((current / max) * totalBlocks)));
  const empty = totalBlocks - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}] ${current}/${max}人`;
}

/**
 * @param {object} metadata 募集メタデータ
 * @param {string} [tierLine] レート帯の内訳
 */
export function createRecruitEmbed(metadata, tierLine) {
  const currentCount = metadata.joined.length;
  const maxCount = metadata.maxCount || (metadata.mode === 'カスタム' ? 10 : 5);
  const remaining = Math.max(0, maxCount - currentCount);
  const isFull = currentCount >= maxCount;
  const isAlmostFull = remaining > 0 && remaining <= 2;

  let title = `⚔️ KTM メンバー募集 [${currentCount}/${maxCount}]`;
  if (isFull) {
    title = `🎉 メンバー確定！ [${currentCount}/${maxCount}] カスタム開催決定！`;
  } else if (isAlmostFull) {
    title = `🔥 あと【${remaining}名】でカスタム開催！ [${currentCount}/${maxCount}]`;
  }

  const ownerName = metadata.names[metadata.owner] || "不明";
  const visibleFooter = `モード: ${metadata.mode} | 募集主: ${ownerName}`;
  const progressBar = renderProgressBar(currentCount, maxCount);

  // 透明ピクセルのURLパラメータにメタデータを仕込む (完全に不可視)
  const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));
  const pixelUrl = `https://raw.githubusercontent.com/nikolay-govorov/1x1-transparent-pixel/master/1x1.png?metadata=${encodedMetadata}`;

  let bannerText = '';
  if (isFull) {
    bannerText = `✅ **10名集まりました！チーム分けの準備を行ってください。**\n\n`;
  } else if (isAlmostFull) {
    bannerText = `⚡ **あと少しで10名確定！飛び入り参加・初参加大歓迎です！**\n進捗: \`${progressBar}\` (あと**${remaining}**名)\n\n`;
  } else {
    bannerText = `進捗: \`${progressBar}\` (あと**${remaining}**名募集)\n\n`;
  }

  return {
    title,
    author: { name: `👤 募集主: ${ownerName}` },
    description: bannerText + renderRoles(metadata) + (tierLine ? `\n\n${tierLine}` : ''),
    color: isFull ? RECRUITMENT_COLORS.confirmed : (isAlmostFull ? 0xe67e22 : RECRUITMENT_COLORS.recruiting),
    thumbnail: { url: pixelUrl },
    footer: { text: visibleFooter },
    timestamp: metadata.createdAt || new Date().toISOString()
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
    lines.push("👥 **参加者一覧 (PARTICIPANTS)**");
    data.joined.forEach((id, i) => lines.push(`\`${String(i + 1).padStart(2, '0')}.\` <@${id}>`));
    for (let i = data.joined.length + 1; i <= data.maxCount; i++) {
      lines.push(`\`${String(i).padStart(2, '0')}.\` ◽ *(募集中)*`);
    }
  }
  const specHeader = (data.mode === 'ノーマル' || data.mode === 'ARAM') ? "⏳ **カスタム待機・補欠**" : "👁️ **見学・補欠メンバー**";
  if (data.spectating && data.spectating.length > 0) {
    lines.push(`\n${specHeader}`);
    data.spectating.forEach(id => lines.push(`- <@${id}>`));
  }
  return lines.join('\n');
}

export function createRecruitButtons(metadata) {
  const currentCount = metadata.joined.length;
  const maxCount = metadata.maxCount || (metadata.mode === 'カスタム' ? 10 : 5);
  const remaining = Math.max(0, maxCount - currentCount);
  const isFull = currentCount >= maxCount;
  const comps = [];

  // Row 1: メインアクション（参加・見学・キャンセル）
  if (!isFull) {
    comps.push({
      type: 1,
      components: [
        {
          type: 2,
          label: `✋ 参加する (あと${remaining}名)`,
          style: 3, // 緑
          custom_id: `join_any:${metadata.owner}`,
        },
        {
          type: 2,
          label: "👁️ 見学/補欠",
          style: 2, // 灰
          custom_id: `toggle_spectate:${metadata.owner}`,
        },
        {
          type: 2,
          label: "❌ 辞退",
          style: 4, // 赤
          custom_id: `leave_recruit:${metadata.owner}`,
        },
      ],
    });
  } else {
    comps.push({
      type: 1,
      components: [
        {
          type: 2,
          label: "🌐 Webバランサーでチーム分け",
          style: 5, // リンク
          url: `${CONFIG.PORTAL_URL}/balancer`,
        },
        {
          type: 2,
          label: "👁️ 見学/補欠に入る",
          style: 2,
          custom_id: `toggle_spectate:${metadata.owner}`,
        },
      ],
    });
  }

  // Row 2: ロール選択（ノーマルかつ未満員のみ）
  if (!isFull && metadata.mode === 'ノーマル') {
    comps.push({
      type: 1,
      components: [{
        type: 3,
        custom_id: `join_role_select:${metadata.owner}`,
        placeholder: '⚔️ 希望ロールを選んで参加（任意）',
        min_values: 0,
        max_values: 1,
        options: ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].map(r => ({ label: r, value: r })),
      }],
    });
  }

  // Row 3: 募集主メニュー
  const manageOptions = [
    { label: "⚙️ 募集を編集", value: "edit", description: "モード/時刻/人数/メモを変更" },
    { label: "👥 メンバーを代理追加", value: "proxy", description: "他の人を代わりに参加させる" },
    { label: "🚩 募集を終了", value: "close", description: "締め切ってボタンを閉じる" },
    { label: "🗑️ 募集を削除", value: "delete", description: "この募集メッセージを消す" },
  ];
  if (!isFull && metadata.mode !== 'カスタム' && metadata.joined.length >= 5) {
    manageOptions.splice(1, 0, { label: "🚀 10人に拡張", value: "upgrade", description: "カスタム10人募集に切り替え" });
  }
  comps.push({
    type: 1,
    components: [{
      type: 3,
      custom_id: `recruit_manage:${metadata.owner}`,
      placeholder: "⚙️ 募集主メニュー（編集・終了・削除…）",
      min_values: 0,
      max_values: 1,
      options: manageOptions,
    }],
  });

  return comps;
}

export function getWelcomeEmbed() {
  return {
    title: "👑 KTM LoL部へようこそ！",
    description: "カスタムマッチやノーマル募集に公平・快適に参加するための初期設定です。\nまずは下のボタンから**【3ステップ】**を完了させてください！\n\n1️⃣ **サモナー名登録 (Riot ID)**\nあなたのLoLアカウント（`名前#JP1` 等）を紐付けます。\n※未登録の方もこのボタンを押せば即座に名簿登録されます！\n\n2️⃣ **希望レーン・NG設定**\nメイン/サブレーンやNGレーンを設定します。\nチーム分け時に希望が最大限考慮されます。\n\n3️⃣ **マイ戦績 / Webポータル**\nWebポータルで個人スタッツや初心者ガイドをチェックできます。",
    color: 0xc2650f, // KTMブランドのアンバー/ゴールド調
    fields: [
      { name: "💡 初めての方へ", value: "登録完了後、募集メッセージの「✋ 参加する」を押すだけで誰でもカスタムに参加できます！", inline: false }
    ],
    footer: { text: "KTM Sovereign OS | 新規メンバー案内" },
    timestamp: new Date().toISOString()
  };
}

export function getWelcomeComponents(portalUrl = CONFIG.PORTAL_URL) {
  const row1 = [
    { type: 2, label: "📝 サモナー名登録", style: 3, custom_id: "portal_ign" },
    { type: 2, label: "📍 希望レーン設定", style: 1, custom_id: "portal_lane" }
  ];

  const row2 = [
    { type: 2, label: "📊 マイ戦績確認", style: 2, custom_id: "portal_stats" },
    { type: 2, label: "🔰 スタートガイド", style: 5, url: `${portalUrl}/guide` },
    { type: 2, label: "🌐 Webポータル", style: 5, url: `${portalUrl}/balancer` }
  ];

  return [
    { type: 1, components: row1 },
    { type: 1, components: row2 }
  ];
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

  // 即募集 & エンタメ機能 (ルーレット)
  const rowQuick = [
    { type: 2, label: "⚡ ノーマル5 即募集", style: 2, custom_id: "quick_recruit:ノーマル:5" },
    { type: 2, label: "⚡ カスタム10 即募集", style: 2, custom_id: "quick_recruit:カスタム:10" },
    { type: 2, label: "🎲 ルーレット", style: 1, custom_id: "portal_roulette" }
  ];

  const row2 = [
    { type: 2, label: "🔔 募集通知 (ON/OFF)", style: 2, custom_id: "toggle_recruit_notification" },
    { type: 2, label: "🔰 スタートガイド", style: 5, url: `${CONFIG.PORTAL_URL}/guide` },
    { type: 2, label: "🌐 Webポータルへアクセス", style: 5, url: `${CONFIG.PORTAL_URL}/leaderboard` }
  ];

  return [
    { type: 1, components: row1 },
    { type: 1, components: rowQuick },
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
