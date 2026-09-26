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
    rule: 'ランク差を作らない実力伯仲マッチ。最多ランク帯から1ティア差以内を基準に選出（人数不足時は対面が同レートになるよう低レート枠を編成して試合成立・MMR変動あり）',
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

export const TIER_ORDER = {
  'ブロンズ': 1,
  'シルバー': 2,
  'ゴールド': 3,
  'プラチナ': 4,
};

export const TIER_RANGE_TEXT = {
  'プラチナ': 'ゴールド〜プラチナ',
  'ゴールド': 'シルバー〜プラチナ',
  'シルバー': 'ブロンズ〜ゴールド',
  'ブロンズ': 'アイアン〜シルバー',
};

const RANK_JP_MAP = {
  CHALLENGER: 'チャレンジャー', GRANDMASTER: 'グランドマスター', MASTER: 'マスター',
  DIAMOND: 'ダイヤ', EMERALD: 'エメラルド', PLATINUM: 'プラチナ',
  GOLD: 'ゴールド', SILVER: 'シルバー', BRONZE: 'ブロンズ', IRON: 'アイアン',
  UNRANKED: '未ランク',
};

const RANK_LINE_PATTERN = /【(アイアン|ブロンズ|シルバー|ゴールド|プラチナ|エメラルド|ダイヤ|マスター|チャレンジャー|グランドマスター|未ランク|IRON|BRONZE|SILVER|GOLD|PLATINUM|EMERALD|DIAMOND|MASTER|GRANDMASTER|CHALLENGER|UNRANKED)/i;

/** 行から正規化した4大ランク（ブロンズ・シルバー・ゴールド・プラチナ）を取得 */
export function getNormalizedTier(line) {
  const match = (line || '').match(RANK_LINE_PATTERN);
  const raw = match ? match[1].toUpperCase() : 'SILVER';
  const jp = RANK_JP_MAP[raw] || match?.[1] || 'シルバー';

  if (['チャレンジャー', 'グランドマスター', 'マスター', 'ダイヤ', 'エメラルド', 'プラチナ'].includes(jp)) {
    return 'プラチナ';
  } else if (['アイアン', '未ランク', 'ブロンズ'].includes(jp)) {
    return 'ブロンズ';
  }
  return jp;
}

/**
 * 参加者行をスッキリ整形する：
 * 1. 通常参加である「🟢フル」の表示を除去
 * 2. 経験バッジをアイコンのみ（👑、🔰、🌱、⏳）にスリム化
 * 3. 変則参加（1戦のみ・途中参加）を行頭タグ化して見落としを防止
 */
export function cleanEntryLine(line) {
  let s = (line || '').replace(/\s*🟢\s*フル/g, '');

  // 経験度バッジをアイコンのみに簡素化
  s = s.replace(/👑\s*常連/g, '👑')
       .replace(/🔰\s*初参加/g, '🔰')
       .replace(/🌱\s*ライト/g, '🌱')
       .replace(/⏳\s*復帰勢/g, '⏳')
       .replace(/🎖️\s*経験者/g, '🎖️');

  // 変則参加バッジを識別しやすい行頭タグへ変換
  const hasSingle = s.includes('1戦のみ');
  const hasLate = s.includes('途中参加');

  if (hasSingle) {
    s = s.replace(/\s*⏱️?\s*1戦のみ/g, '');
    s = s.replace(/^- /, '- ⏱️【1戦のみ】');
  } else if (hasLate) {
    s = s.replace(/\s*🌙\s*途中参加(\([^)]*\))?/g, '');
    s = s.replace(/^- /, '- 🌙【2戦目〜】');
  }

  return s;
}

/** 最多ランク帯と対象レンジ情報を計算 */
export function computeDominantTierInfo(lines) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- '));
  if (entries.length === 0) return { key: '', text: '', rangeText: '' };

  const tierCounts = {};
  for (const line of entries) {
    const jp = getNormalizedTier(line);
    tierCounts[jp] = (tierCounts[jp] || 0) + 1;
  }

  let bestKey = '';
  let maxCount = 0;
  for (const [tier, count] of Object.entries(tierCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestKey = tier;
    }
  }

  return {
    key: bestKey,
    text: bestKey ? `${bestKey}帯(${maxCount}名)` : '',
    rangeText: TIER_RANGE_TEXT[bestKey] || '',
  };
}

