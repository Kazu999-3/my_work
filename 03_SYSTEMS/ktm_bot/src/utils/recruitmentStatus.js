// 定期カスタム募集の「シルバー以下/ゴルプラ」2部門の参加人数から、
// 埋め込みの色・状態フラグを一元計算する純粋関数。
// components.js(ボタン押下時の即時更新)とscheduled.js(定期同期アナウンス)の
// 2箇所で個別に同じ閾値ロジックを実装しており、色コードの値がズレていた
// (2026-08-10発覚: scheduled.jsの「募集中」色だけ0xe74c3cで、他箇所の
// 0xc89b3cと不一致だった)。今後は必ずこの関数経由で計算すること。

export const RECRUITMENT_COLORS = {
  recruiting: 0xc89b3c, // 琥珀色: 定員未達、通常募集中
  mixedReady: 0xf1c40f, // 黄色: 部門をまたいだ合計で定員到達、混合カスタムなら組める
  confirmed: 0x2ecc71,  // 緑: いずれかの部門単独で定員到達、通常カスタム確定
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
 *   totalJoined:number, isConfirmed:boolean, isMixedReady:boolean, color:number}}
 */
export function computeRecruitmentStatus(silverCount, goldCount, capacity = 10) {
  const silverRem = Math.max(0, capacity - silverCount);
  const goldRem = Math.max(0, capacity - goldCount);
  const totalJoined = silverCount + goldCount;
  const isConfirmed = silverCount >= capacity || goldCount >= capacity;
  const isMixedReady = !isConfirmed && totalJoined >= capacity;
  const color = isConfirmed
    ? RECRUITMENT_COLORS.confirmed
    : isMixedReady
    ? RECRUITMENT_COLORS.mixedReady
    : RECRUITMENT_COLORS.recruiting;

  return { silverCount, goldCount, silverRem, goldRem, totalJoined, isConfirmed, isMixedReady, color };
}

// components.js / scheduled.js 側のプログレスバー付きバナー文言
export function buildStatusBanner(status) {
  const silverBar = renderProgressBar(status.silverCount, 10);
  const goldBar = renderProgressBar(status.goldCount, 10);

  if (status.isConfirmed) {
    return `🎉 **【全枠10名満員御礼！チーム分け可能です】**\n🛡️ **シルバー以下**: \`${silverBar}\`\n👑 **ゴルプラ**: \`${goldBar}\``;
  }
  if (status.isMixedReady) {
    return `🟡 **【合計${status.totalJoined}名到達！部門を跨いだ混合カスタムが組めます】**\n🛡️ **シルバー以下**: \`${silverBar}\` (あと${status.silverRem}名)\n👑 **ゴルプラ**: \`${goldBar}\` (あと${status.goldRem}名)`;
  }
  return `🔥 **【定期カスタム募集中！合計 ${status.totalJoined}/20名】**\n🛡️ **シルバー以下**: \`${silverBar}\` (あと**${status.silverRem}**名)\n👑 **ゴルプラ**: \`${goldBar}\` (あと**${status.goldRem}**名)`;
}
