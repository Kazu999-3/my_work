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
    label: '土日差異検証: 帯混在計10名 (上位5名・中初級5名)',
    input: [
      ...Array.from({ length: 5 }, (_, i) => `- <@H${i}> 🟢フル 【プラチナ】`),
      ...Array.from({ length: 5 }, (_, i) => `- <@L${i}> 🟢フル 【シルバー】`),
    ],
    // 土曜は各ロビー5名で両方未達 (isReady: false)
    expectedHighReady: false,
    expectedLowReady: false,
    expectedBothReady: false,
    expectedHeaderSnippet: '募集中',
    // 日曜は帯を分けず全体10名で定員到達 (isReady: true)
    expectedSunReady: true,
  },
];

console.log('day | 人数 | color      | isReady | remaining | バナー見出し');
console.log('----|------|------------|---------|-----------|-------------');

for (const dayKey of ['sat', 'sun']) {
  for (const c of cases) {
    const status = computeDayStatus(c.input, undefined, dayKey);
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
        ? (status.high.isReady || status.low.isReady)
        : (status.joined >= DAY_CAPACITY);

      // 土曜ロビー別固有のアサーション
      if (c.expectedHighReady !== undefined && status.high.isReady !== c.expectedHighReady) {
        fail(`[${dayKey}/${c.label}] high.isReadyが期待と一致しません (実際: ${status.high.isReady}, 期待: ${c.expectedHighReady})`);
      }
      if (c.expectedLowReady !== undefined && status.low.isReady !== c.expectedLowReady) {
        fail(`[${dayKey}/${c.label}] low.isReadyが期待と一致しません (実際: ${status.low.isReady}, 期待: ${c.expectedLowReady})`);
      }
      if (c.expectedBothReady !== undefined && status.isBothReady !== c.expectedBothReady) {
        fail(`[${dayKey}/${c.label}] isBothReadyが期待と一致しません (実際: ${status.isBothReady}, 期待: ${c.expectedBothReady})`);
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

console.log(`${'='.repeat(70)}\n`);

if (hasFailure) {
  console.error('❌ 不変条件違反があります。utils/recruitmentStatus.js / ui/embeds.js を確認してください。');
  process.exit(1);
} else {
  console.log('✅ 全ケースで不変条件を満たしています。');
}
