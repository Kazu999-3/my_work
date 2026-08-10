// utils/recruitmentStatus.js の計算結果を、Discordに一切投稿せずに
// 手元で目視確認するためのドライランスクリプト。
// KTM Botの募集カード色ロジックを変更した際は、実際にDiscordへ投稿して
// 確認する前に、まずこれで全パターンの色・状態が想定通りか確認すること。
//
// 使い方: node scripts/dry_run_recruitment_status.mjs

import { computeRecruitmentStatus, buildStatusBanner, RECRUITMENT_COLORS } from '../src/utils/recruitmentStatus.js';

const COLOR_NAMES = Object.fromEntries(
  Object.entries(RECRUITMENT_COLORS).map(([name, hex]) => [hex, name])
);

const cases = [
  { label: '募集開始直後', silver: 0, gold: 0 },
  { label: '片方だけ少し埋まっている', silver: 3, gold: 0 },
  { label: '合計10名未満(混合カスタム不可)', silver: 4, gold: 5 },
  { label: '合計ちょうど10名(混合カスタム可能)', silver: 6, gold: 4 },
  { label: '合計10名到達の境界(片方が9名)', silver: 9, gold: 1 },
  { label: 'シルバー単独で定員到達(開催確定)', silver: 10, gold: 3 },
  { label: 'ゴルプラ単独で定員到達(開催確定)', silver: 2, gold: 10 },
  { label: '両部門とも満員', silver: 10, gold: 10 },
  { label: '異常値: 定員超過(離脱漏れ等の想定外データ)', silver: 12, gold: 0 },
];

let hasFailure = false;

console.log('silver | gold | color              | isConfirmed | isMixedReady | banner');
console.log('-------|------|--------------------|-------------|--------------| ------');

for (const c of cases) {
  const status = computeRecruitmentStatus(c.silver, c.gold);
  const banner = buildStatusBanner(status);
  const colorName = COLOR_NAMES[status.color] || `不明(0x${status.color.toString(16)})`;

  // 期待される不変条件を軽く自己検証する。
  if (status.isConfirmed && status.isMixedReady) {
    console.error(`❌ [${c.label}] isConfirmedとisMixedReadyが同時にtrueになっています`);
    hasFailure = true;
  }
  if (status.totalJoined !== c.silver + c.gold) {
    console.error(`❌ [${c.label}] totalJoinedの計算が不正です`);
    hasFailure = true;
  }

  console.log(
    `${String(c.silver).padStart(6)} | ${String(c.gold).padStart(4)} | ${colorName.padEnd(18)} | ${String(status.isConfirmed).padEnd(11)} | ${String(status.isMixedReady).padEnd(12)} | ${banner} 【${c.label}】`
  );
}

if (hasFailure) {
  console.error('\n❌ 不変条件違反があります。utils/recruitmentStatus.jsを確認してください。');
  process.exit(1);
} else {
  console.log('\n✅ 全ケースで不変条件を満たしています。');
}
