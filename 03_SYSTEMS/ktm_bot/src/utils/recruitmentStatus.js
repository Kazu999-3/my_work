// 定期カスタム募集カードの状態（色・バナー文言・最多ランク帯）を一元計算する純粋関数。
//
// ★ 2026-09-23: 募集カードを「土曜カード」「日曜カード」の2枚へ完全分離したのに伴い、
//   本モジュールを「1枚 = 1日分」を前提とした単日モデルへ作り直した。
//   旧モデル（土日の人数を同時に受け取り1枚のカードへ合成する）は、
//   ①1枚のカードに意味の違う人数が同居して誤読される
//   ②関数側からは土日どちらのカードを更新しているのか判別できない
//   という2点で、分離後は成立しない。
//
// ★ 併せて、バナーを正規表現で部分置換する仕組み（旧 BANNER_PATTERN）を廃止した。
//   「置換パターンの許容文言」と「実際に生成される見出し」の同期漏れによるバナー固着バグが
//   2026-08〜2026-09で2回発生している。description を毎回まるごと組み直す方式にすれば、
//   その再発経路自体が無くなる。差し替えが必要な箇所では replaceBanner() を使うこと。

export const RECRUITMENT_COLORS = {
  recruiting: 0xc89b3c,      // 琥珀色: 定員未達、募集中
  confirmed: 0x2ecc71,       // 緑: 10名達成、開催確定
};

export const DAY_CAPACITY = 10;

// 土曜=本戦カスタム / 日曜=お祭りカスタム の呼称・絵文字・ルール文言をここへ集約する。
// 過去に「日曜・お祭り部門」と「日曜・お祭りカスタム」の呼称ゆれが発生しているため、
// 表示に使う文字列は必ずここから引くこと。
export const DAY_DEFS = {
  sat: {
    key: 'sat',
    emoji: '⚔️',
    label: '土曜',
    name: '土曜・本戦カスタム',
    shortName: '土曜本戦カスタム',
    rule: 'ランク差を作らない実力伯仲マッチ。最多ランク帯から1ティア差以内を基準に10名を選出し、実力が均等になるよう自動でチーム分けします（MMR変動あり）',
    joinPrefix: 'join_periodic_auto',
    showRank: true,   // 参加者行にランク表記を出すか（日曜はランク不問なので出さない）
    buttonStyle: 1,   // Primary (Blue)
  },
  sun: {
    key: 'sun',
    emoji: '🎪',
    label: '日曜',
    name: '日曜・お祭りカスタム',
    shortName: '日曜お祭りカスタム',
    rule: 'ランク不問・MMR変動なし。特殊ルール/ランダム/オフメタ等なんでも歓迎です',
    joinPrefix: 'join_periodic_sunday',
    showRank: false,
    buttonStyle: 3,   // Success (Green)
  },
};

export function getDayDef(dayKey) {
  return DAY_DEFS[dayKey] || DAY_DEFS.sat;
}

/**
 * Embedのタイトルやボタンのcustom_idから、そのカードがどちらの日のものかを判定する。
 * ★ カードを2枚に分けた以上、「定期カスタムという名前のメッセージ」を一括で同期しては
 *   いけない（土曜カードの内容が日曜カードを上書きする事故になる）。同期対象の絞り込みには
 *   必ずこの関数を通すこと。
 */
export function detectDayKey(text) {
  if (!text) return null;
  if (text.includes('join_periodic_sunday') || text.includes('日曜') || text.includes('お祭り')) return 'sun';
  if (text.includes('join_periodic_auto') || text.includes('土曜') || text.includes('本戦')) return 'sat';
  return null;
}

