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
//
// ★ 行数の制約(2026-09-21): このバナーは components.js の BANNER_PATTERN
//   (`**【...】**` の見出し + 後続1〜5行) で丸ごと置換される。後続行を6行以上にすると
//   置換しきれず古い行が残るため、見出しを除いて最大5行に収めること。
//   また見出しの文言を変える場合は BANNER_PATTERN の許容一覧にも必ず追加すること
//   (同期漏れで「状態が変わっても本文が更新されない」固着バグが過去2回発生している)。
export function buildStatusBanner(status, dominantTierText = '') {
  const satBar = renderProgressBar(status.saturdayCount, 10);
  const sunBar = renderProgressBar(status.sundayCount || 0, 10);

  // ★ 「合計X/20名」という のべ人数 は出さない(2026-09-21)。土曜と日曜は各10名で
  //   独立に成立判定される別々の募集であり、合算値を最上段に出すと
  //   ①「20名集めないと開催できない」と誤読される
  //   ②土日両方にエントリーした人が二重カウントされ実人数と合わない
  //   ③「合計10/20名」なのに土日ともに未成立、という矛盾した見え方になる
  //   という3つの誤解を生んでいたため、各日の進捗だけを見せる構成に変更した。
  let header = `🔥 **【週末定期カスタム募集中】**`;
  if (status.isAllReady) {
    header = `🎉 **【土日ともに10名達成！満員御礼】**`;
  } else if (status.isConfirmed) {
    header = `⚡ **【開催確定日あり！週末定期カスタム】**`;
  }

  // dominantTierTextは components.js 側で「シルバー帯(3名)」のように既に「帯」を含む形で
  // 組み立てられるため、ここで「帯」を付け足さないこと(「シルバー帯(3名)帯」になる)。
  const dominantNote = dominantTierText ? `（チーム分け基準: **${dominantTierText}**）` : '';
  const satState = status.isSatReady ? '**✅ 開催確定！**' : `**あと${status.satRem}名**で開催確定`;
  const sunState = status.isSunReady ? '**✅ 開催確定！**' : `**あと${status.sunRem}名**で開催確定`;

  return [
    header,
    `⚔️ **土曜・本戦カスタム**　\`${satBar}\` → ${satState}${dominantNote}`,
    `🎪 **日曜・お祭りカスタム**　\`${sunBar}\` → ${sunState}`,
    `※土曜と日曜は別々の募集です（片方だけの参加もOK。各日20:00時点で10名未満のその日は中止し、ノーマル/ARAM代替募集へ切替）`
  ].join('\n');
}
