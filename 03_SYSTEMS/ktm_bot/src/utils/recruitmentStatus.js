// 定期カスタム募集の「土曜シルバー以下 / 土曜ゴルプラ / 日曜お祭り」3部門の参加人数から、
// 埋め込みの色・状態フラグを一元計算する純粋関数。
// 新方針:
// ・土曜: ゴルプラとシルバー以下は完全分離（混合なし/MMR変動あり/ブラインド&ドラフト）。20:00時点で10名未満は中止。
// ・日曜: ランク不問のお遊び・お祭りカスタム（MMR変動なし）。

export const RECRUITMENT_COLORS = {
  recruiting: 0xc89b3c, // 琥珀色: 定員未達、募集中
  partialConfirmed: 0x3498db, // 青色: いずれかの部門が10名達成
  confirmed: 0x2ecc71,  // 緑: 全部門10名達成（満員御礼）
};

export function renderProgressBar(current, max = 10) {
  const totalBlocks = 10;
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((current / max) * totalBlocks)));
  const empty = totalBlocks - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}] ${current}/${max}名`;
}

/**
 * @param {number} silverCount 土曜シルバー以下部門の現在参加人数
 * @param {number} goldCount 土曜ゴルプラ部門の現在参加人数
 * @param {number} [sundayCount] 日曜お祭り部門の現在参加人数
 * @param {number} capacity 1部門あたりの定員(既定10)
 * @returns {{silverCount:number, goldCount:number, sundayCount:number, silverRem:number, goldRem:number, sundayRem:number,
 *   totalJoined:number, isSilverReady:boolean, isGoldReady:boolean, isSundayReady:boolean, isAllReady:boolean, isConfirmed:boolean, isMixedReady:boolean, color:number}}
 */
export function computeRecruitmentStatus(silverCount, goldCount, sundayCount = 0, capacity = 10) {
  const silverRem = Math.max(0, capacity - silverCount);
  const goldRem = Math.max(0, capacity - goldCount);
  const sundayRem = Math.max(0, capacity - sundayCount);
  const totalJoined = silverCount + goldCount + sundayCount;
  const isSilverReady = silverCount >= capacity;
  const isGoldReady = goldCount >= capacity;
  const isSundayReady = sundayCount >= capacity;
  const isAllReady = isSilverReady && isGoldReady && isSundayReady;
  const isConfirmed = isSilverReady || isGoldReady || isSundayReady;
  const isMixedReady = false;

  let color = RECRUITMENT_COLORS.recruiting;
  if (isAllReady) {
    color = RECRUITMENT_COLORS.confirmed;
  } else if (isConfirmed) {
    color = RECRUITMENT_COLORS.partialConfirmed;
  }

  return { silverCount, goldCount, sundayCount, silverRem, goldRem, sundayRem, totalJoined, isSilverReady, isGoldReady, isSundayReady, isAllReady, isConfirmed, isMixedReady, color };
}

// components.js / scheduled.js 側のプログレスバー付きバナー文言
export function buildStatusBanner(status) {
  const silverBar = renderProgressBar(status.silverCount, 10);
  const goldBar = renderProgressBar(status.goldCount, 10);
  const sundayBar = renderProgressBar(status.sundayCount || 0, 10);

  let header = `🔥 **【週末定期カスタム募集中！合計 ${status.totalJoined}/30名】**`;
  if (status.isAllReady) {
    header = `🎉 **【全部門10名達成！満員御礼】**`;
  } else if (status.isConfirmed) {
    header = `⚡ **【開催確定部門あり！週末定期カスタム】**`;
  }

  return [
    header,
    `🛡️ **土曜・シルバー以下 (ブラインド/MMRあり)**: \`${silverBar}\` ${status.isSilverReady ? '✅確定' : `(あと**${status.silverRem}**名)`}`,
    `👑 **土曜・ゴルプラ (ドラフト/MMRあり)**: \`${goldBar}\` ${status.isGoldReady ? '✅確定' : `(あと**${status.goldRem}**名)`}`,
    `🎪 **日曜・お祭りカスタム (ランク不問/MMRなし)**: \`${sundayBar}\` ${status.isSundayReady ? '✅確定' : `(あと**${status.sundayRem}**名)`}`,
    `※土曜は当日20:00時点で10名未満の部門は中止（ノーマル/メイヘム再募集）となります`
  ].join('\n');
}