/** 行から希望レーンを抽出 */
export function extractPlayerLanes(rawLine) {
  const p1 = (rawLine || '').match(/第1:\s*([A-Za-z]+)/)?.[1]?.toUpperCase();
  const p2 = (rawLine || '').match(/第2:\s*([A-Za-z]+)/)?.[1]?.toUpperCase();
  const set = new Set();
  if (p1 && p1 !== '指定なし') set.add(p1);
  if (p2 && p2 !== '指定なし') set.add(p2);
  return set;
}

/** 2人が共通の希望レーンを持っているか（指定なし・おまかせ含む） */
export function hasCommonLane(rawA, rawB) {
  const lanesA = extractPlayerLanes(rawA);
  const lanesB = extractPlayerLanes(rawB);
  if (lanesA.size === 0 || lanesB.size === 0) return true;
  for (const lane of lanesA) {
    if (lanesB.has(lane)) return true;
  }
  return false;
}

/**
 * 参加者行から「1ティア差以内の出場対象枠」と「2ティア差離れた観戦・2部屋目待ち枠」を分離し、
 * 出場対象枠の中だけで各試合の実働人数を集計する。
 * ★ 人数不足時（10名未満）は、特定レーンで同レート同士の対面（ミラー）が組めるペアを出場枠へ昇格。
 */
