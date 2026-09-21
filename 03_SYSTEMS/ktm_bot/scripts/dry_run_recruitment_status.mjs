// utils/recruitmentStatus.js の計算結果を、Discordに一切投稿せずに
// 手元で目視確認するためのドライランスクリプト。
// KTM Botの募集カード色ロジックを変更した際は、実際にDiscordへ投稿して
// 確認する前に、まずこれで全パターンの色・状態が想定通りか確認すること。
//
// 使い方: node scripts/dry_run_recruitment_status.mjs
//
// 2026-09-21修正: 「シルバー/ゴルプラ + 部門またぎ合計10人で混合カスタム可能」という
// 旧モデル（isMixedReadyプロパティ）を前提にしたテストケース・自己検証がそのまま
// 残っていたが、現行のrecruitmentStatus.jsは既に「土曜=統合プール／日曜=独立枠」の
// 新モデルに置き換わっており、isMixedReadyは存在しない(常にundefined=falsy)ため、
// 自己検証が実質何も検証しない状態で放置されていた。現行モデルのプロパティ
// (isSatReady/isSunReady/isAllReady/isConfirmed)に合わせて全面的に書き直した。

import { computeRecruitmentStatus, buildStatusBanner, RECRUITMENT_COLORS } from '../src/utils/recruitmentStatus.js';

const COLOR_NAMES = Object.fromEntries(
  Object.entries(RECRUITMENT_COLORS).map(([name, hex]) => [hex, name])
);

const cases = [
  { label: '募集開始直後', sat: 0, sun: 0 },
  { label: '土曜だけ埋まってきている', sat: 5, sun: 0 },
  { label: '両方とも定員直前', sat: 9, sun: 9 },
  { label: '土曜のみ定員到達(開催確定)', sat: 10, sun: 3 },
  { label: '日曜のみ定員到達(開催確定)', sat: 2, sun: 10 },
  { label: '土日ともに定員到達(満員御礼)', sat: 10, sun: 10 },
  { label: '異常値: 定員超過(離脱漏れ等の想定外データ)', sat: 12, sun: 0 },
];

let hasFailure = false;

console.log('sat | sun | color              | isSatReady | isSunReady | isAllReady | isConfirmed | banner見出し');
console.log('----|-----|--------------------|------------|------------|------------|-------------|-------------');

for (const c of cases) {
  const status = computeRecruitmentStatus(c.sat, c.sun);
  const banner = buildStatusBanner(status);
  const bannerHeader = banner.split('\n')[0];
  const colorName = COLOR_NAMES[status.color] || `不明(0x${status.color.toString(16)})`;

  // 期待される不変条件を自己検証する。
  if (status.isAllReady !== (status.isSatReady && status.isSunReady)) {
    console.error(`❌ [${c.label}] isAllReadyがisSatReady&&isSunReadyと一致しません`);
    hasFailure = true;
  }
  if (status.isConfirmed !== (status.isSatReady || status.isSunReady)) {
    console.error(`❌ [${c.label}] isConfirmedがisSatReady||isSunReadyと一致しません`);
    hasFailure = true;
  }
  if (status.totalJoined !== c.sat + c.sun) {
    console.error(`❌ [${c.label}] totalJoinedの計算が不正です`);
    hasFailure = true;
  }
  if (status.satRem < 0 || status.sunRem < 0) {
    console.error(`❌ [${c.label}] 残数がマイナスになっています(satRem=${status.satRem}, sunRem=${status.sunRem})`);
    hasFailure = true;
  }
  // 色とステータスの整合性チェック(過去に「開催確定→満員御礼」遷移時のバナー文言固着バグが
  // あったため、色だけでなく実際に生成されるバナー見出しの内容も突き合わせる)
  const expectedColor = status.isAllReady
    ? RECRUITMENT_COLORS.confirmed
    : status.isConfirmed
      ? RECRUITMENT_COLORS.partialConfirmed
      : RECRUITMENT_COLORS.recruiting;
  if (status.color !== expectedColor) {
    console.error(`❌ [${c.label}] colorが状態と一致しません(実際=0x${status.color.toString(16)}, 期待=0x${expectedColor.toString(16)})`);
    hasFailure = true;
  }
  if (status.isAllReady && !bannerHeader.includes('満員御礼')) {
    console.error(`❌ [${c.label}] isAllReady=trueなのにバナー見出しに「満員御礼」が含まれていません: ${bannerHeader}`);
    hasFailure = true;
  } else if (!status.isAllReady && status.isConfirmed && !bannerHeader.includes('開催確定')) {
    console.error(`❌ [${c.label}] isConfirmed=trueなのにバナー見出しに「開催確定」が含まれていません: ${bannerHeader}`);
    hasFailure = true;
  }

  console.log(
    `${String(c.sat).padStart(3)} | ${String(c.sun).padStart(3)} | ${colorName.padEnd(18)} | ${String(status.isSatReady).padEnd(10)} | ${String(status.isSunReady).padEnd(10)} | ${String(status.isAllReady).padEnd(10)} | ${String(status.isConfirmed).padEnd(11)} | ${bannerHeader} 【${c.label}】`
  );
}

if (hasFailure) {
  console.error('\n❌ 不変条件違反があります。utils/recruitmentStatus.jsを確認してください。');
  process.exit(1);
} else {
  console.log('\n✅ 全ケースで不変条件を満たしています。');
}
