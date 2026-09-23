import { CONFIG } from '../config.js';
import {
  RECRUITMENT_COLORS, getDayDef, buildDayBanner, replaceBanner,
  computeDayStatus, computeDominantTier,
} from '../utils/recruitmentStatus.js';

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
  const isCustom = metadata.mode === 'カスタム';
  const maxCount = metadata.maxCount || (isCustom ? 10 : 5);
  const currentCount = metadata.joined.length;
  const remaining = Math.max(0, maxCount - currentCount);
  const isFull = currentCount >= maxCount;
  const isAlmostFull = remaining > 0 && remaining <= (isCustom ? 2 : 1);

  const modeIcon = isCustom ? '⚔️' : metadata.mode === 'ARAM' ? '❄️' : '🎮';
  let title = `${modeIcon} 【${metadata.mode}募集】 [${currentCount}/${maxCount}人]`;
  if (isFull) {
    title = isCustom
      ? `🎉 【${metadata.mode}】メンバー確定！ [${currentCount}/${maxCount}人] 出発準備完了！`
      : `🔒 [受付終了] 🎉 【${metadata.mode}】メンバー確定！ [${currentCount}/${maxCount}人]`;
  } else if (isAlmostFull) {
    title = `🔥 【あと${remaining}名】で出発！ [${currentCount}/${maxCount}人]`;
  }

  const ownerName = metadata.names[metadata.owner] || "不明";
  const customGuide = isCustom
    ? `\n\n💡 **1戦だけのスポット参加も大歓迎！途中抜け・交代も自由です**`
    : '';
  const visibleFooter = `モード: ${metadata.mode} | 募集主: ${ownerName}`;
  const progressBar = renderProgressBar(currentCount, maxCount);

  // 透明ピクセルのURLパラメータにメタデータを仕込む (完全に不可視)
  const encodedMetadata = encodeURIComponent(JSON.stringify(metadata));
  const pixelUrl = `https://raw.githubusercontent.com/nikolay-govorov/1x1-transparent-pixel/master/1x1.png?metadata=${encodedMetadata}`;

  let bannerText = '';
  if (isFull) {
    bannerText = isCustom
      ? `✅ **10名集まりました！下のボタンからWebバランサーでチーム分けを行ってください。**\n\n`
      : `✅ **5名揃いました！フルパーティーで出発できます🎮**\n\n`;
  } else if (isAlmostFull) {
    bannerText = isCustom
      ? `⚡ **あと少しで10名確定！飛び入り参加・1戦のみの参加も大歓迎です！**\n進捗: \`${progressBar}\` (あと**${remaining}**名)\n\n`
      : `⚡ **あと【${remaining}名】で満員（5人）！気軽に参加ボタンを押してください！**\n進捗: \`${progressBar}\` (あと**${remaining}**名)\n\n`;
  } else {
    bannerText = `進捗: \`${progressBar}\` (あと**${remaining}**名募集中)\n\n`;
  }

  return {
    title,
    author: { name: `👤 募集主: ${ownerName}` },
    description: bannerText + renderRoles(metadata) + (tierLine ? `\n\n${tierLine}` : '') + customGuide,
    color: isFull ? RECRUITMENT_COLORS.confirmed : (isAlmostFull ? 0xe67e22 : RECRUITMENT_COLORS.recruiting),
    thumbnail: { url: pixelUrl },
    footer: { text: visibleFooter },
    timestamp: metadata.createdAt || new Date().toISOString()
  };
}

export function renderRoles(data) {
  const isCustom = data.mode === 'カスタム';
  const icons = { Top: '🛡️', Jg: '⚔️', Mid: '🧙', Adc: '🏹', Sup: '🩹' };
  let lines = [];

  if (data.mode === 'ノーマル') {
    lines.push("🟦 **希望ポジション (ROLES)**");
    ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].forEach(r => {
      const pId = data.roles ? data.roles[r] : null;
      lines.push(`${icons[r]} **${r}**: ${pId ? `<@${pId}>` : "◽ *(空き)*"}`);
    });
    const pooled = data.joined.filter(id => !(data.roles && Object.values(data.roles).includes(id)));
    if (pooled.length > 0) {
      lines.push("\n👥 **ロール未定・参加者:**");
      pooled.forEach(id => lines.push(`- <@${id}>`));
    }
  } else {
    lines.push(`👥 **参加メンバー一覧 (${data.joined.length}/${data.maxCount || (isCustom ? 10 : 5)}人)**`);
    data.joined.forEach((id, i) => lines.push(`\`${String(i + 1).padStart(2, '0')}.\` <@${id}>`));
    const targetMax = data.maxCount || (isCustom ? 10 : 5);
    for (let i = data.joined.length + 1; i <= targetMax; i++) {
      lines.push(`\`${String(i).padStart(2, '0')}.\` ◽ *(募集中)*`);
    }
  }

  // 見学・補欠（カスタム時のみ補欠、通常時は見学のみ）
  if (data.spectating && data.spectating.length > 0) {
    const specHeader = isCustom ? "👁️ **見学・補欠メンバー**" : "👁️ **見学・応援**";
    lines.push(`\n${specHeader}`);
    data.spectating.forEach(id => lines.push(`- <@${id}>`));
  }
  return lines.join('\n');
}

