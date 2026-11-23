// 週末定期カスタムの募集カードを、Discordへ一切投稿せずに手元で検証するドライラン。
//
// 使い方: node scripts/dry_run_recruitment_status.mjs
//
// 募集カードの文言・色ロジックを変更した際は、本番へデプロイする前に必ずこれを通すこと。
// ・状態(募集中/開催確定)と色・見出しの整合性を機械的に検証する
// ・実際に投稿されるカードの全文を出力するので、文字量も目で確認できる
//
// 2026-09-23: カードを土日2枚へ分離したのに伴い、単日モデル(computeDayStatus /
// buildDayBanner / buildDayRecruitEmbed)を対象に全面的に書き直した。
// 旧版は「シルバー/ゴルプラ + 部門またぎ合計」という、既にコードから消えたモデルを
// 前提にしたまま残されており、検証が実質素通りしていた時期がある。
// モデルを変えたらこのスクリプトも必ず追従させること。

import {
  computeDayStatus, buildDayBanner, getDayDef,
  RECRUITMENT_COLORS, DAY_CAPACITY, resolveWeekendTargets, buildRecruitmentContent,
} from '../src/utils/recruitmentStatus.js';
import { buildDayRecruitEmbed, buildDayRecruitComponents } from '../src/ui/embeds.js';
import {
  BAND_BOUNDARY_MMR,
  determineParticipantAttributes,
  formatParticipantDisplayLine,
  buildDisplayLinesFromDb,
  rebuildAdhocMetadataFromDb,
} from '../src/utils/recruitmentLedger.js';

const COLOR_NAMES = Object.fromEntries(
  Object.entries(RECRUITMENT_COLORS).map(([name, hex]) => [hex, name])
);

let hasFailure = false;
const fail = (msg) => { console.error(`❌ ${msg}`); hasFailure = true; };

