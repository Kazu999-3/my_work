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
    rule: 'ランク差を作らない実力伯仲マッチ。最多MMR帯から1ティア差以内を基準に選出（1つ下と1つ上の両方がいれば下を優先、2ティア以上離れた人は観戦・交代枠。ただし同じ帯・同じレーン希望の2人は🤝対面枠として出場。エメラルド以上はプラチナ、アイアン・未ランクはブロンズと同じ枠。MMR変動あり）',
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

/** 人数表記なしのバーだけ（試合ごとの行で使う） */
export function renderMiniBar(current, max = DAY_CAPACITY) {
  const filled = Math.min(10, Math.max(0, Math.round((current / max) * 10)));
  return `${'■'.repeat(filled)}${'□'.repeat(10 - filled)}`;
}

export function renderProgressBar(current, max = DAY_CAPACITY) {
  const totalBlocks = 10;
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((current / max) * totalBlocks)));
  const empty = totalBlocks - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}] ${current}/${max}名`;
}

export const TIER_ORDER = {
  'アイアン': 0,
  'ブロンズ': 1,
  'シルバー': 2,
  'ゴールド': 3,
  'プラチナ': 4,
  'エメラルド': 5,
};

export const TIER_RANGE_TEXT = {
  'プラチナ': 'ゴールド〜プラチナ・エメ以上',
  'ゴールド': 'シルバー〜プラチナ・エメ以上',
  'シルバー': 'ブロンズ〜ゴールド',
  'ブロンズ': 'アイアン〜シルバー',
};

export const RANK_JP_MAP = {
  CHALLENGER: 'チャレンジャー', GRANDMASTER: 'グランドマスター', MASTER: 'マスター',
  DIAMOND: 'ダイヤ', EMERALD: 'エメラルド', PLATINUM: 'プラチナ',
  GOLD: 'ゴールド', SILVER: 'シルバー', BRONZE: 'ブロンズ', IRON: 'アイアン',
  UNRANKED: '未ランク',
};

export const RANK_SHORT_JP_MAP = {
  CHALLENGER: 'チャレ', GRANDMASTER: 'グラマス', MASTER: 'マス',
  DIAMOND: 'ダイヤ', EMERALD: 'エメ', PLATINUM: 'プラ',
  GOLD: 'ゴル', SILVER: 'シル', BRONZE: 'ブロ', IRON: 'アイ',
  UNRANKED: '未',
};

// 正規化先の主要ランク（英語キー → 区分）。ランク語彙はこの表と RANK_JP_MAP / RANK_SHORT_JP_MAP だけに持つ
// 2026-10-17: エメラルド以上は人数が少ないため、プラチナと同じ枠にまとめる（ユーザー判断）。
// 別枠だと、プラチナ基準の回にエメの人が「1つ上」扱いになり、下の帯がいると観戦・2部屋目待ちへ回されていた。
const TIER_GROUP = {
  CHALLENGER: 'プラチナ', GRANDMASTER: 'プラチナ', MASTER: 'プラチナ', DIAMOND: 'プラチナ', EMERALD: 'プラチナ',
  PLATINUM: 'プラチナ',
  GOLD: 'ゴールド',
  SILVER: 'シルバー',
  // アイアン・未ランクも人数が少ないためブロンズと同じ枠（2026-10-17、ユーザー判断）
  BRONZE: 'ブロンズ', IRON: 'ブロンズ', UNRANKED: 'ブロンズ',
};

// 表記（英語・日本語・短縮）→ 英語キー
const RANK_WORD_TO_KEY = Object.fromEntries(
  Object.keys(TIER_GROUP).flatMap((key) => [[key, key], [RANK_JP_MAP[key], key], [RANK_SHORT_JP_MAP[key], key]])
);

// 長い語を先に並べる（「アイアン」より先に「アイ」が当たらないように）
const RANK_LINE_PATTERN = new RegExp(
  `【(${Object.keys(RANK_WORD_TO_KEY).sort((a, b) => b.length - a.length).join('|')})`,
  'i'
);

/** 行から正規化した4大ランク（ブロンズ・シルバー・ゴールド・プラチナ）を取得 */
export function getNormalizedTier(line) {
  const match = (line || '').match(RANK_LINE_PATTERN);
  if (!match) return 'シルバー';
  const key = RANK_WORD_TO_KEY[match[1]] || RANK_WORD_TO_KEY[match[1].toUpperCase()];
  return TIER_GROUP[key] || 'シルバー';
}

export function isSingleMatch(line) {
  return /1戦のみ/.test(line || '');
}

export function isLateJoin(line) {
  return /途中参加|2戦目/.test(line || '');
}

export function isSpectatorMatch(line) {
  return /観戦/.test(line || '');
}

/**
 * 参加者行をスッキリ整形する：
 * 1. 通常参加である「🟢フル」の表示を除去
 * 2. 経験バッジをアイコンのみ（👑、🔰、🌱、⏳）にスリム化
 * 3. ランク表記を短縮（案B: 【プラ】【ゴル】等）
 * 4. レーン希望表記を短縮（第1・第2を撤去して 【TOP/JG】 形式へ）
 * 5. 変則参加（1戦のみ・途中参加・観戦）を行頭タグ化して見落としを防止
 */
export function cleanEntryLine(line) {
  let s = (line || '').replace(/\s*🟢\s*フル/g, '');

  // 経験度バッジをアイコンのみに簡素化
  s = s.replace(/👑\s*常連/g, '👑')
       .replace(/🔰\s*初参加/g, '🔰')
       .replace(/🌱\s*ライト/g, '🌱')
       .replace(/⏳\s*復帰勢/g, '⏳')
       .replace(/🎖️\s*経験者/g, '🎖️');

  // ランク表記を短縮（案B）
  s = s.replace(/【プラチナ】/g, '【プラ】')
       .replace(/【ゴールド】/g, '【ゴル】')
       .replace(/【シルバー】/g, '【シル】')
       .replace(/【ブロンズ】/g, '【ブロ】')
       .replace(/【アイアン】/g, '【アイ】')
       .replace(/【エメラルド】/g, '【エメ】')
       .replace(/【マスター】/g, '【マス】')
       .replace(/【グランドマスター】/g, '【グラマス】')
       .replace(/【チャレンジャー】/g, '【チャレ】')
       .replace(/【未ランク】/g, '【未】');

  // レーン表記の短縮（第1・第2を撤去して 【TOP/JG】 形式へ）
  s = s.replace(/【第1:\s*([^/]+?)\s*\/\s*第2:\s*([^}]+?)】/g, (match, p1, p2) => {
    const r1 = p1.trim();
    const r2 = p2.trim();
    const isNone = (v) => !v || v === '指定なし' || v === 'なし' || v === '-';
    if (!isNone(r1) && !isNone(r2)) {
      return `【${r1}/${r2}】`;
    } else if (!isNone(r1)) {
      return `【${r1}】`;
    } else if (!isNone(r2)) {
      return `【${r2}】`;
    }
    return '';
  });

  // 変則参加バッジを判定（既にタグ化されている場合も含む）
  const hasSingle = isSingleMatch(s);
  const hasLate = isLateJoin(s);
  const hasSpectator = isSpectatorMatch(s);

  // 既存タグの多重付加を防止するため、まずは変則参加タグ・対面枠タグを完全に剥がす
  s = s.replace(/(?:⏱️\s*)?【?1戦のみ】?/g, '')
       .replace(/(?:🌙\s*)?【?2戦目〜?】?/g, '')
       .replace(/\s*🌙\s*途中参加(?:\([^)]*\))?/g, '')
       .replace(/(?:👀\s*)?【?観戦(?:希望)?】?/g, '')
       .replace(/\s*👀\s*観戦(?:希望)?/g, '')
       .replace(/\s*🤝\s*対面枠/g, '')
       .replace(/^- \s*/, '- ')
       .trim();

  if (hasSpectator) {
    s = s.replace(/^- /, '- 👀【観戦】');
  } else if (hasSingle) {
    s = s.replace(/^- /, '- ⏱️【1戦のみ】');
  } else if (hasLate) {
    s = s.replace(/^- /, '- 🌙【2戦目〜】');
  }

  return s;
}

/** 最多ランク帯と対象レンジ情報を計算（観戦希望者は最多帯の判定母数から除外） */
export function computeDominantTierInfo(lines) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- ') && !isSpectatorMatch(l));
  if (entries.length === 0) return { key: '', text: '', rangeText: '' };

  const tierCounts = {};
  for (const line of entries) {
    const jp = getNormalizedTier(line);
    tierCounts[jp] = (tierCounts[jp] || 0) + 1;
  }

  let bestKey = '';
  let maxCount = 0;
  for (const [tier, count] of Object.entries(tierCounts)) {
    const order = TIER_ORDER[tier] ?? 99;
    const bestOrder = bestKey ? (TIER_ORDER[bestKey] ?? 99) : 99;

    if (count > maxCount) {
      maxCount = count;
      bestKey = tier;
    } else if (count === maxCount && order < bestOrder) {
      // ★ 同数の時は下のレート（初中級側）を最優先！
      bestKey = tier;
    }
  }

  return {
    key: bestKey,
    text: bestKey ? `${bestKey}帯(${maxCount}名)` : '',
    rangeText: TIER_RANGE_TEXT[bestKey] || '',
  };
}

const ROLE_SORT_ORDER = {
  TOP: 1,
  JG: 2,
  JUNGLE: 2,
  MID: 3,
  MIDDLE: 3,
  BOT: 4,
  ADC: 4,
  SUP: 5,
  SUPPORT: 5,
};

/** 行から第一希望レーンのソート順を取得（TOP:1, JG:2, MID:3, ADC/BOT:4, SUP:5, おまかせ:6） */
export function getLaneOrder(rawLine) {
  const line = rawLine || '';
  // 新形式 【TOP/JG】 または 【TOP】
  const shortMatch = line.match(/【([A-Za-z]+)(?:\/([A-Za-z]+))?】/);
  if (shortMatch) {
    const r1 = shortMatch[1]?.toUpperCase();
    if (ROLE_SORT_ORDER[r1]) return ROLE_SORT_ORDER[r1];
  }
  // 旧形式 【第1: TOP ...】
  const p1 = line.match(/第1:\s*([A-Za-z]+)/)?.[1]?.toUpperCase();
  if (p1 && ROLE_SORT_ORDER[p1]) return ROLE_SORT_ORDER[p1];

  return 6; // 未設定、指定なし、おまかせ等は末尾
}

/** 参加者行配列をレーン順（TOP ➔ JG ➔ MID ➔ ADC ➔ SUP ➔ おまかせ）に安定ソート */
export function sortEntryLinesByLane(lines) {
  if (!Array.isArray(lines)) return [];
  return [...lines].sort((a, b) => getLaneOrder(a) - getLaneOrder(b));
}

const LANE_ALIAS = { TOP: 'TOP', JG: 'JG', JUNGLE: 'JG', MID: 'MID', MIDDLE: 'MID', ADC: 'ADC', BOT: 'ADC', SUP: 'SUP', SUPPORT: 'SUP' };

/** 行の希望レーン（【TOP/JG】形式・旧【第1: TOP / 第2: JG】形式）。ALL/FILL/指定なしは空（どのレーンでも可） */
export function extractPlayerLanes(rawLine) {
  const line = rawLine || '';
  const lanes = new Set();
  const add = (v) => { const k = LANE_ALIAS[(v || '').trim().toUpperCase()]; if (k) lanes.add(k); };
  const old = line.match(/第1:\s*([A-Za-z]+)[^】]*?第2:\s*([A-Za-z]+)/);
  if (old) { add(old[1]); add(old[2]); return lanes; }
  for (const m of line.matchAll(/【([A-Za-z]+)(?:\/([A-Za-z]+))?】/g)) { add(m[1]); add(m[2]); }
  return lanes;
}

/** 2人の共通の希望レーン（無ければ null）。片方がALL等なら相手の第1希望、両方ALLなら 'ALL' */
export function commonLane(rawA, rawB) {
  const a = [...extractPlayerLanes(rawA)];
  const b = [...extractPlayerLanes(rawB)];
  if (a.length === 0 && b.length === 0) return 'ALL';
  if (a.length === 0) return b[0];
  if (b.length === 0) return a[0];
  return a.find((l) => b.includes(l)) || null;
}

/** 2人が共通の希望レーンを持っているか（指定なし・おまかせ含む） */
export function hasCommonLane(rawA, rawB) {
  return commonLane(rawA, rawB) !== null;
}

// 参加形態ごとに出る試合（フル=第1・2戦 / 1戦のみ=第1戦 / 途中参加=第2戦）
const STYLE_MATCHES = { full: [1, 2], single: [1], late: [2] };
const styleOf = (raw) => (isSingleMatch(raw) ? 'single' : isLateJoin(raw) ? 'late' : 'full');
const styleFromMatches = (ms) => (ms.length === 2 ? 'full' : ms[0] === 1 ? 'single' : ms[0] === 2 ? 'late' : null);

/**
 * 🤝 対面枠（2026-10-17、ユーザー判断）: 基準の帯から2つ以上離れて観戦・2部屋目待ちになる人でも、
 * 同じ帯で同じレーン希望の2人がいれば、その2人を対面させる前提で出場対象に入れる。
 * （例: プラチナ基準の回のシルバーSUP 2人。対面同士は同じ帯なのでレーン戦の差は出ない）
 * 2人とも出られる試合だけ出場扱いにする（フル＋途中参加なら、2人とも第2戦から）。
 * 自分で観戦を選んだ人は対象外。
 */
function promoteLanePairs(candidates) {
  const promoted = [];
  const rest = [];
  const used = new Set();
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const a = candidates[i];
    let paired = false;
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const b = candidates[j];
      if (a.tier !== b.tier) continue;
      const lane = commonLane(a.raw, b.raw);
      if (!lane) continue;
      const shared = STYLE_MATCHES[styleOf(a.raw)].filter((m) => STYLE_MATCHES[styleOf(b.raw)].includes(m));
      const effStyle = styleFromMatches(shared);
      if (!effStyle) continue;
      used.add(i); used.add(j);
      const tag = `（🤝${lane}対面枠）`;
      promoted.push({ ...a, line: `${a.line}${tag}`, effStyle, pair: true }, { ...b, line: `${b.line}${tag}`, effStyle, pair: true });
      paired = true;
      break;
    }
    if (!paired) rest.push(a);
  }
  return { promoted, rest };
}

/**
 * 参加者行から「出場対象枠」と「観戦・2部屋目待ち枠」を分離し、
 * 出場対象枠の中だけで各試合の実働人数を集計する。
 * 人数に関わらず、最多MMR帯および初中級最優先ポリシー（同数時は下のレート優先）に基づき、
 * 2ランク格差が出ないよう公平に分離する。
 */
export function parseEntryBreakdown(lines, dominantTierKey = null) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- '));
  const dominantOrder = dominantTierKey ? TIER_ORDER[dominantTierKey] : null;

  const eligible = [];
  const spectator = [];
  let promotedPairsCount = 0;

  // ① ランク不問（日曜など）の場合: 観戦希望者以外を出場対象枠へ
  if (!dominantOrder) {
    for (const rawLine of entries) {
      if (isSpectatorMatch(rawLine)) {
        spectator.push({ raw: rawLine, line: cleanEntryLine(rawLine) });
      } else {
        eligible.push({ raw: rawLine, line: cleanEntryLine(rawLine) });
      }
    }
  } else {
    // ② ランク制限あり（土曜など）: 最多層ルールに基づき出場対象・観戦枠を分離
    const tierEntries = {
      same: [],    // dominantOrder と同ティア（最多帯）
      lower: [],   // dominantOrder - 1 (1ランク下、例: シルバー)
      higher: [],  // dominantOrder + 1 (1ランク上、例: プラチナ)
      outlier: [], // 2ランク差以上離れた外れ値
    };

    for (const rawLine of entries) {
      const cleaned = cleanEntryLine(rawLine);
      if (isSpectatorMatch(rawLine)) {
        spectator.push({ raw: rawLine, line: cleaned });
        continue;
      }

      const tier = getNormalizedTier(rawLine);
      const tierOrder = TIER_ORDER[tier] || 2;
      const diff = tierOrder - dominantOrder;

      if (diff === 0) {
        tierEntries.same.push({ raw: rawLine, line: cleaned, tier });
      } else if (diff === -1) {
        tierEntries.lower.push({ raw: rawLine, line: cleaned, tier });
      } else if (diff === 1) {
        tierEntries.higher.push({ raw: rawLine, line: cleaned, tier });
      } else {
        tierEntries.outlier.push({ raw: rawLine, line: cleaned, tier });
      }
    }

    // 初中級最優先ポリシー:
    // 下位側（lower: 初中級）がいれば下位側を最優先採用（同数の場合も下のレート優先）
    // 下位側が0名の場合のみ上位側（higher）を採用
    let acceptedAdjacent = [];
    let rejectedAdjacent = [];

    if (tierEntries.lower.length > 0) {
      acceptedAdjacent = tierEntries.lower;
      rejectedAdjacent = tierEntries.higher;
    } else if (tierEntries.higher.length > 0) {
      acceptedAdjacent = tierEntries.higher;
    }

    eligible.push(...tierEntries.same, ...acceptedAdjacent);
    // 離れた帯の人のうち、同じ帯・同じレーン希望の2人は対面枠として出場対象へ
    const { promoted, rest } = promoteLanePairs([...tierEntries.outlier, ...rejectedAdjacent]);
    eligible.push(...promoted);
    spectator.push(...rest);
    promotedPairsCount = promoted.length / 2;
  }

  // カウントは出場対象枠（eligible）で集計。対面枠は「2人とも出られる試合」の形態（effStyle）で数える
  const eff = (e) => e.effStyle || styleOf(e.raw);
  const eligibleFull = eligible.filter((e) => eff(e) === 'full');
  const eligibleSingle = eligible.filter((e) => eff(e) === 'single');
  const eligibleLate = eligible.filter((e) => eff(e) === 'late');

  const match1Count = eligibleFull.length + eligibleSingle.length;
  const match2Count = eligibleFull.length + eligibleLate.length;

  // 試合別の行一覧（第1戦出場メンバーと2戦目合流メンバー）をレーン順にソート
  const match1Lines = sortEntryLinesByLane(
    eligible
      .filter((e) => eff(e) !== 'late')
      .map((e) => e.line)
  );
  const match2LateLines = sortEntryLinesByLane(
    eligible
      .filter((e) => eff(e) === 'late')
      .map((e) => e.line)
  );

  return {
    total: entries.length,
    eligibleTotal: eligible.length,
    spectatorTotal: spectator.length,
    eligibleLines: sortEntryLinesByLane(eligible.map((e) => e.line)),
    spectatorLines: sortEntryLinesByLane(spectator.map((e) => e.line)),
    match1Lines,
    match2LateLines,
    dominantTierKey,
    promotedPairsCount,
    hasBreakdown: eligibleSingle.length > 0 || eligibleLate.length > 0 || spectator.length > 0,
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
  const b = status.breakdown;
  const dominantName = status.dominantTierInfo?.key || dominantTierText.replace(/帯.*$/, '');
  const tierLabel = dominantName ? `（${dominantName}基準）` : '';

  if (b && (b.hasBreakdown || b.hasSpectator || dayKey === 'sat')) {
    let header;
    if (b.isMatch1Ready && b.isMatch2Ready) {
      header = `✅ **全戦 開催確定！**${tierLabel}`;
    } else if (b.isMatch1Ready) {
      header = `✅ **第1戦 開催確定！**${tierLabel}`;
    } else if (b.isMatch2Ready) {
      header = `✅ **第2戦 開催確定！**${tierLabel}`;
    } else {
      header = `🔥 **募集中${tierLabel}**`;
    }

    // 2026-10-17: 1行に「バー・第1戦・第2戦」を詰め、さらに観戦人数の行もあって読みにくかったため、
    // 試合ごとに1行へ分けた。観戦・2部屋目待ちの人数は参加者一覧の見出しに出るので、ここでは繰り返さない。
    const matchLine = (label, count, ready, remaining) =>
      `${label} \`${renderMiniBar(count, status.capacity)}\` ${count}/${status.capacity}名 → ${ready ? '**開催確定！**' : `あと${remaining}名`}`;

    return [
      header,
      matchLine('第1戦', b.match1Count, b.isMatch1Ready, b.match1Remaining),
      matchLine('第2戦', b.match2Count, b.isMatch2Ready, b.match2Remaining),
    ].join('\n');
  }

  // 全員フルの場合（シンプル表示）
  const header = status.isReady
    ? `✅ **開催確定！**${tierLabel}`
    : `🔥 **募集中${tierLabel}**`;
  const bar = renderProgressBar(status.joined, status.capacity);
  const state = status.isReady
    ? `21:00よりスタート！`
    : `あと${status.remaining}名で開催確定`;

  return `${header}\n\`${bar}\` ${state}`;
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