export function createRecruitButtons(metadata) {
  const isCustom = metadata.mode === 'カスタム';
  const currentCount = metadata.joined.length;
  const maxCount = metadata.maxCount || (isCustom ? 10 : 5);
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
          label: isCustom ? "👁️ 見学/補欠" : "👁️ 見学",
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
  } else if (isCustom) {
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
          label: "👁️ 補欠/見学に入る",
          style: 2,
          custom_id: `toggle_spectate:${metadata.owner}`,
        }
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
    { label: "🚩 募集を終了（通知あり）", value: "close", description: "参加者に終了・解散通知を送信して締め切る" },
    { label: "🔕 募集を終了（通知なし）", value: "close_silent", description: "メンション通知を飛ばさずに静かに締め切る" },
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

export function getPortalEmbed() { 
  return { 
    title: "👑 KTM プレイヤーズハブ ＆ コントロールパネル", 
    description: "仕事終わりのLoLに「心地よい熱狂」と「大人の語らい」を。\nボタンを押すだけで、初期設定から募集作成・便利機能までワンタップで利用できます！\n\n1️⃣ **🎮 サモナー名 ＆ 希望レーン登録**\nあなたのLoLアカウント（`名前#JP1`）と希望ポジションを一括登録！（未登録の方も自動で名簿作成＆ランク同期されます）\n\n2️⃣ **⚔️ メンバー募集開始**\nカスタム(10人)・ノーマル(5人)・ARAMの募集を自由に設定して作成！\n\n3️⃣ **⚡ クイック即募集**\n「ノーマル5人」「カスタム10人」の募集をワンタップで即座に投下！\n\n4️⃣ **📖 Webポータル ＆ ガイド**\n個人スタッツ、リーダーボード、初心者ガイド、師弟ハブはこちらから。", 
    color: 0xc2650f, 
    footer: { text: "KTM Sovereign OS | プレイヤーズハブ" },
    timestamp: new Date().toISOString()
  }; 
}

export function getWelcomeEmbed() {
  return getPortalEmbed();
}

export function getPortalComponents(userId, portalUrl = CONFIG.PORTAL_URL) {
  // Row 1: メインアクション（一括登録・募集作成・マイ戦績）
  const row1 = [
    { type: 2, label: "🎮 サモナー名 ＆ 希望レーン登録", style: 3, custom_id: "portal_register" },
    { type: 2, label: "⚔️ メンバー募集開始", style: 1, custom_id: "portal_recruit" },
    { type: 2, label: "📊 マイ戦績確認", style: 2, custom_id: "portal_stats" }
  ];

  // Row 2: 即募集
  const rowQuick = [
    { type: 2, label: "⚡ ノーマル5 即募集", style: 2, custom_id: "quick_recruit:ノーマル:5" },
    { type: 2, label: "⚡ カスタム10 即募集", style: 2, custom_id: "quick_recruit:カスタム:10" }
  ];

  // Row 3: 個別設定・通知
  const rowSettings = [
    { type: 2, label: "📝 サモナー名変更", style: 2, custom_id: "portal_ign" },
    { type: 2, label: "📍 レーン設定変更", style: 2, custom_id: "portal_lane" },
    { type: 2, label: "🔔 募集通知 (ON/OFF)", style: 2, custom_id: "toggle_recruit_notification" }
  ];

  // Row 4: Webポータルリンク
  const rowWeb = [
    { type: 2, label: "📖 初心者・機能ガイド", style: 5, url: `${portalUrl}/guide` },
    { type: 2, label: "🌐 Webポータル (バランサー)", style: 5, url: `${portalUrl}/balancer` }
  ];

  return [
    { type: 1, components: row1 },
    { type: 1, components: rowQuick },
    { type: 1, components: rowSettings },
    { type: 1, components: rowWeb }
  ];
}

export function getWelcomeComponents(portalUrl = CONFIG.PORTAL_URL) {
  return getPortalComponents(null, portalUrl);
}

