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
    rule: 'ランク制限はありません。集まった方の最多ランク帯を基準に、実力が均等になるよう自動でチーム分けします（MMR変動あり）',
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
 * 1日分（カード1枚分）の募集状態を計算する。
 * @param {number} count その日の参加人数
 * @param {number} [capacity] 定員（既定10）
 */
export function computeDayStatus(count, capacity = DAY_CAPACITY) {
  const joined = Math.max(0, Number(count) || 0);
  const remaining = Math.max(0, capacity - joined);
  const isReady = joined >= capacity;

  return {
    joined,
    capacity,
    remaining,
    isReady,
    color: isReady ? RECRUITMENT_COLORS.confirmed : RECRUITMENT_COLORS.recruiting,
  };
}

/**
 * カードの description 先頭に置くステータスバナー（見出し＋1行の計2行固定）。
 * 文字量を減らすため、説明文やボタンの凡例はここへ混ぜないこと。
 */
export function buildDayBanner(dayKey, status, dominantTierText = '') {
  const def = getDayDef(dayKey);
  const bar = renderProgressBar(status.joined, status.capacity);

  const header = status.isReady
    ? `✅ **【${def.name}　開催確定！】**`
    : `🔥 **【${def.name}　募集中】**`;
  const state = status.isReady
    ? `**${status.joined}名**集まりました！`
    : `**あと${status.remaining}名**で開催確定`;

  // dominantTierText は「シルバー帯(3名)」のように既に「帯」を含む形で渡ってくる。
  // ここで「帯」を足さないこと（「シルバー帯(3名)帯」になる）。
  const tierNote = dominantTierText ? `（チーム分け基準: **${dominantTierText}**）` : '';

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

🔰 **「低ランクだけど迷惑かけない？」「強い人ばかりじゃない？」**
➔ **まったく気にせずボタン押してください！**
チームの実力が五分五分になるように自動でチーム分けされるので、初心者や低ランクでも全然大丈夫です。

**【⚖️ ランクと人数のルール】**
・**20人集まったら2部屋に分割**: 「強い人部屋」と「初心者・初中級部屋」に分かれて同時にやるので、同じレベル同士で楽しめます！
・**1部屋のとき**: 一番人数が多いランク帯に合わせて、チームの強さが同じくらいになるよう自動で分けられます
・**低ランクの人が集まるほど安心**: アイアンや未ランクはブロンズとして数えるので、低ランクの人が何人か集まるだけでブロンズ〜シルバー中心の部屋になります（遠慮せず入ってください！）

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
