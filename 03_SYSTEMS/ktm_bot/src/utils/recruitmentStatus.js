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
  recruiting: 0x2980b9,        // 後方互換用（土曜ロイヤルブルー）
  recruitingSat: 0x2980b9,     // 土曜（実力均等）: 鮮やかなロイヤルブルー
  recruitingSun: 0xe67e22,     // 日曜（お祭り枠）: ビビッドオレンジ/ゴールド
  confirmed: 0x2ecc71,         // 緑: 10名達成、開催確定
};

export const DAY_CAPACITY = 10;
export const BAND_BOUNDARY_MMR = 1450;
export const LOBBY_CAPACITY = 10;

export function normalizeTierPromotionPref(value) {
  if (value === 'mix_ok' || value === 'fill_only' || value === 'never') {
    return value;
  }
  return 'fill_only';
}

export function extractDiscordId(line) {
  return (line || '').match(/<@!?([A-Za-z0-9_-]+)>/)?.[1] || null;
}

function getPlayerFromMap(playerMap, discordId) {
  if (!playerMap || !discordId) return null;
  if (typeof playerMap.get === 'function') return playerMap.get(discordId) || null;
  return playerMap[discordId] || null;
}

/** 行またはプレイヤーが上位帯（代表MMR 1450+）か中初級帯（<1450）かを判定 */
export function getLineBand(line, playerMap = null) {
  if (!line) return 'low';
  const discordId = extractDiscordId(line);
  const playerRow = getPlayerFromMap(playerMap, discordId);
  if (playerRow && playerRow.mmr != null && Number.isFinite(Number(playerRow.mmr))) {
    return Number(playerRow.mmr) >= BAND_BOUNDARY_MMR ? 'high' : 'low';
  }
  if (/上位帯/.test(line)) return 'high';
  if (/中初級帯/.test(line)) return 'low';
  const norm = getNormalizedTier(line);
  return norm === 'プラチナ' ? 'high' : 'low';
}