export function renderProgressBar(current, max = DAY_CAPACITY) {
  const totalBlocks = 10;
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((current / max) * totalBlocks)));
  const empty = totalBlocks - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}] ${current}/${max}名`;
}

/**
 * 参加者行から参加形態（フル、1戦のみ、途中参加）と各試合の実働人数を集計する。
 */
export function parseEntryBreakdown(lines) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- '));
  const full = [];
  const single = [];
  const late = [];

  for (const line of entries) {
    if (line.includes('1戦のみ')) {
      single.push(line);
    } else if (line.includes('途中参加')) {
      late.push(line);
    } else {
      full.push(line);
    }
  }

  const match1Count = full.length + single.length;
  const match2Count = full.length + late.length;

  return {
    total: entries.length,
    full,
    single,
    late,
    hasBreakdown: single.length > 0 || late.length > 0,
    match1Count,
    match2Count,
    match1Remaining: Math.max(0, DAY_CAPACITY - match1Count),
    match2Remaining: Math.max(0, DAY_CAPACITY - match2Count),
    isMatch1Ready: match1Count >= DAY_CAPACITY,
    isMatch2Ready: match2Count >= DAY_CAPACITY,
  };
}

/**
 * 1日分（カード1枚分）の募集状態を計算する。
 * 配列が渡された場合は参加形態（1戦のみ・途中参加）を加味して試合別の人数を計算する。
 * @param {number|string[]} countOrLines その日の参加人数または参加者行配列
 * @param {number} [capacity] 定員（既定10）
 */
export function computeDayStatus(countOrLines, capacity = DAY_CAPACITY) {
  if (Array.isArray(countOrLines)) {
    const breakdown = parseEntryBreakdown(countOrLines);
    const joined = breakdown.total;
    const remaining = Math.max(0, capacity - joined);
    const isReady = breakdown.isMatch1Ready || (breakdown.match1Count === 0 && breakdown.isMatch2Ready);

    return {
      joined,
      capacity,
      remaining,
      isReady,
      color: (breakdown.isMatch1Ready || breakdown.isMatch2Ready) ? RECRUITMENT_COLORS.confirmed : RECRUITMENT_COLORS.recruiting,
      breakdown,
    };
  }

  const joined = Math.max(0, Number(countOrLines) || 0);
  const remaining = Math.max(0, capacity - joined);
  const isReady = joined >= capacity;

  return {
    joined,
    capacity,
    remaining,
    isReady,
    color: isReady ? RECRUITMENT_COLORS.confirmed : RECRUITMENT_COLORS.recruiting,
    breakdown: null,
  };
}

/**
 * カードの description 先頭に置くステータスバナー。
 * 1戦のみ・途中参加者がいる場合は各試合の実働人数を明記する。
 */
export function buildDayBanner(dayKey, status, dominantTierText = '') {
  const def = getDayDef(dayKey);
  const bar = renderProgressBar(status.joined, status.capacity);
  const b = status.breakdown;

  // 1戦のみや途中参加者が含まれる場合: 各試合の実働人数を明記
  if (b && b.hasBreakdown) {
    let header;
    if (b.isMatch1Ready && b.isMatch2Ready) {
      header = `✅ **【${def.name}　全戦 開催確定！】**`;
    } else if (b.isMatch1Ready) {
      header = `✅ **【${def.name}　第1戦 開催確定！】**`;
    } else if (b.isMatch2Ready) {
      header = `✅ **【${def.name}　第2戦 開催確定！】**`;
    } else {
      header = `🔥 **【${def.name}　募集中】**`;
    }

    const tierNote = dominantTierText ? `（基準: **${dominantTierText}** / 1ティア差選出）` : '';
    const m1State = b.isMatch1Ready ? '🎉 **開催確定！**' : `あと**${b.match1Remaining}名**`;
    const m2State = b.isMatch2Ready ? '🎉 **開催確定！**' : `あと**${b.match2Remaining}名**`;

    return [
      header,
      `\`${bar}\` 計**${b.total}名**エントリー${tierNote}`,
      `・第1戦（開幕 21:00〜）: **${b.match1Count}/${status.capacity}名** → ${m1State}`,
      `・第2戦（途中合流〜）: **${b.match2Count}/${status.capacity}名** → ${m2State}`,
    ].join('\n');
  }

  // 全員フルの場合（従来のスッキリ表示）
  const header = status.isReady
    ? `✅ **【${def.name}　開催確定！】**`
    : `🔥 **【${def.name}　募集中】**`;
  const state = status.isReady
    ? `**${status.joined}名**集まりました！`
    : `**あと${status.remaining}名**で開催確定`;

  const tierNote = dominantTierText ? `（基準: **${dominantTierText}** / 1ティア差選出）` : '';

  return `${header}\n\`${bar}\` → ${state}${tierNote}`;
}

/**
 * description は「バナー ＋ 空行 ＋ 補足」という構成で統一している。
 * その先頭ブロック（バナー）だけを最新状態へ差し替える。
 * 空行区切りでの分割なので、絵文字や見出し文言の揺れに影響されない。
 */
export function replaceBanner(description, banner) {
  if (!description) return banner;
  const parts = description.split('\n\n');
  parts[0] = banner;
  return parts.join('\n\n');
}