// ---------------------------------------------------------------------------
// 1. 状態遷移の不変条件
// ---------------------------------------------------------------------------
const cases = [
  { label: '募集開始直後', input: 0 },
  { label: '半分ほど集まった', input: 5 },
  { label: '定員直前', input: 9 },
  { label: '定員到達(開催確定)', input: 10 },
  { label: '異常値: 定員超過(離脱漏れ等の想定外データ)', input: 12 },
  { label: '異常値: 負の人数', input: -3 },
  {
    label: '実戦混在ケース(計9名: フル6/1戦1/途中2)',
    input: [
      '- <@1> ⏱️1戦のみ 👑常連 【シルバー】',
      '- <@2> 🟢フル 👑常連 【ゴールド】',
      '- <@3> 🟢フル 👑常連 【プラチナ】',
      '- <@4> 🌙途中参加(2戦目〜) 👑常連 【シルバー】',
      '- <@5> 🟢フル 👑常連 【プラチナ】',
      '- <@6> 🟢フル 👑常連 【シルバー】',
      '- <@7> 🌙途中参加(2戦目〜) 👑常連 【プラチナ】',
      '- <@8> 🟢フル 👑常連 【プラチナ】',
      '- <@9> 🟢フル 👑常連 【プラチナ】',
    ]
  },
  {
    label: 'ロビー別: 片方だけ満員 (上位10名・中初級3名)',
    input: [
      ...Array.from({ length: 10 }, (_, i) => `- <@H${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 3 }, (_, i) => `- <@L${i}> 🟢フル 【シルバー】`),
    ],
    expectedHighReady: true,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedHeaderSnippet: '上位帯 開催確定！',
  },
  {
    label: 'ロビー別: 片方だけ満員 (中初級10名・上位2名)',
    input: [
      ...Array.from({ length: 2 }, (_, i) => `- <@H${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 10 }, (_, i) => `- <@L${i}> 🟢フル 【シルバー】`),
    ],
    expectedHighReady: false,
    expectedLowReady: true,
    expectedBothReady: false,
    expectedHeaderSnippet: '中初級帯 開催確定！',
  },
  {
    label: 'ロビー別: 両方満員 (上位10名・中初級10名)',
    input: [
      ...Array.from({ length: 10 }, (_, i) => `- <@H${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 10 }, (_, i) => `- <@L${i}> 🟢フル 【シルバー】`),
    ],
    expectedHighReady: true,
    expectedLowReady: true,
    expectedBothReady: true,
    expectedHeaderSnippet: '両ロビー 開催確定！',
  },
  {
    label: 'ロビー別: 両方未達 (上位3名・中初級4名)',
    input: [
      ...Array.from({ length: 3 }, (_, i) => `- <@H${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 4 }, (_, i) => `- <@L${i}> 🟢フル 【シルバー】`),
    ],
    expectedHighReady: false,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedHeaderSnippet: '募集中',
  },
  {
    label: '土日差異検証: 厳格保護あり混在計10名 (上位5非サポ・中初級5うちnever2)',
    input: [
      ...Array.from({ length: 5 }, (_, i) => `- <@HS${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 5 }, (_, i) => `- <@LS${i}> 🟢フル 【シルバー】`),
    ],
    playerMap: new Map([
      ...Array.from({ length: 5 }, (_, i) => [`HS${i}`, { mmr: 1550, allow_lower_support: false }]),
      ...Array.from({ length: 5 }, (_, i) => [`LS${i}`, { mmr: 1300, tier_promotion_pref: i < 2 ? 'never' : 'fill_only' }]),
    ]),
    // 土曜は厳格保護により上位ベース8名・中初級ベース5名で両方未達 (isReady: false)
    expectedHighReady: false,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedCombinedMode: 'RECRUITING',
    expectedHeaderSnippet: '募集中',
    // 日曜は帯を分けず全体10名で定員到達 (isReady: true)
    expectedSunReady: true,
  },
  {
    label: '案A合同1卓: 上位4(サポ4)＋中初級6 ➔ 中初級ベース開催確定',
    input: [
      ...Array.from({ length: 4 }, (_, i) => `- <@CUH${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 6 }, (_, i) => `- <@CUL${i}> 🟢フル 【シルバー】`),
    ],
    playerMap: new Map([
      ...Array.from({ length: 4 }, (_, i) => [`CUH${i}`, { mmr: 1500, allow_lower_support: true }]),
      ...Array.from({ length: 6 }, (_, i) => [`CUL${i}`, { mmr: 1300, tier_promotion_pref: 'never' }]),
    ]),
    expectedHighReady: false,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedCombinedReady: true,
    expectedCombinedMode: 'COMBINED_LOWER',
    expectedHeaderSnippet: '合同1卓 開催確定！',
    expectedSunReady: true,
  },
  {
    label: '案A合同1卓: 上位6(非サポ)＋中初級4(繰上OK) ➔ 上位ベース開催確定',
    input: [
      ...Array.from({ length: 6 }, (_, i) => `- <@CH${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 4 }, (_, i) => `- <@CL${i}> 🟢フル 【ゴールド】`),
    ],
    playerMap: new Map([
      ...Array.from({ length: 6 }, (_, i) => [`CH${i}`, { mmr: 1550, allow_lower_support: false }]),
      ...Array.from({ length: 4 }, (_, i) => [`CL${i}`, { mmr: 1400, tier_promotion_pref: i === 0 ? 'mix_ok' : 'fill_only' }]),
    ]),
    expectedHighReady: false,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedCombinedReady: true,
    expectedCombinedMode: 'COMBINED_UPPER',
    expectedHeaderSnippet: '合同1卓 開催確定！',
    expectedSunReady: true,
  },
  {
    label: '厳格保護②: 上位6(サポ2)＋中初級4(never 2) ➔ 不成立(募集中)',
    input: [
      ...Array.from({ length: 6 }, (_, i) => `- <@NH${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 4 }, (_, i) => `- <@NL${i}> 🟢フル 【シルバー】`),
    ],
    playerMap: new Map([
      ...Array.from({ length: 6 }, (_, i) => [`NH${i}`, { mmr: 1550, allow_lower_support: i < 2 }]),
      ...Array.from({ length: 4 }, (_, i) => [`NL${i}`, { mmr: 1350, tier_promotion_pref: i < 2 ? 'never' : 'fill_only' }]),
    ]),
    expectedHighReady: false,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedCombinedReady: false,
    expectedCombinedMode: 'RECRUITING',
    expectedHeaderSnippet: '募集中',
    expectedSunReady: true,
  },
];