// 土曜=実力均等カスタム / 日曜=お祭りカスタム の呼称・絵文字・ルール文言をここへ集約する。
export const DAY_DEFS = {
  sat: {
    key: 'sat',
    emoji: '⚔️',
    label: '土曜',
    name: '土曜・実力均等カスタム',
    shortName: '土曜・実力均等カスタム',
    rule: 'チーム戦力を推定MMRランクで五分五分に自動調整！中初級帯でも安心して参加できるエンジョイ本戦（推定MMR変動あり）',
    joinPrefix: 'join_periodic_auto',
    showRank: true,   // 参加者行にランク表記を出すか（日曜はランク不問なので出さない）
    buttonStyle: 1,   // Primary (Blue)
  },
  sun: {
    key: 'sun',
    emoji: '🎪',
    label: '日曜',
    name: '日曜・お祭りカスタム（ランク不問）',
    shortName: '日曜・お祭りカスタム',
    rule: '勝敗気にせずワイワイ遊ぶお祭り枠！不慣れなチャンプやレーンの練習、特殊ルール等なんでも歓迎（MMR変動なし）',
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

  // 経験度バッジの簡素化（配慮が必要な初参加🔰・ライト層🌱を残し、常連👑や⏳、🎖️は非表示に）
  s = s.replace(/👑\s*常連|👑/g, '')
       .replace(/⏳\s*復帰勢|⏳/g, '')
       .replace(/🎖️\s*経験者|🎖️/g, '')
       .replace(/🌱\s*ライト/g, '🌱')
       .replace(/🔰\s*初参加/g, '🔰');

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
/**
 * 参加者行から「出場対象枠」と「観戦・2部屋目待ち枠」を分離し、
 * 出場対象枠の中だけで各試合の実働人数を集計する。
 * （2026-10-17以降、全員出場を基本とし、観戦希望者のみを観戦枠へ分離）
 */
/**
 * 1つのロビー（10名定員）の参加者行から第1戦・第2戦の内訳を集計する純粋関数
 */
export function parseLobbyBreakdown(lines, capacity = LOBBY_CAPACITY) {
  const entries = (lines || []).filter((l) => l && l.startsWith('- '));
  const eligible = [];
  const spectator = [];

  for (const rawLine of entries) {
    if (isSpectatorMatch(rawLine)) {
      spectator.push({ raw: rawLine, line: cleanEntryLine(rawLine) });
    } else {
      eligible.push({ raw: rawLine, line: cleanEntryLine(rawLine) });
    }
  }

  const eff = (e) => e.effStyle || styleOf(e.raw);
  const eligibleFull = eligible.filter((e) => eff(e) === 'full');
  const eligibleSingle = eligible.filter((e) => eff(e) === 'single');
  const eligibleLate = eligible.filter((e) => eff(e) === 'late');

  const match1Count = eligibleFull.length + eligibleSingle.length;
  const match2Count = eligibleFull.length + eligibleLate.length;

  const match1Lines = sortEntryLinesByLane(
    eligible.filter((e) => eff(e) !== 'late').map((e) => e.line)
  );
  const match2LateLines = sortEntryLinesByLane(
    eligible.filter((e) => eff(e) === 'late').map((e) => e.line)
  );
  const match2Lines = sortEntryLinesByLane(
    eligible.filter((e) => eff(e) !== 'single').map((e) => e.line)
  );

  const isMatch1Ready = match1Count >= capacity;
  const isMatch2Ready = match2Count >= capacity;
  const isReady = isMatch1Ready || (match1Count === 0 && isMatch2Ready);

  return {
    total: entries.length,
    eligibleTotal: eligible.length,
    spectatorTotal: spectator.length,
    eligibleLines: sortEntryLinesByLane(eligible.map((e) => e.line)),
    spectatorLines: sortEntryLinesByLane(spectator.map((e) => e.line)),
    match1Lines,
    match2LateLines,
    match2Lines,
    hasBreakdown: eligibleSingle.length > 0 || eligibleLate.length > 0 || spectator.length > 0,
    hasSpectator: spectator.length > 0,
    match1Count,
    match2Count,
    match1Remaining: Math.max(0, capacity - match1Count),
    match2Remaining: Math.max(0, capacity - match2Count),
    isMatch1Ready,
    isMatch2Ready,
    isReady,
    remaining: Math.max(0, capacity - eligible.length),
    joined: eligible.length,
    capacity,
  };
}

/**
 * 募集カード全体の参加者行から、上位帯ロビー・中初級帯ロビー・観戦枠を分離して集計する。
 */
export function parseEntryBreakdown(countOrLines, capacity = LOBBY_CAPACITY, options = {}) {
  const playerMap = options?.playerMap || null;
  let highLines = [];
  let lowLines = [];
  let spectatorLines = [];

  if (countOrLines && typeof countOrLines === 'object' && !Array.isArray(countOrLines)) {
    highLines = countOrLines.high || [];
    lowLines = countOrLines.low || [];
    spectatorLines = countOrLines.spectator || [];
  } else if (Array.isArray(countOrLines)) {
    for (const raw of countOrLines) {
      if (isSpectatorMatch(raw)) {
        spectatorLines.push(raw);
      } else if (getLineBand(raw, playerMap) === 'high') {
        highLines.push(raw);
      } else {
        lowLines.push(raw);
      }
    }
  }

  const high = parseLobbyBreakdown(highLines, capacity);
  const low = parseLobbyBreakdown(lowLines, capacity);
  const spectator = {
    total: spectatorLines.length,
    lines: sortEntryLinesByLane(spectatorLines.map(cleanEntryLine)),
  };

  const total = high.total + low.total + spectator.total;
  const eligibleTotal = high.eligibleTotal + low.eligibleTotal;
  const match1Count = high.match1Count + low.match1Count;
  const match2Count = high.match2Count + low.match2Count;
  const isMatch1Ready = high.isMatch1Ready || low.isMatch1Ready;
  const isMatch2Ready = high.isMatch2Ready || low.isMatch2Ready;
  const isReady = high.isReady || low.isReady;
  const isBothReady = high.isReady && low.isReady;

  return {
    high,
    low,
    spectator,
    total,
    eligibleTotal,
    spectatorTotal: spectator.total,
    match1Count,
    match2Count,
    match1Remaining: high.match1Remaining + low.match1Remaining,
    match2Remaining: high.match2Remaining + low.match2Remaining,
    isMatch1Ready,
    isMatch2Ready,
    isReady,
    isBothReady,
    hasBreakdown: high.hasBreakdown || low.hasBreakdown || spectator.total > 0,
    hasSpectator: spectator.total > 0,
    eligibleLines: [...high.eligibleLines, ...low.eligibleLines],
    spectatorLines: spectator.lines,
    match1Lines: [...high.match1Lines, ...low.match1Lines],
    match2LateLines: [...high.match2LateLines, ...low.match2LateLines],
  };
}

/**
 * 土曜（2帯制）における10〜19名時の合同1卓成立・厳格保護評価（案A ＋ 厳格保護②）
 */
export function evaluateCombinedStatus(high, low, capacity = LOBBY_CAPACITY, playerMap = null) {
  const splitForCombined = (highLines, lowLines) => {
    const promotableLow = [];
    const neverLow = [];
    for (const line of lowLines || []) {
      const p = getPlayerFromMap(playerMap, extractDiscordId(line));
      const pref = normalizeTierPromotionPref(p?.tier_promotion_pref);
      if (pref === 'never') {
        neverLow.push(line);
      } else {
        promotableLow.push({
          line,
          pref,
          mmr: p?.mmr != null && Number.isFinite(Number(p.mmr)) ? Number(p.mmr) : 1200,
        });
      }
    }
    promotableLow.sort((a, b) => {
      const pa = a.pref === 'mix_ok' ? 0 : 1;
      const pb = b.pref === 'mix_ok' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.mmr - a.mmr;
    });

    const supportHigh = [];
    const nonSupportHigh = [];
    for (const line of highLines || []) {
      const p = getPlayerFromMap(playerMap, extractDiscordId(line));
      if (p?.allow_lower_support) {
        supportHigh.push({
          line,
          mmr: p?.mmr != null && Number.isFinite(Number(p.mmr)) ? Number(p.mmr) : BAND_BOUNDARY_MMR,
        });
      } else {
        nonSupportHigh.push(line);
      }
    }
    supportHigh.sort((a, b) => a.mmr - b.mmr);

    const highArr = [...(highLines || [])];
    const lowArr = [...(lowLines || [])];
    const upperBaseLines = [...highArr, ...promotableLow.map((x) => x.line)];
    const lowerBaseLines = [...lowArr, ...supportHigh.map((x) => x.line)];

    return {
      highNativeCount: highArr.length,
      lowNativeCount: lowArr.length,
      promotableLowLines: promotableLow.map((x) => x.line),
      neverLowLines: neverLow,
      supportHighLines: supportHigh.map((x) => x.line),
      nonSupportHighLines: nonSupportHigh,
      upperBaseLines,
      lowerBaseLines,
      upperReady: upperBaseLines.length >= capacity,
      lowerReady: lowerBaseLines.length >= capacity,
    };
  };

  const m1 = splitForCombined(high?.match1Lines, low?.match1Lines);
  const m2 = splitForCombined(high?.match2Lines, low?.match2Lines);

  let mode = 'RECRUITING';
  let isReady = false;
  let base = null;
  let selectedLines = [];
  let excludedLines = [];
  let match1ActiveCount = Math.max(m1.upperBaseLines.length, m1.lowerBaseLines.length);
  let match2ActiveCount = Math.max(m2.upperBaseLines.length, m2.lowerBaseLines.length);

  if (high?.isReady && low?.isReady) {
    mode = 'BOTH';
  } else if (high?.isReady) {
    mode = 'HIGH_ONLY';
  } else if (low?.isReady) {
    mode = 'LOW_ONLY';
  } else if (m1.lowerReady && m1.upperReady) {
    // 案A: ネイティブ人数が多い方をベース（同数なら中初級ベース優先）
    if (m1.lowNativeCount >= m1.highNativeCount) {
      mode = 'COMBINED_LOWER';
      base = 'lower';
      selectedLines = m1.lowerBaseLines;
      excludedLines = m1.nonSupportHighLines;
      match1ActiveCount = m1.lowerBaseLines.length;
    } else {
      mode = 'COMBINED_UPPER';
      base = 'upper';
      selectedLines = m1.upperBaseLines;
      excludedLines = m1.neverLowLines;
      match1ActiveCount = m1.upperBaseLines.length;
    }
    isReady = true;
  } else if (m1.lowerReady) {
    mode = 'COMBINED_LOWER';
    base = 'lower';
    selectedLines = m1.lowerBaseLines;
    excludedLines = m1.nonSupportHighLines;
    match1ActiveCount = m1.lowerBaseLines.length;
    isReady = true;
  } else if (m1.upperReady) {
    mode = 'COMBINED_UPPER';
    base = 'upper';
    selectedLines = m1.upperBaseLines;
    excludedLines = m1.neverLowLines;
    match1ActiveCount = m1.upperBaseLines.length;
    isReady = true;
  } else if (m2.lowerReady || m2.upperReady) {
    isReady = true;
    const chooseLower = m2.lowerReady && (!m2.upperReady || m2.lowNativeCount >= m2.highNativeCount);
    if (chooseLower) {
      mode = 'COMBINED_MATCH2_LOWER';
      base = 'lower';
      selectedLines = m2.lowerBaseLines;
      excludedLines = m2.nonSupportHighLines;
      match2ActiveCount = m2.lowerBaseLines.length;
    } else {
      mode = 'COMBINED_MATCH2_UPPER';
      base = 'upper';
      selectedLines = m2.upperBaseLines;
      excludedLines = m2.neverLowLines;
      match2ActiveCount = m2.upperBaseLines.length;
    }
  }

  const upperShortfall = Math.max(0, capacity - m1.upperBaseLines.length);
  const lowerShortfall = Math.max(0, capacity - m1.lowerBaseLines.length);
  const bestShortfall = Math.min(upperShortfall, lowerShortfall);
  let bestBase = 'lower';
  if (upperShortfall < lowerShortfall) {
    bestBase = 'upper';
  } else if (upperShortfall === lowerShortfall && m1.highNativeCount > m1.lowNativeCount) {
    bestBase = 'upper';
  }
  const bestCount = bestBase === 'lower' ? m1.lowerBaseLines.length : m1.upperBaseLines.length;

  return {
    mode,
    isReady,
    base,
    selectedLines,
    excludedLines,
    match1ActiveCount,
    match2ActiveCount,
    highNativeM1Count: m1.highNativeCount,
    lowNativeM1Count: m1.lowNativeCount,
    promotableLowCount: m1.promotableLowLines.length,
    neverLowCount: m1.neverLowLines.length,
    supportHighCount: m1.supportHighLines.length,
    nonSupportHighCount: m1.nonSupportHighLines.length,
    upperBaseM1Count: m1.upperBaseLines.length,
    lowerBaseM1Count: m1.lowerBaseLines.length,
    upperShortfall,
    lowerShortfall,
    bestShortfall,
    bestBase,
    bestCount,
    m1,
    m2,
  };
}

/**
 * 1日分（カード1枚分）の募集状態を計算する。
 * 土曜（本戦）はロビー単位（上位帯/中初級帯）+ 案A合同1卓で計算し、日曜（お祭り）は帯を分けず全体で計算する。
 */
export function computeDayStatus(countOrLines, capacity = DAY_CAPACITY, dayKey = 'sat', options = {}) {
  const recruitingColor = dayKey === 'sun' ? RECRUITMENT_COLORS.recruitingSun : RECRUITMENT_COLORS.recruitingSat;
  const playerMap = options?.playerMap || null;

  // 日曜（お祭り枠）はランク不問・帯分けなし（単一集計）
  if (dayKey === 'sun') {
    if (Array.isArray(countOrLines) || (countOrLines && typeof countOrLines === 'object')) {
      const allLines = Array.isArray(countOrLines)
        ? countOrLines
        : [...(countOrLines.high || []), ...(countOrLines.low || []), ...(countOrLines.spectator || [])];
      const breakdown = parseLobbyBreakdown(allLines, capacity);
      return {
        total: breakdown.total,
        joined: breakdown.joined,
        capacity,
        remaining: breakdown.remaining,
        isReady: breakdown.isReady,
        isBothReady: breakdown.isReady,
        color: breakdown.isReady ? RECRUITMENT_COLORS.confirmed : recruitingColor,
        breakdown,
        high: null,
        low: null,
        combined: null,
        spectator: { total: breakdown.spectatorTotal, lines: breakdown.spectatorLines },
        dominantTierInfo: { key: '', text: '', rangeText: '' },
      };
    }

    const num = Math.max(0, Number(countOrLines) || 0);
    const isReady = num >= capacity;
    return {
      total: num,
      joined: num,
      capacity,
      remaining: Math.max(0, capacity - num),
      isReady,
      isBothReady: isReady,
      color: isReady ? RECRUITMENT_COLORS.confirmed : recruitingColor,
      breakdown: null,
      high: null,
      low: null,
      combined: null,
      dominantTierInfo: { key: '', text: '', rangeText: '' },
    };
  }

  // 土曜（実力均等カスタム）: 2ロビー制（上位帯/中初級帯）＋ 案A厳格合同1卓
  if (Array.isArray(countOrLines) || (countOrLines && typeof countOrLines === 'object')) {
    const dominantTierInfo = { key: '', text: '', rangeText: '' };
    const breakdown = parseEntryBreakdown(countOrLines, capacity, { playerMap });
    const high = breakdown.high;
    const low = breakdown.low;
    const combined = evaluateCombinedStatus(high, low, capacity, playerMap);
    const joined = high.joined + low.joined;
    const isReady = high.isReady || low.isReady || combined.isReady;
    const remaining = isReady ? 0 : combined.bestShortfall;

    return {
      total: breakdown.total,
      joined,
      capacity,
      lobbyCapacity: capacity,
      remaining,
      isReady,
      isBothReady: breakdown.isBothReady,
      color: isReady ? RECRUITMENT_COLORS.confirmed : recruitingColor,
      breakdown,
      high,
      low,
      combined,
      spectator: breakdown.spectator,
      dominantTierInfo,
    };
  }

  // 数値が渡された場合のフォールバック（旧ドライランケース等）
  const num = Math.max(0, Number(countOrLines) || 0);
  const isReady = num >= capacity;

  // 上位帯優先で割り当て
  const highJoined = Math.min(num, capacity);
  const lowJoined = Math.max(0, num - capacity);
  const highStatus = parseLobbyBreakdown(Array.from({ length: highJoined }, (_, i) => `- <@H${i}> 🟢フル 【プラチナ】`), capacity);
  const lowStatus = parseLobbyBreakdown(Array.from({ length: lowJoined }, (_, i) => `- <@L${i}> 🟢フル 【シルバー】`), capacity);
  const fallbackCombined = {
    mode: num >= capacity * 2 ? 'BOTH' : num >= capacity ? 'HIGH_ONLY' : 'RECRUITING',
    isReady: false,
    base: null,
    selectedLines: [],
    excludedLines: [],
    match1ActiveCount: num,
    match2ActiveCount: num,
    bestShortfall: Math.max(0, capacity - num),
    bestBase: 'lower',
    bestCount: num,
  };

  return {
    total: num,
    joined: num,
    capacity,
    lobbyCapacity: capacity,
    remaining: Math.max(0, capacity - num),
    isReady,
    isBothReady: num >= capacity * 2,
    color: isReady ? RECRUITMENT_COLORS.confirmed : recruitingColor,
    breakdown: null,
    high: highStatus,
    low: lowStatus,
    combined: fallbackCombined,
    dominantTierInfo: { key: '', text: '', rangeText: '' },
  };
}

/**
 * カードの description 先頭に置くステータスバナー。
 * 土曜はロビー単位（上位帯/中初級帯）と合同1卓確定状況を併記し、日曜は全体の集計状況を表示する。
 */
export function buildDayBanner(dayKey, status, dominantTierText = '') {
  const def = getDayDef(dayKey);
  const high = status.high;
  const low = status.low;

  // 日曜（お祭り）またはロビー情報が無い場合: 従来の全体集計バナー
  if (!high || !low || dayKey === 'sun') {
    const b = status.breakdown;
    if (b && (b.hasBreakdown || b.hasSpectator)) {
      let header;
      if (b.isMatch1Ready && b.isMatch2Ready) {
        header = '✅ **全戦 開催確定！**';
      } else if (b.isMatch1Ready) {
        header = '✅ **第1戦 開催確定！**';
      } else if (b.isMatch2Ready) {
        header = '✅ **第2戦 開催確定！**';
      } else {
        header = '🔥 **募集中**';
      }

      const matchLine = (label, count, ready, remaining) =>
        `${label} \`${renderMiniBar(count, status.capacity)}\` ${count}/${status.capacity}名 → ${ready ? '**開催確定！**' : `あと${remaining}名`}`;

      return [
        header,
        matchLine('第1戦', b.match1Count, b.isMatch1Ready, b.match1Remaining),
        matchLine('第2戦', b.match2Count, b.isMatch2Ready, b.match2Remaining),
      ].join('\n');
    }

    const header = status.isReady ? '✅ **開催確定！**' : '🔥 **募集中**';
    const bar = renderProgressBar(status.joined, status.capacity);
    const state = status.isReady ? '21:00よりスタート！' : `あと${status.remaining}名で開催確定`;
    return `${header}\n\`${bar}\` ${state}`;
  }

  // 土曜: 2ロビー ＋ 合同1卓（案A）併記バナー
  const combined = status.combined;
  let header;
  if (high?.isReady && low?.isReady) {
    header = '✅ **両ロビー 開催確定！**';
  } else if (high?.isReady) {
    header = '✅ **上位帯 開催確定！**（中初級帯 募集中）';
  } else if (low?.isReady) {
    header = '✅ **中初級帯 開催確定！**（上位帯 募集中）';
  } else if (combined?.mode === 'COMBINED_LOWER') {
    header = `✅ **合同1卓 開催確定！**（計${combined.match1ActiveCount}名・中初級ベース ／ 各帯10名で2部屋開催）`;
  } else if (combined?.mode === 'COMBINED_UPPER') {
    header = `✅ **合同1卓 開催確定！**（計${combined.match1ActiveCount}名・上位ベース ／ 各帯10名で2部屋開催）`;
  } else if (combined?.mode === 'COMBINED_MATCH2_LOWER') {
    header = `✅ **合同1卓 第2戦から開催確定！**（計${combined.match2ActiveCount}名・中初級ベース）`;
  } else if (combined?.mode === 'COMBINED_MATCH2_UPPER') {
    header = `✅ **合同1卓 第2戦から開催確定！**（計${combined.match2ActiveCount}名・上位ベース）`;
  } else if (combined && typeof combined.bestShortfall === 'number' && status.joined > 0) {
    header = `🔥 **募集中**（合同1卓まであと${combined.bestShortfall}名）`;
  } else {
    header = '🔥 **募集中**';
  }

  const isAnyReady = Boolean(status.isReady);
  const lobbyLine = (icon, name, s) => {
    const ready = s.isMatch1Ready || s.isReady;
    const remaining = s.match1Remaining ?? s.remaining;
    const count = s.match1Count ?? s.joined;
    const state = ready
      ? '**開催確定！**'
      : isAnyReady
        ? `2部屋目まであと${remaining}名`
        : `あと${remaining}名`;
    return `${icon} **${name}**: \`${renderMiniBar(count, DAY_CAPACITY)}\` ${count}/${DAY_CAPACITY}名 → ${state}`;
  };

  return [
    header,
    lobbyLine('💎', '上位帯ロビー', high),
    lobbyLine('🍀', '中初級帯ロビー', low),
  ].join('\n');
}

export function replaceBanner(description, banner) {
  if (!description) return banner;
  const parts = description.split('\n\n');
  parts[0] = banner;
  return parts.join('\n\n');
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
  const mentionPrefix = notificationRoleId ? `<@&${notificationRoleId}> ` : '';

  if (target.dayKey === 'sat') {
    return `${mentionPrefix}今週の土曜カスタムです⚔️
🔰「まだ不慣れだけど入っていい？」→ ぜんぜんOKです！実力は五分五分に組むので気軽に押してください。
21:00〜 3戦ほど（24時頃めやす）／1戦だけ・途中合流も自由です！`;
  }

  // 日曜は通知二重鳴り防止のためメンションを省く
  return `今週の日曜はお祭りカスタムです🎪（ランク不問・レート変動なし）
🔰 カスタム初参加や、普段やらないチャンプの練習にもぴったり。1戦だけでも気軽にどうぞ！`;
}