export function parseEntryBreakdown(lines, dominantTierKey = null) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- '));
  const dominantOrder = dominantTierKey ? TIER_ORDER[dominantTierKey] : null;

  const eligible = [];
  const spectatorCandidates = [];

  for (const rawLine of entries) {
    const cleaned = cleanEntryLine(rawLine);
    if (!dominantOrder) {
      // 日曜などランク不問の場合は全員出場対象
      eligible.push({ raw: rawLine, line: cleaned });
      continue;
    }

    const tier = getNormalizedTier(rawLine);
    const tierOrder = TIER_ORDER[tier] || 2;
    // 最多ランク帯から1ティア差以内なら出場対象、2ティア差以上なら観戦枠候補
    if (Math.abs(tierOrder - dominantOrder) <= 1) {
      eligible.push({ raw: rawLine, line: cleaned, tier });
    } else {
      spectatorCandidates.push({ raw: rawLine, line: cleaned, tier });
    }
  }

  // ★ 人数不足時の対面ミラー救済:
  // 出場対象が定員(10名)に満たない場合、特定レーンで同レート同士の対面（ミラー）が組めるペアを出場枠へ昇格
  let promotedPairsCount = 0;
  const spectator = [];

  if (dominantOrder && eligible.length < DAY_CAPACITY && spectatorCandidates.length >= 2) {
    const promotedIndices = new Set();

    // 試合別（第1戦・第2戦）に、参加可能な候補者同士で同ティア・共通レーンのペアを探索
    function tryPair(candidates, matchFilter) {
      const matchCands = candidates.filter((c) => matchFilter(c.raw));
      for (let i = 0; i < matchCands.length; i++) {
        const c1 = matchCands[i];
        if (promotedIndices.has(c1.idx)) continue;
        if (eligible.length + promotedIndices.size + 2 > DAY_CAPACITY) break;

        for (let j = i + 1; j < matchCands.length; j++) {
          const c2 = matchCands[j];
          if (promotedIndices.has(c2.idx)) continue;

          if (c1.tier === c2.tier && hasCommonLane(c1.raw, c2.raw)) {
            promotedIndices.add(c1.idx);
            promotedIndices.add(c2.idx);
            promotedPairsCount += 1;
            break;
          }
        }
      }
    }

    const indexedCands = spectatorCandidates.map((c, idx) => ({ ...c, idx }));
    // 第1戦（フル or 1戦のみ）の対面ペアを判定
    tryPair(indexedCands, (raw) => !raw.includes('途中参加'));
    // 第2戦（フル or 途中参加）の対面ペアを判定
    tryPair(indexedCands, (raw) => !raw.includes('1戦のみ'));

    for (let i = 0; i < spectatorCandidates.length; i++) {
      const cand = spectatorCandidates[i];
      if (promotedIndices.has(i)) {
        cand.line += ' 🤝対面枠';
        eligible.push(cand);
      } else {
        spectator.push(cand);
      }
    }
  } else {
    spectator.push(...spectatorCandidates);
  }

  // ★ カウントは出場対象枠（eligible: 1ティア差 ＋ 昇格した対面枠）で集計！
  const eligibleFull = eligible.filter((e) => !e.raw.includes('1戦のみ') && !e.raw.includes('途中参加'));
  const eligibleSingle = eligible.filter((e) => e.raw.includes('1戦のみ'));
  const eligibleLate = eligible.filter((e) => e.raw.includes('途中参加'));

  const match1Count = eligibleFull.length + eligibleSingle.length;
  const match2Count = eligibleFull.length + eligibleLate.length;

  // 試合別の行一覧（案1：第1戦出場メンバーと2戦目合流メンバー）
  const match1Lines = eligible
    .filter((e) => !e.raw.includes('途中参加'))
    .map((e) => e.line);
  const match2LateLines = eligible
    .filter((e) => e.raw.includes('途中参加'))
    .map((e) => e.line);

  return {
    total: entries.length,
    eligibleTotal: eligible.length,
    spectatorTotal: spectator.length,
    eligibleLines: eligible.map((e) => e.line),
    spectatorLines: spectator.map((e) => e.line),
    match1Lines,
    match2LateLines,
    dominantTierKey,
    promotedPairsCount,
    hasBreakdown: eligibleSingle.length > 0 || eligibleLate.length > 0 || spectator.length > 0 || promotedPairsCount > 0,
    hasSpectator: spectator.length > 0,
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
 * 配列が渡された場合は参加形態（1戦のみ・途中参加）およびランク制限を加味して計算する。
 */
export function computeDayStatus(countOrLines, capacity = DAY_CAPACITY, dayKey = 'sat') {
  if (Array.isArray(countOrLines)) {
    const dominantTierInfo = (dayKey === 'sat')
      ? computeDominantTierInfo(countOrLines)
      : { key: '', text: '', rangeText: '' };

    const breakdown = parseEntryBreakdown(countOrLines, dominantTierInfo.key);
    // ★ カウント・プログレスバーは出場対象枠（eligibleTotal）を基準にする
    const joined = breakdown.eligibleTotal;
    const remaining = Math.max(0, capacity - joined);
    const isReady = breakdown.isMatch1Ready || (breakdown.match1Count === 0 && breakdown.isMatch2Ready);

    return {
      total: breakdown.total,
      joined,
      capacity,
      remaining,
      isReady,
      color: (breakdown.isMatch1Ready || breakdown.isMatch2Ready) ? RECRUITMENT_COLORS.confirmed : RECRUITMENT_COLORS.recruiting,
      breakdown,
      dominantTierInfo,
    };
  }

  const joined = Math.max(0, Number(countOrLines) || 0);
  const remaining = Math.max(0, capacity - joined);
  const isReady = joined >= capacity;

  return {
    total: joined,
    joined,
    capacity,
    remaining,
    isReady,
    color: isReady ? RECRUITMENT_COLORS.confirmed : RECRUITMENT_COLORS.recruiting,
    breakdown: null,
    dominantTierInfo: { key: '', text: '', rangeText: '' },
  };
}

/**
 * カードの description 先頭に置くステータスバナー。
 */
export function buildDayBanner(dayKey, status, dominantTierText = '') {
  const def = getDayDef(dayKey);
  const bar = renderProgressBar(status.joined, status.capacity);
  const b = status.breakdown;

  if (b && (b.hasBreakdown || b.hasSpectator || dayKey === 'sat')) {
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

    const hasMirror = (b.promotedPairsCount || 0) > 0;
    const mirrorText = hasMirror ? '＋対面枠' : '';
    const rangeNote = status.dominantTierInfo?.rangeText ? ` / 対象: **${status.dominantTierInfo.rangeText}${mirrorText}**` : '';
    const tierNote = dominantTierText ? `（基準: **${dominantTierText}**${rangeNote}）` : '';
    const m1State = b.isMatch1Ready ? '🎉 **開催確定！**' : `あと**${b.match1Remaining}名**`;
    const m2State = b.isMatch2Ready ? '🎉 **開催確定！**' : `あと**${b.match2Remaining}名**`;

    const lines = [
      header,
      `\`${bar}\` 計**${b.total}名**エントリー${tierNote}`,
      `・第1戦（開幕 21:00〜）: **${b.match1Count}/${status.capacity}名** → ${m1State}`,
      `・第2戦（途中合流〜）: **${b.match2Count}/${status.capacity}名** → ${m2State}`,
    ];

    if (b.hasSpectator) {
      lines.push(`（※観戦・2部屋目待ち: **${b.spectatorTotal}名** / 20名到達で初中級部屋が同時開催✨）`);
    }

    return lines.join('\n');
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

export function replaceBanner(description, banner) {
  if (!description) return banner;
  const parts = description.split('\n\n');
  parts[0] = banner;
  return parts.join('\n\n');
}

export function computeDominantTier(lines) {
  return computeDominantTierInfo(lines).text;
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
・**1部屋（10〜19人）のとき**: 最多ランク帯から「1ティア差以内（例：プラチナ基準ならゴールド〜プラチナ）」で10名を選出します
・**人数不足時の対面ミラー救済**: 10人に満たない場合は、特定レーン（SUP同士など）の対面2人が同レート帯であれば、レートが離れていても積極的に試合へ参加してもらいます！（対面の実力が互角になるようバランサーで自動調整）
・**対面が組めない外れ値の場合**: 実力差対戦を避けるため、対面が組めない外れ値の方は「観戦枠・配信応援」または「2戦目に交代」となります
・**低ランクの方も安心**: アイアンや未ランクはブロンズとして合算します。低ランクの人が集まれば最多帯がシルバー等に変わり、初中級中心の部屋になります
（※ランク不問で誰でも気楽にワイワイ遊べるのは日曜の「お祭りカスタム」です🎪）

**【🕒 当日の全体の流れ】**
・21:00〜 **カスタムマッチ 3戦程度**（実力五分五分のチーム分け）
・24時前後〜 **締めのメイヘムカスタム！**（最後はお祭り・特殊ルールでワイワイ遊んで解散✨ ※自由参加）

**【🔘 参加ボタンについて】**
・🟢 **フル参加**: 21:00〜 本戦終了まで通しで出られる人（※メイヘム除く）
・⏱️ **1戦のみ**: 最初の1試合だけサクッと出たい人（お試し大歓迎！）
・🌙 **途中参加**: 2戦目以降やメイヘムから合流したい人

**【🏷️ 名簿アイコンについて】**
・🔰: 初参加の人（大歓迎！）
・🌱: 通算1〜4戦の軽め参加の人
・⏳: 1ヶ月以上ぶりの久しぶりの人
・👑: よく参加している常連さん`.trim();
  }

  return `📢 **【${def.shortName}募集】${label} 21:00〜** ${mention}

🎪 **特殊ルールや普段使わないキャラで遊ぶお祭りカスタム！**

**【🎉 日曜のあそび方】**
・**特殊ルール・オフメタなんでも歓迎**: ARAMカスタム、ランダムピック、普段やらないロールなど自由に遊べる日です✨
・レート変動なし・ランク不問で誰でも気楽に参加できます！
（※当日の流れ・参加ボタン・名簿の見方は土曜の募集カードと同様です）`.trim();
}
