// 定期カスタム募集の「シルバー以下/ゴルプラ」2部門の参加人数から、
// 埋め込みの色・状態フラグを一元計算する純粋関数。
// 新方針: ゴルプラとシルバー以下は完全分離（混合は行わない）。
// 20:00時点で10名未達の部門はカスタム中止（ノーマル・メイヘム切り替え）。

export const RECRUITMENT_COLORS = {
  recruiting: 0xc89b3c, // 琥珀色: 定員未達、募集中
  partialConfirmed: 0x3498db, // 青色: 片方の部門のみ10名達成
  confirmed: 0x2ecc71,  // 緑: 両部門ともに10名達成（満員御礼）
};

export function renderProgressBar(current, max = 10) {
  const totalBlocks = 10;
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((current / max) * totalBlocks)));
  const empty = totalBlocks - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}] ${current}/${max}名`;
}

/**
 * @param {number} silverCount シルバー以下部門の現在参加人数
 * @param {number} goldCount ゴルプラ部門の現在参加人数
 * @param {number} capacity 1部門あたりの定員(既定10)
 * @returns {{silverCount:number, goldCount:number, silverRem:number, goldRem:number,
 *   totalJoined:number, isSilverReady:boolean, isGoldReady:boolean, isAllReady:boolean, isConfirmed:boolean, isMixedReady:boolean, color:number}}
 */
export function computeRecruitmentStatus(silverCount, goldCount, capacity = 10) {
  const silverRem = Math.max(0, capacity - silverCount);
  const goldRem = Math.max(0, capacity - goldCount);
  const totalJoined = silverCount + goldCount;
  const isSilverReady = silverCount >= capacity;
  const isGoldReady = goldCount >= capacity;
  const isAllReady = isSilverReady && isGoldReady;
  const isConfirmed = isSilverReady || isGoldReady;
  const isMixedReady = false; // 新方針: 混合カスタムは行わない

  let color = RECRUITMENT_COLORS.recruiting;
  if (isAllReady) {
    color = RECRUITMENT_COLORS.confirmed;
  } else if (isConfirmed) {
    color = RECRUITMENT_COLORS.partialConfirmed;
  }

  return { silverCount, goldCount, silverRem, goldRem, totalJoined, isSilverReady, isGoldReady, isAllReady, isConfirmed, isMixedReady, color };
}

// components.js / scheduled.js 側のプログレスバー付きバナー文言
export function buildStatusBanner(status) {
  const silverBar = renderProgressBar(status.silverCount, 10);
  const goldBar = renderProgressBar(status.goldCount, 10);

  if (status.isAllReady) {
    return `🎉 **【全部門10名達成！満員御礼】**\n🛡️ **シルバー以下 (ブラインド/MMRあり)**: \`${silverBar}\` ✅開催確定\n👑 **ゴルプラ (ドラフト/MMRあり)**: \`${goldBar}\` ✅開催確定`;
  }
  if (status.isSilverReady && !status.isGoldReady) {
    return `⚡ **【シルバー以下 10名達成！開催確定】**\n🛡️ **シルバー以下 (ブラインド/MMRあり)**: \`${silverBar}\` ✅確定\n👑 **ゴルプラ (ドラフト/MMRあり)**: \`${goldBar}\` (あと**${status.goldRem}**名 ※20:00締切)`;
  }
  if (!status.isSilverReady && status.isGoldReady) {
    return `⚡ **【ゴルプラ 10名達成！開催確定】**\n🛡️ **シルバー以下 (ブラインド/MMRあり)**: \`${silverBar}\` (あと**${status.silverRem}**名 ※20:00締切)\n👑 **ゴルプラ (ドラフト/MMRあり)**: \`${goldBar}\` ✅確定`;
  }
  return `🔥 **【定期カスタム募集中！合計 ${status.totalJoined}/20名】**\n🛡️ **シルバー以下 (ブラインド/MMRあり)**: \`${silverBar}\` (あと**${status.silverRem}**名)\n👑 **ゴルプラ (ドラフト/MMRあり)**: \`${goldBar}\` (あと**${status.goldRem}**名)\n※20:00時点で10名未満の部門はカスタム中止（ノーマル/メイヘム再募集）となります`;
}
