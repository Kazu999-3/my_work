// 定期カスタム募集の「土曜定期カスタム（最多ランク基準自動マッチング） / 日曜お祭りカスタム」の参加人数から、
// 埋め込みの色・状態フラグを一元計算する純粋関数。
// 新方針:
// ・土曜: 1つの統合プール制。参加者のランク分布を集計し、最も人数の多いランク帯を基準にバランサーが均等編成。
// ・日曜: ランク不問のお遊び・お祭りカスタム（MMR変動なし）。

export const RECRUITMENT_COLORS = {
  recruiting: 0xc89b3c, // 琥珀色: 定員未達、募集中
  partialConfirmed: 0x3498db, // 青色: 土曜または日曜が10名達成
  confirmed: 0x2ecc71,  // 緑: 両日10名達成（満員御礼）
};

export function renderProgressBar(current, max = 10) {
  const totalBlocks = 10;
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((current / max) * totalBlocks)));
  const empty = totalBlocks - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}] ${current}/${max}名`;
}

/**
 * @param {number} satCount 土曜定期カスタムの参加人数
 * @param {number} [sunCount] 日曜お祭りカスタムの参加人数
 * @param {number} capacity 1日あたりの定員(既定10)
 */
export function computeRecruitmentStatus(satCount, sunCount = 0, thirdParam = undefined, capacity = 10) {
  let saturdayCount = satCount;
  let sundayCount = sunCount;

  // 以前の3引数 (silver, gold, sunday) が渡された場合の互換性対応
  if (typeof thirdParam === 'number') {
    saturdayCount = satCount + sunCount;
    sundayCount = thirdParam;
  }

  const satRem = Math.max(0, capacity - saturdayCount);
  const sunRem = Math.max(0, capacity - sundayCount);
  const totalJoined = saturdayCount + sundayCount;
  const isSatReady = saturdayCount >= capacity;
  const isSunReady = sundayCount >= capacity;
  const isAllReady = isSatReady && isSunReady;
  const isConfirmed = isSatReady || isSunReady;

  let color = RECRUITMENT_COLORS.recruiting;
  if (isAllReady) {
    color = RECRUITMENT_COLORS.confirmed;
  } else if (isConfirmed) {
    color = RECRUITMENT_COLORS.partialConfirmed;
  }

  return {
    saturdayCount,
    sundayCount,
    satRem,
    sunRem,
    totalJoined,
    isSatReady,
    isSunReady,
    isAllReady,
    isConfirmed,
    color,
    // 互換性用エイリアス
    silverCount: saturdayCount,
    goldCount: 0,
    isSilverReady: isSatReady,
    isGoldReady: false,
    isSundayReady: isSunReady,
    silverRem: satRem,
    goldRem: 0,
    sundayRem: sunRem
  };
}

// components.js / scheduled.js 側のプログレスバー付きバナー文言
export function buildStatusBanner(status, dominantTierText = '') {
  const satBar = renderProgressBar(status.saturdayCount, 10);
  const sunBar = renderProgressBar(status.sundayCount || 0, 10);

  let header = `🔥 **【週末定期カスタム募集中！合計 ${status.totalJoined}/20名】**`;
  if (status.isAllReady) {
    header = `🎉 **【土日ともに10名達成！満員御礼】**`;
  } else if (status.isConfirmed) {
    header = `⚡ **【開催確定日あり！週末定期カスタム】**`;
  }

  const dominantNote = dominantTierText ? ` (基準: **${dominantTierText}**)` : '';

  return [
    header,
    `⚔️ **土曜・本戦カスタム (自動マッチング)**: \`${satBar}\` ${status.isSatReady ? '✅開催確定' : `(あと**${status.satRem}**名)`}${dominantNote}`,
    `🎪 **日曜・お祭りカスタム (ランク不問/MMRなし)**: \`${sunBar}\` ${status.isSunReady ? '✅開催確定' : `(あと**${status.sunRem}**名)`}`,
    `※当日20:00時点で10名未満の日は中止（ノーマル/ARAM代替募集）となります`
  ].join('\n');
}