export function handleHelpPage() {
  const pages = [
    { title: "📜 KTM ガイド (1/3): 基本設定", description: "1. 「📝 サモナー名登録」でRiot IDを連携\n2. 「📍 レーン設定」で希望ロールを登録\n3. 募集カードの「✋ 参加する」を押して参戦！", color: 0x3498db },
    { title: "⚡ KTM ガイド (2/3): 爆速募集コマンド", description: "`/recruit` はオプションなしでもAIがスマート判定！\n\n・`/recruit` ➔ デフォルト（今からノーマル5人募集）\n・`/recruit 21:00 カスタム` ➔ 21:00開始のカスタム10人募集\n・`/recruit ARAM` ➔ ARAM5人募集\n・`/recruit 5 楽しく` ➔ メモ付き募集", color: 0x2ecc71 },
    { title: "📊 KTM ガイド (3/3): レートと表彰", description: "対戦結果に基づき MMR が公平なマッチを自動生成します。\n毎月1日には月間MVPなどの表彰も発表されます！", color: 0xe67e22 }
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

// ============================================================================
// 週末定期カスタム（土曜カード / 日曜カード）
// ----------------------------------------------------------------------------
// ★ 2026-09-23: 土日を1枚のカードへ同居させる構成をやめ、1日1枚へ分離した。
//   カードの組み立ては「水曜の自動投稿(scheduled.js)」と「参加ボタン押下時の再描画
//   (components.js)」の2箇所から呼ばれる。過去、この2箇所が別々にEmbedを組んでいたために
//   「初回投稿の文言」と「ボタンが1回押された後の文言」が食い違う不具合が実際に出ている
//   （初回だけバナーをハードコードしており、1回押された瞬間に文言が変わっていた）。
//   状態の反映は必ず applyDayCardState() 1本を通すこと。
// ============================================================================

// Discordの制限: Embedのフィールド value は1024文字まで。超えるとメッセージ全体が
// 400で弾かれ、カードが1枚も投稿されない。参加者が増えた場合や旧カードからの
// 引き継ぎで超えうるため、入りきらない分は件数だけ示して切り詰める。
const FIELD_VALUE_LIMIT = 1024;

function renderEntryList(lines) {
  if (!lines || lines.length === 0) return '▫ まだ誰もいません。最初の1人になりませんか？';

  const out = [];
  let length = 0;
  for (const line of lines) {
    const rest = `…ほか${lines.length - out.length}名`;
    if (length + line.length + 1 + rest.length + 1 > FIELD_VALUE_LIMIT) {
      out.push(rest);
      return out.join('\n');
    }
    out.push(line);
    length += line.length + 1;
  }
  return out.join('\n');
}

/**
 * 募集カードEmbedへ、現在の参加者から導かれる状態（バナー・色・参加者フィールド）を反映する。
 * 新規作成時も更新時もこの関数を通すため、文言の二重管理が発生しない。
 *
 * @param {object} embed 対象のEmbed（破壊的に更新する）
 * @param {string} dayKey 'sat' | 'sun'
 * @param {string[]} entryLines 参加者行（'- <@id> 🟢フル ...' 形式）
 */
export function applyDayCardState(embed, dayKey, entryLines) {
  const def = getDayDef(dayKey);
  const lines = entryLines || [];
  const status = computeDayStatus(lines.length);
  // 最多ランク帯は土曜（チーム分け基準あり）でのみ意味を持つ。
  const dominantTierText = def.showRank ? computeDominantTier(lines) : '';
  const banner = buildDayBanner(def.key, status, dominantTierText);

  // description は「バナー ＋ 空行 ＋ 補足1行」で固定する（replaceBanner の前提）。
  // ボタンの凡例はボタンのラベル自体に同じ情報があるため、カードには載せない（文字量削減）。
  embed.description = embed.description
    ? replaceBanner(embed.description, banner)
    : `${banner}\n\n${def.rule}`;
  embed.color = status.color;
  embed.fields = [
    {
      name: `👥 参加者 (${status.joined}/${status.capacity}名)`,
      value: renderEntryList(lines),
      inline: false,
    },
  ];

  return { embed, status, dominantTierText };
}

/**
 * 1日分の募集カードEmbedを新規に組み立てる。
 * @param {{dayKey: string, label: string}} target 対象日（label例: '9/26(土)'）
 * @param {string[]} [entryLines] 参加者行
 */
export function buildDayRecruitEmbed(target, entryLines = []) {
  const def = getDayDef(target.dayKey);
  const embed = {
    title: `${def.emoji} KTM ${def.name}　${target.label} 21:00〜`,
    footer: { text: '20:00時点で10名未満なら中止 → ノーマル/ARAM代替募集へ ｜ 土曜と日曜は別々の募集です' },
    timestamp: new Date().toISOString(),
  };
  applyDayCardState(embed, target.dayKey, entryLines);
  return embed;
}

/** 1日分の参加ボタン（フル / 1戦のみ / 途中参加 / 辞退）を組み立てる */
export function buildDayRecruitComponents(dayKey) {
  const def = getDayDef(dayKey);
  return [
    {
      type: 1,
      components: [
        { type: 2, label: `${def.emoji} フル参加`, style: def.buttonStyle, custom_id: `${def.joinPrefix}:full` },
        { type: 2, label: '⏱️ 1戦のみ (21:00〜)', style: 2, custom_id: `${def.joinPrefix}:single` },
        { type: 2, label: '🌙 途中参加 (2戦目〜)', style: 2, custom_id: `${def.joinPrefix}:late` },
        { type: 2, label: '❌ 辞退', style: 4, custom_id: `${def.joinPrefix}:leave` },
      ],
    },
  ];
}
