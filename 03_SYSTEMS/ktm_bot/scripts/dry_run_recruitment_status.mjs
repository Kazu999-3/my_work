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
  computeDayStatus, buildDayBanner, computeDominantTier, getDayDef,
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
  { label: '募集開始直後', count: 0 },
  { label: '半分ほど集まった', count: 5 },
  { label: '定員直前', count: 9 },
  { label: '定員到達(開催確定)', count: 10 },
  { label: '異常値: 定員超過(離脱漏れ等の想定外データ)', count: 12 },
  { label: '異常値: 負の人数', count: -3 },
];

console.log('day | 人数 | color      | isReady | remaining | バナー見出し');
console.log('----|------|------------|---------|-----------|-------------');

for (const dayKey of ['sat', 'sun']) {
  for (const c of cases) {
    const status = computeDayStatus(c.count);
    const header = buildDayBanner(dayKey, status).split('\n')[0];
    const colorName = COLOR_NAMES[status.color] || `不明(0x${status.color.toString(16)})`;

    if (status.remaining < 0) fail(`[${dayKey}/${c.label}] remainingが負になっています`);
    if (status.joined < 0) fail(`[${dayKey}/${c.label}] joinedが負になっています`);
    if (status.isReady !== (status.joined >= DAY_CAPACITY)) {
      fail(`[${dayKey}/${c.label}] isReadyが人数と一致しません`);
    }
    const expectedColor = status.isReady ? RECRUITMENT_COLORS.confirmed : RECRUITMENT_COLORS.recruiting;
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
// 2. 最多ランク帯の集計ルール
//    エメラルド以上 ➔ プラチナ合算 / アイアン・未ランク ➔ ブロンズ合算
// ---------------------------------------------------------------------------
const tierCases = [
  { label: '参加者なし', lines: [], expect: '' },
  { label: 'シルバー多数', lines: ['【シルバー】', '【シルバー】', '【ゴールド】'], expect: 'シルバー帯(2名)' },
  { label: 'ダイヤはプラチナへ合算', lines: ['【ダイヤ】', '【エメラルド】', '【シルバー】'], expect: 'プラチナ帯(2名)' },
  { label: '未ランクはブロンズへ合算', lines: ['【未ランク】', '【アイアン】', '【ゴールド】'], expect: 'ブロンズ帯(2名)' },
];

console.log('\n最多ランク帯の集計:');
for (const t of tierCases) {
  const lines = t.lines.map((r, i) => `- <@${100 + i}> 🟢フル 👑常連 ${r}`);
  const actual = computeDominantTier(lines);
  if (actual !== t.expect) fail(`[${t.label}] 期待=${t.expect || '(空)'} / 実際=${actual || '(空)'}`);
  console.log(`  ${t.label.padEnd(24)} → ${actual || '(なし)'}`);
}

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
  '- <@2> 🌙途中参加(2戦目〜) 🌱ライト 【プラチナ】 【第1: ADC / 第2: JG】',
  '- <@3> 🟢フル 👑常連 【ゴールド】 【第1: TOP / 第2: JG】',
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