const RANK_JP_MAP = {
  CHALLENGER: 'チャレンジャー', GRANDMASTER: 'グランドマスター', MASTER: 'マスター',
  DIAMOND: 'ダイヤ', EMERALD: 'エメラルド', PLATINUM: 'プラチナ',
  GOLD: 'ゴールド', SILVER: 'シルバー', BRONZE: 'ブロンズ', IRON: 'アイアン',
  UNRANKED: '未ランク',
};

const RANK_LINE_PATTERN = /【(アイアン|ブロンズ|シルバー|ゴールド|プラチナ|エメラルド|ダイヤ|マスター|チャレンジャー|グランドマスター|未ランク|IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND|MASTER|GRANDMASTER|CHALLENGER|UNRANKED)/i;

/**
 * 参加者行から最多ランク帯（ボリュームゾーン）を集計する。
 * ルール: エメラルド以上はプラチナへ合算 / アイアン・未ランクはブロンズへ合算。
 *
 * ★ 以前は集計結果をフィールド名へ「🎯 基準: 〜」として書き込み、次回の更新時に
 *   正規表現で読み戻していた。書式を変えるたびに読み戻し側とズレる（実際に
 *   「(※MMR基準)」まで拾ってバナーに二重表示される不具合が出た）ため、
 *   参加者行から毎回その場で計算する方式に変更した。
 * @returns {string} 例: 'シルバー帯(3名)'。参加者0名なら空文字。
 */
export function computeDominantTier(lines) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- '));
  if (entries.length === 0) return '';

  const tierCounts = {};
  for (const line of entries) {
    const match = line.match(RANK_LINE_PATTERN);
    const raw = match ? match[1].toUpperCase() : 'SILVER';
    let jp = RANK_JP_MAP[raw] || match?.[1] || 'シルバー';

    if (['チャレンジャー', 'グランドマスター', 'マスター', 'ダイヤ', 'エメラルド', 'プラチナ'].includes(jp)) {
      jp = 'プラチナ';
    } else if (['アイアン', '未ランク', 'ブロンズ'].includes(jp)) {
      jp = 'ブロンズ';
    }
    tierCounts[jp] = (tierCounts[jp] || 0) + 1;
  }

  let best = '';
  let maxCount = 0;
  for (const [tier, count] of Object.entries(tierCounts)) {
    if (count > maxCount) {
      maxCount = count;
      best = `${tier}帯(${count}名)`;
    }
  }
  return best;
}

/** 埋め込みの参加者フィールドから参加者行だけを取り出す */
export function extractEntryLines(fieldValue) {
  return (fieldValue || '').split('\n').filter((l) => l.startsWith('- '));
}

/**
 * 直近の「土曜21:00 JST」「日曜21:00 JST」を解決する。
 * 20:00開催判定や中間アナウンスからも同じ基準で参照するため、必ずこの関数を通すこと。
 */
export function resolveWeekendTargets(now = new Date()) {
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const currentDay = jstNow.getUTCDay(); // 0(日)〜6(土)

  // ★ 日曜は「前日の土曜」とペアで1つの週末として扱う。
  //   (6 - currentDay + 7) % 7 だけで計算すると、日曜には6日後の土曜＝翌週末を指してしまい、
  //   日曜20:00の開催判定や日曜17:00のリマインドが「今日」ではなく「来週の日曜」の
  //   カードを探しに行って必ず空振りする。
  let diffToSaturday;
  if (currentDay === 0) {
    diffToSaturday = jstNow.getUTCHours() >= 21 ? 6 : -1;
  } else {
    diffToSaturday = (6 - currentDay + 7) % 7;
    if (diffToSaturday === 0 && jstNow.getUTCHours() >= 21) {
      diffToSaturday = 7; // すでに土曜21時を過ぎている場合は翌週
    }
  }

  return [
    buildWeekendTarget('sat', jstNow, diffToSaturday),
    buildWeekendTarget('sun', jstNow, diffToSaturday + 1),
  ];
}

const JST_DAY_CHARS = ['日', '月', '火', '水', '木', '金', '土'];

function buildWeekendTarget(dayKey, jstNow, diffDays) {
  // 21:00 JST = 12:00 UTC。Date.UTC は日付の桁あふれ（月またぎ）を自動で正規化する。
  const startUtcMs = Date.UTC(
    jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + diffDays, 12, 0, 0, 0
  );
  const jst = new Date(startUtcMs + 9 * 3600 * 1000);

  return {
    dayKey,
    def: getDayDef(dayKey),
    startAtIso: new Date(startUtcMs).toISOString(),
    label: `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}(${JST_DAY_CHARS[jst.getUTCDay()]})`,
  };
}