console.log('day | 人数 | color      | isReady | remaining | バナー見出し');
console.log('----|------|------------|---------|-----------|-------------');

for (const dayKey of ['sat', 'sun']) {
  for (const c of cases) {
    const status = computeDayStatus(c.input, undefined, dayKey, { playerMap: c.playerMap });
    const header = buildDayBanner(dayKey, status, status.dominantTierInfo?.text).split('\n')[0];
    const colorName = COLOR_NAMES[status.color] || `不明(0x${status.color.toString(16)})`;

    if (status.remaining < 0) fail(`[${dayKey}/${c.label}] remainingが負になっています`);
    if (status.joined < 0) fail(`[${dayKey}/${c.label}] joinedが負になっています`);
    
    // 土曜と日曜の判定ロジック分岐
    let expectedReady;
    if (dayKey === 'sat') {
      if (!status.high || !status.low) {
        fail(`[${dayKey}/${c.label}] 土曜なのにhigh/lowロビーが設定されていません`);
      }
      expectedReady = status.breakdown
        ? (status.high.isReady || status.low.isReady || Boolean(status.combined?.isReady))
        : (status.joined >= DAY_CAPACITY);

      // 土曜ロビー別・合同固有のアサーション
      if (c.expectedHighReady !== undefined && status.high.isReady !== c.expectedHighReady) {
        fail(`[${dayKey}/${c.label}] high.isReadyが期待と一致しません (実際: ${status.high.isReady}, 期待: ${c.expectedHighReady})`);
      }
      if (c.expectedLowReady !== undefined && status.low.isReady !== c.expectedLowReady) {
        fail(`[${dayKey}/${c.label}] low.isReadyが期待と一致しません (実際: ${status.low.isReady}, 期待: ${c.expectedLowReady})`);
      }
      if (c.expectedBothReady !== undefined && status.isBothReady !== c.expectedBothReady) {
        fail(`[${dayKey}/${c.label}] isBothReadyが期待と一致しません (実際: ${status.isBothReady}, 期待: ${c.expectedBothReady})`);
      }
      if (c.expectedCombinedReady !== undefined && Boolean(status.combined?.isReady) !== c.expectedCombinedReady) {
        fail(`[${dayKey}/${c.label}] combined.isReadyが期待と一致しません (実際: ${status.combined?.isReady}, 期待: ${c.expectedCombinedReady})`);
      }
      if (c.expectedCombinedMode !== undefined && status.combined?.mode !== c.expectedCombinedMode) {
        fail(`[${dayKey}/${c.label}] combined.modeが期待と一致しません (実際: ${status.combined?.mode}, 期待: ${c.expectedCombinedMode})`);
      }
      if (c.expectedHeaderSnippet && !header.includes(c.expectedHeaderSnippet)) {
        fail(`[${dayKey}/${c.label}] 見出しに期待スニペット「${c.expectedHeaderSnippet}」がありません: ${header}`);
      }
    } else {
      // 日曜（お祭り）: 帯分けなし（単一集計）
      if (status.high !== null || status.low !== null) {
        fail(`[${dayKey}/${c.label}] 日曜なのにhigh/lowロビーが残っています`);
      }
      expectedReady = status.breakdown
        ? status.breakdown.isReady
        : (status.joined >= DAY_CAPACITY);

      if (header.includes('上位帯') || header.includes('中初級帯')) {
        fail(`[${dayKey}/${c.label}] 日曜見出しにロビー名が含まれています: ${header}`);
      }
      if (c.expectedSunReady !== undefined && status.isReady !== c.expectedSunReady) {
        fail(`[${dayKey}/${c.label}] 日曜のisReadyが期待と一致しません (実際: ${status.isReady}, 期待: ${c.expectedSunReady})`);
      }
    }

    if (status.isReady !== expectedReady) {
      fail(`[${dayKey}/${c.label}] isReadyが人数と一致しません (実際: ${status.isReady}, 期待: ${expectedReady})`);
    }
    const expectedColor = status.isReady
      ? RECRUITMENT_COLORS.confirmed
      : (dayKey === 'sun' ? RECRUITMENT_COLORS.recruitingSun : RECRUITMENT_COLORS.recruitingSat);
    if (status.color !== expectedColor) {
      fail(`[${dayKey}/${c.label}] colorが状態と一致しません(実際=0x${status.color.toString(16)})`);
    }
    if (status.isReady && !header.includes('開催確定')) {
      fail(`[${dayKey}/${c.label}] 定員到達なのに見出しに「開催確定」がありません: ${header}`);
    }
    if (!status.isReady && !header.includes('募集中')) {
      fail(`[${dayKey}/${c.label}] 募集中なのに見出しに「募集中」がありません: ${header}`);
    }

    console.log(
      `${dayKey} | ${String(status.joined).padStart(4)} | ${colorName.padEnd(10)} | ` +
      `${String(status.isReady).padEnd(7)} | ${String(status.remaining).padStart(9)} | ${header} 【${c.label}】`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. 最多ランク帯の集計ルール（2026-10-17 全員出場化に伴い廃止）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3. 開催日の解決（曜日ごと）
//    日曜は「前日の土曜」とペアで1つの週末。単純な (6 - day + 7) % 7 で計算すると
//    日曜が翌週末を指してしまい、日曜20:00の開催判定が必ず空振りする。
// ---------------------------------------------------------------------------
const jstAt = (y, m, d, h) => new Date(Date.UTC(y, m - 1, d, h - 9, 0, 0));
const dateCases = [
  ['水 12:00 (募集投稿)', jstAt(2026, 9, 23, 12), '9/26(土)', '9/27(日)'],
  ['金 19:00 (中間通知)', jstAt(2026, 9, 25, 19), '9/26(土)', '9/27(日)'],
  ['土 17:00 (中間通知)', jstAt(2026, 9, 26, 17), '9/26(土)', '9/27(日)'],
  ['土 20:00 (開催判定)', jstAt(2026, 9, 26, 20), '9/26(土)', '9/27(日)'],
  ['土 22:00 (開催後)', jstAt(2026, 9, 26, 22), '10/3(土)', '10/4(日)'],
  ['日 17:00 (中間通知)', jstAt(2026, 9, 27, 17), '9/26(土)', '9/27(日)'],
  ['日 20:00 (開催判定)', jstAt(2026, 9, 27, 20), '9/26(土)', '9/27(日)'],
  ['日 22:00 (開催後)', jstAt(2026, 9, 27, 22), '10/3(土)', '10/4(日)'],
  ['月 09:00', jstAt(2026, 9, 28, 9), '10/3(土)', '10/4(日)'],
  ['月またぎ 水 12:00', jstAt(2026, 9, 30, 12), '10/3(土)', '10/4(日)'],
];

console.log('\n開催日の解決:');
for (const [label, now, expSat, expSun] of dateCases) {
  const [sat, sun] = resolveWeekendTargets(now);
  if (sat.label !== expSat || sun.label !== expSun) {
    fail(`[${label}] 期待 土:${expSat}/日:${expSun} → 実際 土:${sat.label}/日:${sun.label}`);
  }
  for (const t of [sat, sun]) {
    // 21:00 JST = 12:00 UTC。ここがズレると二重投稿防止の照合キーごと壊れる。
    if (!t.startAtIso.endsWith('T12:00:00.000Z')) {
      fail(`[${label}] ${t.label} の start_at が 12:00Z ではありません: ${t.startAtIso}`);
    }
  }
  console.log(`  ${label.padEnd(22)} → 土:${sat.label} 日:${sun.label}`);
}

// ---------------------------------------------------------------------------
// 4. 実際に投稿されるカードの全文（文字量の目視確認用）
// ---------------------------------------------------------------------------
const sampleLines = [
  '- <@1> ⏱️1戦のみ 👑常連 【シルバー】 【第1: SUP / 第2: ADC】',
  '- <@2> 🟢フル 👑常連 【ゴールド】 【第1: TOP / 第2: JG】',
  '- <@3> 🟢フル 👑常連 【プラチナ】 【第1: JG / 第2: TOP】',
  '- <@4> 🌙途中参加(2戦目〜) 👑常連 【シルバー】 【第1: SUP / 第2: MID】',
  '- <@5> 🟢フル 👑常連 【プラチナ】 【第1: TOP / 第2: JG】',
  '- <@6> 🟢フル 👑常連 【シルバー】 【第1: SUP / 第2: ADC】',
  '- <@7> 🌙途中参加(2戦目〜) 👑常連 【プラチナ】 【第1: JG / 第2: SUP】',
  '- <@8> 🟢フル 👑常連 【プラチナ】 【第1: MID / 第2: ADC】',
  '- <@9> 🟢フル 👑常連 【プラチナ】 【第1: TOP / 第2: JG】',
];

for (const [dayKey, label, lines] of [['sat', '9/26(土)', sampleLines], ['sun', '9/27(日)', []]]) {
  const def = getDayDef(dayKey);
  const embed = buildDayRecruitEmbed({ dayKey, label }, lines);
  const buttons = buildDayRecruitComponents(dayKey)[0].components.map((b) => `[${b.label}]`).join(' ');
  const content = buildRecruitmentContent({ dayKey, def, label }, '1528646515533287497');

  console.log(`\n${'='.repeat(70)}`);
  console.log(content);
  console.log('-'.repeat(70));
  console.log(embed.title);
  console.log('');
  console.log(embed.description);
  console.log('');
  for (const f of embed.fields) {
    console.log(f.name);
    console.log(f.value);
  }
  console.log(`— ${embed.footer.text}`);
  console.log(buttons);

  const charCount = [embed.title, embed.description, ...embed.fields.flatMap((f) => [f.name, f.value]), embed.footer.text]
    .join('\n').length;
  console.log(`(Embed全体の文字数: ${charCount} / 本文の文字数: ${content.length})`);

  // Discordの上限（content 2000 / description 4096 / field value 1024 / footer 2048）に対する保険
  if (content.length > 2000) fail(`[${dayKey}] contentが2000文字を超えています (${content.length})`);
  if (embed.description.length > 4096) fail(`[${dayKey}] descriptionが4096文字を超えています`);
  for (const f of embed.fields) {
    if (f.value.length > 1024) fail(`[${dayKey}] フィールド「${f.name}」のvalueが1024文字を超えています`);
  }
}

// ---------------------------------------------------------------------------
// 5. DB駆動（recruitmentLedger）の検証
// ---------------------------------------------------------------------------
console.log('5. DB駆動 (recruitmentLedger) 検証:');

// (A) determineParticipantAttributes
const attrCases = [
  {
    name: '土曜・上位帯 (MMR 1500 / PLATINUM)',
    player: { mmr: 1500, mmr_mid: 1500, role_preferences: { primary: 'MID', secondary: 'TOP' } },
    style: 'full',
    dayKey: 'sat',
    expectedLobby: 'high',
    expectedStyle: 'full',
    expectedPrimary: 'MID',
    expectedSecondary: 'TOP',
  },
  {
    name: '土曜・中初級帯 (MMR 1400 / SILVER)',
    player: { mmr: 1400, mmr_top: 1400, role_preferences: { primary: 'TOP', secondary: null } },
    style: 'single',
    dayKey: 'sat',
    expectedLobby: 'low',
    expectedStyle: 'single',
    expectedPrimary: 'TOP',
    expectedSecondary: null,
  },
  {
    name: '土曜・未設定/初心者 (MMR なし)',
    player: null,
    style: 'late',
    dayKey: 'sat',
    expectedLobby: 'low',
    expectedStyle: 'late',
    expectedPrimary: null,
    expectedSecondary: null,
  },
  {
    name: '日曜・上位MMRでも帯分けなし (MMR 1600)',
    player: { mmr: 1600, mmr_adc: 1600, role_preferences: { primary: 'ADC', secondary: 'FILL' } },
    style: 'spectator',
    dayKey: 'sun',
    expectedLobby: 'low',
    expectedStyle: 'spectator',
    expectedPrimary: 'ADC',
    expectedSecondary: 'ALL',
  },
  {
    name: '土曜・代表MMR統一 (mmr 1400 < 1450 かつ mmr_mid 1550 ➔ low)',
    player: { mmr: 1400, mmr_mid: 1550, role_preferences: { primary: 'MID' } },
    style: 'full',
    dayKey: 'sat',
    expectedLobby: 'low',
    expectedStyle: 'full',
    expectedPrimary: 'MID',
    expectedSecondary: null,
  },
];

for (const ac of attrCases) {
  const attrs = determineParticipantAttributes(ac.player, ac.style, ac.dayKey);
  if (attrs.lobby !== ac.expectedLobby) {
    fail(`[DBAttr: ${ac.name}] lobby 不一致: 期待=${ac.expectedLobby}, 実際=${attrs.lobby}`);
  }
  if (attrs.style !== ac.expectedStyle) {
    fail(`[DBAttr: ${ac.name}] style 不一致: 期待=${ac.expectedStyle}, 実際=${attrs.style}`);
  }
  if (attrs.primaryLane !== ac.expectedPrimary) {
    fail(`[DBAttr: ${ac.name}] primaryLane 不一致: 期待=${ac.expectedPrimary}, 実際=${attrs.primaryLane}`);
  }
  if (attrs.secondaryLane !== ac.expectedSecondary) {
    fail(`[DBAttr: ${ac.name}] secondaryLane 不一致: 期待=${ac.expectedSecondary}, 実際=${attrs.secondaryLane}`);
  }
  console.log(`  ✓ ${ac.name.padEnd(38)} → lobby:${attrs.lobby} style:${attrs.style}`);
}

// (B) buildDisplayLinesFromDb & computeDayStatus の連携テスト
const satDef = getDayDef('sat');
const sunDef = getDayDef('sun');

// 模擬DB参加者データ: 上位10名(フル) + 中初級4名(フル2, 1戦1, 途中1)
const mockParticipants = [
  ...Array.from({ length: 10 }, (_, i) => ({
    recruitment_id: 'rec_sat_1',
    discord_id: `high_user_${i}`,
    style: 'full',
    lobby: 'high',
    rank_tier: 'PLATINUM',
    primary_lane: 'MID',
    secondary_lane: 'TOP',
  })),
  {
    recruitment_id: 'rec_sat_1',
    discord_id: 'low_user_0',
    style: 'full',
    lobby: 'low',
    rank_tier: 'SILVER',
    primary_lane: 'BOT',
    secondary_lane: null,
  },
  {
    recruitment_id: 'rec_sat_1',
    discord_id: 'low_user_1',
    style: 'single',
    lobby: 'low',
    rank_tier: 'BRONZE',
    primary_lane: null,
    secondary_lane: null,
  },
  {
    recruitment_id: 'rec_sat_1',
    discord_id: 'low_user_2',
    style: 'late',
    lobby: 'low',
    rank_tier: 'SILVER',
    primary_lane: 'SUP',
    secondary_lane: null,
  },
  {
    recruitment_id: 'rec_sat_1',
    discord_id: 'low_user_unregistered',
    style: 'full',
    lobby: 'low',
    rank_tier: null,
    primary_lane: null,
    secondary_lane: null,
  },
];

const mockPlayersMap = new Map([
  ...Array.from({ length: 10 }, (_, i) => [
    `high_user_${i}`,
    { discord_id: `high_user_${i}`, mmr: 1550, games_mid: 20, mmr_mid: 1550, name: `上位${i}` },
  ]),
  ['low_user_0', { discord_id: 'low_user_0', mmr: 1350, games_adc: 30, mmr_adc: 1350, name: '初級0' }],
  ['low_user_1', { discord_id: 'low_user_1', mmr: 1200, games_top: 5, mmr_top: 1200, name: '初級1' }],
  ['low_user_2', { discord_id: 'low_user_2', mmr: 1300, games_sup: 15, mmr_sup: 1300, name: '初級2' }],
  // low_user_unregistered は未登録（Mapに存在しない）
]);

const satLines = buildDisplayLinesFromDb(mockParticipants, mockPlayersMap, satDef);
if (satLines.length !== 14) {
  fail(`[DBLines] 生成行数不一致: 期待=14, 実際=${satLines.length}`);
}

// 未登録ユーザーの行に 🔰 が含まれているか
const unregLine = satLines.find((l) => l.includes('low_user_unregistered'));
if (!unregLine || !unregLine.includes('🔰')) {
  fail(`[DBLines] 未登録ユーザー行に🔰がありません: ${unregLine}`);
}

// 上位帯ユーザーの行にランクとレーンが含まれているか
const highLine0 = satLines.find((l) => l.includes('high_user_0'));
if (!highLine0 || !highLine0.includes('【プラ】') || !highLine0.includes('【MID/TOP】')) {
  fail(`[DBLines] 上位帯ユーザー行の表記が不正です: ${highLine0}`);
}

// 土曜ステータス判定: 上位帯は10名で確定、中初級帯は4名で未達
const satStatusFromDb = computeDayStatus(satLines, DAY_CAPACITY, 'sat');
if (!satStatusFromDb.high?.isReady) {
  fail(`[DBStatus: sat] 上位帯が開催確定になっていません`);
}
if (satStatusFromDb.low?.isReady) {
  fail(`[DBStatus: sat] 中初級帯が未達なのに開催確定になっています`);
}
if (satStatusFromDb.isBothReady) {
  fail(`[DBStatus: sat] 両方確定ではないのに isBothReady が true です`);
}
console.log(`  ✓ DB行からの土曜ステータス判定: 上位確定=${satStatusFromDb.high.isReady}, 中初級確定=${satStatusFromDb.low.isReady}`);

// 日曜ステータス判定（同じ14名）: 帯を分けず全体14名で定員(10名)到達、確定
const sunLines = buildDisplayLinesFromDb(mockParticipants, mockPlayersMap, sunDef);
const sunStatusFromDb = computeDayStatus(sunLines, DAY_CAPACITY, 'sun');
if (!sunStatusFromDb.isReady) {
  fail(`[DBStatus: sun] 日曜全体14名なのに開催確定になっていません`);
}
console.log(`  ✓ DB行からの日曜ステータス判定: 全体確定=${sunStatusFromDb.isReady} (参加人数=${sunStatusFromDb.joined})`);

// ---------------------------------------------------------------------------
// 6. 都度募集 DB 駆動（rebuildAdhocMetadataFromDb / lobby='all'）の検証
// ---------------------------------------------------------------------------
console.log('\n6. 都度募集 DB 駆動 (rebuildAdhocMetadataFromDb) 検証:');

// (A) determineParticipantAttributes: 都度募集時は lobby='all'
const adhocAttr1 = determineParticipantAttributes(
  { mmr: 1600, mmr_top: 1600, role_preferences: { primary: 'TOP' } },
  'full',
  null, // dayKey が null
  { lobby: 'all', primaryLane: 'TOP' }
);
if (adhocAttr1.lobby !== 'all') {
  fail(`[AdhocAttr] lobby が 'all' になっていません (実際: ${adhocAttr1.lobby})`);
}
if (adhocAttr1.primaryLane !== 'TOP') {
  fail(`[AdhocAttr] primaryLane が 'TOP' になっていません (実際: ${adhocAttr1.primaryLane})`);
}
console.log(`  ✓ 都度募集ロール参加属性: lobby=${adhocAttr1.lobby}, primaryLane=${adhocAttr1.primaryLane}`);

const adhocAttr2 = determineParticipantAttributes(null, 'spectator', 'all');
if (adhocAttr2.lobby !== 'all' || adhocAttr2.style !== 'spectator') {
  fail(`[AdhocAttr] 観戦属性が不正です: lobby=${adhocAttr2.lobby}, style=${adhocAttr2.style}`);
}
console.log(`  ✓ 都度募集観戦属性: lobby=${adhocAttr2.lobby}, style=${adhocAttr2.style}`);

// (B) rebuildAdhocMetadataFromDb: DB参加者からメタデータ再構築
const initialMetadata = {
  mode: 'カスタム',
  maxCount: 10,
  owner: 'owner_1',
  joined: [],
  spectating: [],
  roles: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
  names: {},
  badges: {},
  lanes: {},
};

const mockAdhocParticipants = [
  {
    recruitment_id: 'rec_adhoc_1',
    discord_id: 'u_mid',
    user_name: 'ミッド担当',
    style: 'full',
    lobby: 'all',
    primary_lane: 'MID',
  },
  {
    recruitment_id: 'rec_adhoc_1',
    discord_id: 'u_top',
    user_name: 'トップ担当',
    style: 'full',
    lobby: 'all',
    primary_lane: 'TOP',
  },
  {
    recruitment_id: 'rec_adhoc_1',
    discord_id: 'u_any',
    user_name: '自由枠',
    style: 'full',
    lobby: 'all',
    primary_lane: null,
  },
  {
    recruitment_id: 'rec_adhoc_1',
    discord_id: 'u_spec',
    user_name: '見学者',
    style: 'spectator',
    lobby: 'all',
    primary_lane: null,
  },
];

const mockAdhocPlayerMap = new Map([
  ['u_mid', { discord_id: 'u_mid', games_mid: 20, mmr_mid: 1500, days_since_last_match: 2 }],
  ['u_top', { discord_id: 'u_top', games_top: 10, mmr_top: 1400, days_since_last_match: 1 }],
  ['u_any', { discord_id: 'u_any', games_sup: 5, mmr_sup: 1200, days_since_last_match: 5 }],
  ['u_spec', { discord_id: 'u_spec', total_games: 0 }],
]);

const rebuiltMeta = rebuildAdhocMetadataFromDb(initialMetadata, mockAdhocParticipants, mockAdhocPlayerMap);

if (rebuiltMeta.joined.length !== 3) {
  fail(`[RebuildAdhoc] joined 人数不一致: 期待=3, 実際=${rebuiltMeta.joined.length}`);
}
if (rebuiltMeta.spectating.length !== 1 || rebuiltMeta.spectating[0] !== 'u_spec') {
  fail(`[RebuildAdhoc] spectating 不正: ${JSON.stringify(rebuiltMeta.spectating)}`);
}
if (rebuiltMeta.roles.TOP !== 'u_top') {
  fail(`[RebuildAdhoc] roles.TOP 不正: 期待='u_top', 実際=${rebuiltMeta.roles.TOP}`);
}
if (rebuiltMeta.roles.MID !== 'u_mid') {
  fail(`[RebuildAdhoc] roles.MID 不正: 期待='u_mid', 実際=${rebuiltMeta.roles.MID}`);
}
// カスタム募集でのレーン優先順ソート検証: TOP (1) ➔ MID (3) ➔ ALL (6)
if (rebuiltMeta.joined[0] !== 'u_top' || rebuiltMeta.joined[1] !== 'u_mid' || rebuiltMeta.joined[2] !== 'u_any') {
  fail(`[RebuildAdhoc] joined のレーン順ソート不正: ${JSON.stringify(rebuiltMeta.joined)}`);
}
console.log(`  ✓ 都度募集メタデータ再構築: joined=${rebuiltMeta.joined.length}名, spectating=${rebuiltMeta.spectating.length}名, ソート順=${rebuiltMeta.joined.join(' -> ')}`);

console.log(`${'='.repeat(70)}\n`);

if (hasFailure) {
  console.error('❌ 不変条件違反があります。utils/recruitmentStatus.js / ui/embeds.js を確認してください。');
  process.exit(1);
} else {
  console.log('✅ 全ケースで不変条件を満たしています。');
}