/**
 * 埋め込みの参加者フィールドから参加者行だけを取り出す。
 *
 * ⚠️ カードの表示テキストがそのまま参加データを兼ねている（押下のたびにここで読み戻して組み直す）。
 * 2026-10-17 に表示を整理し、「🌙 2戦目から合流」見出しの下の行から 🌙【2戦目〜】 を、
 * 観戦を選んだ人の行頭の 👀【観戦】 を消して行末の（観戦希望）にした。読み戻す時はここで元のタグに戻す。
 * 戻さないと、次の押下で途中参加の人がフル参加扱いになり、観戦希望の行には「（）」が溜まっていく。
 */
export function extractEntryLines(fieldValue) {
  let inLateSection = false;
  const out = [];
  for (const raw of (fieldValue || '').split('\n')) {
    if (!raw.startsWith('- ')) {
      // 見出し行。区分が変わるたびに判定し直す（旧形式「【🌙 2戦目〜合流」も含む）
      if (raw.trim()) inLateSection = /2戦目(?:から|〜)合流/.test(raw);
      continue;
    }
    let line = raw.replace(/（）/g, '');
    // 対面枠の印は毎回計算し直すので捨てる。対面枠の行は見出しの位置が本来の参加形態と違うことがある
    const isPair = /（🤝[^）]*）/.test(line);
    line = line.replace(/（🤝[^）]*）/g, '');
    // 行末の短い表記（観戦枠・対面枠で使う）を行頭のタグに戻す
    const suffixTag = /（観戦希望）/.test(line) ? '- 👀【観戦】'
      : /（1戦のみ）/.test(line) ? '- ⏱️【1戦のみ】'
      : /（2戦目〜）/.test(line) ? '- 🌙【2戦目〜】' : null;
    line = line.replace(/（(?:観戦希望|1戦のみ|2戦目〜)）/g, '');
    if (suffixTag) {
      line = line.replace(/^- (?:👀【観戦】|⏱️【1戦のみ】|🌙【2戦目〜】)?/, suffixTag);
    } else if (inLateSection && !isPair && !isLateJoin(line)) {
      line = line.replace(/^- /, '- 🌙【2戦目〜】');
    }
    out.push(line.trimEnd());
  }
  return out;
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
    const mention = notificationRoleId ? `<@&${notificationRoleId}>` : '';
    return `📢 **【${def.shortName}】${label} 21:00〜** ${mention}
⚔️ **実力伯仲の真剣勝負！** 初心者・低ランク大歓迎（チーム戦力は五分五分に自動調整）
🔰 **初参加枠あり！**: 初めて参加される方は優先的に枠を確保します。遠慮なくご参加ください✨
🕒 **時間**: 21:00〜 3戦程度（24時頃〜自由参加メイヘム）

⚖️ **10人前後（1部屋）のときの参加基準（KTM MMR基準）**:
「シルバー対プラチナ」のような2ランク格差を防ぐため、**実力差が1ランク差以内の10名**を選出して開催します！
・初中級者優先のため、ゴールド最多のときは**【シルバー＋ゴールド】を最優先**（同数の場合も下のレート優先）で部屋を組みます！（※シルバーの方がいないときは【ゴールド＋プラチナ】。2ランク以上離れた方は観戦・交代枠）
・ソロQランクではなく「KTM MMR（独自レート）」で公平に判定されます
※20名集まれば「初中級部屋」「上級部屋」の2部屋同時開催となり、全員が出場できます！

🏷️ **名簿アイコン（土日共通）**: 🔰初参加 ｜ 🌱ライト(1〜14戦) ｜ 👑常連 ｜ 🎖️経験者 ｜ ⏳復帰勢`.trim();
  }

  // 日曜は通知二重鳴り防止のためメンションを省き、被る凡例もカット
  return `📢 **【${def.shortName}】${label} 21:00〜**
🎪 **勝敗気にせず楽しむお祭り！** レート変動なし・ランク不問✨
🔰 **初参加大歓迎！**: 最初のカスタム体験にも最適です。気軽にご参加ください！
🕒 **ルール**: 不慣れなキャラ・レーンの練習や特殊ルール・ARAM等のワイワイ枠
（※名簿アイコンの意味は土曜カードと共通です）`.trim();
}