/**
 * 募集カードのメッセージ本文（チャット部分）を組み立てる。
 * Embedのスリム化に伴い、進行スケジュール・参加ボタン凡例・名簿バッジの意味を固定で案内する。
 *
 * @param {object} target resolveWeekendTargets() の返り値要素
 * @param {string|number} [notificationRoleId] メンション対象のロールID
 */
export function buildRecruitmentContent(target, notificationRoleId) {
  const { def, label } = target;
  const mention = notificationRoleId ? `<@&${notificationRoleId}>` : '';

  if (target.dayKey === 'sat') {
    return `📢 **【${def.shortName}募集】${label} 21:00〜** ${mention}

⚔️ **【土曜は実力伯仲の真剣勝負！ランク差を作らない徹底方針】**
一方的な試合を防ぎ、全員が全力で楽しめるよう**「1ティア差以内（1ランク差）」**のメンバーでチームを編成します！

**【⚖️ ランクと部屋分けのルール】**
・**20人集まったら2部屋に完全分割**: 「上位部屋（プラチナ以上）」と「初中級部屋（シルバー・ゴールド等）」に分かれて同時にやるので、全ランク帯の人が同レベル同士で白熱できます！
・**1部屋（10〜19人）のとき**: 一番人数の多い最多ランク帯から「1ティア差以内（例：プラチナ基準ならゴールド〜プラチナ）」で10名を選出します
・**2ティア以上離れた場合**: 実力差対戦を避けるため、外れ値の方は「観戦枠・配信応援」または「2戦目に交代」となります
・**低ランクの方も安心**: アイアンや未ランクはブロンズとして合算します。低ランクの人が集まれば最多帯がシルバー等に変わり、初中級中心の部屋になります
（※ランク不問で誰でも気楽にワイワイ遊べるのは日曜の「お祭りカスタム」です🎪）

**【🕒 当日の全体の流れ】**
・21:00〜 **カスタムマッチ 3戦程度**（実力五分五分のチーム分け）
・24時前後〜 **締めのメイヘムカスタム！**（最後はお祭り・特殊ルールでワイワイ遊んで解散✨ ※自由参加）

**【🔘 参加ボタンについて】**
・🟢 **フル参加**: 21:00〜 本戦終了まで通しで出られる人（※メイヘム除く）
・⏱️ **1戦のみ**: 最初の1試合だけサクッと出たい人（お試し大歓迎！）
・🌙 **途中参加**: 2戦目以降やメイヘムから合流したい人

**【🏷️ 名簿バッジについて】**
・🔰**初参加**: カスタム初参戦の人（大歓迎！）
・🌱**ライト**: 通算1〜4戦の軽め参加の人
・⏳**復帰勢**: 1ヶ月以上ぶりの久しぶりの人
・👑**常連**: よく参加している人`.trim();
  }

  return `📢 **【${def.shortName}募集】${label} 21:00〜** ${mention}

🎪 **特殊ルールや普段使わないキャラで遊ぶお祭りカスタム！**

**【🎉 日曜のあそび方】**
・**特殊ルール・オフメタなんでも歓迎**: ARAMカスタム、ランダムピック、普段やらないロールなど自由に遊べる日です✨
・レート変動なしで気楽に楽しめます

**【🕒 当日の全体の流れ】**
・21:00〜 **お祭りカスタム 3戦程度**（特殊ルールや自由ピック）
・24時前後〜 **締めのメイヘムカスタム！**（ワイワイ遊んで解散✨ ※自由参加）

**【🔘 参加ボタンについて】**
・🟢 **フル参加**: 21:00〜 本戦終了まで通しで出られる人（※メイヘム除く）
・⏱️ **1戦のみ**: 最初の1試合だけサクッと出たい人
・🌙 **途中参加**: 2戦目以降やメイヘムから合流したい人

**【🏷️ 名簿バッジについて】**
・🔰**初参加**: カスタム初参戦の人（大歓迎！）
・🌱**ライト**: 通算1〜4戦の軽め参加の人
・⏳**復帰勢**: 1ヶ月以上ぶりの久しぶりの人
・👑**常連**: よく参加している人`.trim();
}
