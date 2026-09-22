#!/usr/bin/env node
/**
 * カジノ各ゲームのRTP（還元率）実測レポート
 *
 * 配当テーブルや抽選確率を変更したら必ずこれを実行し、
 * 意図した還元率になっているかを「推測ではなく実測で」確認すること。
 * ここで出た数値は src/app/casino/rules/page.tsx の表示値と一致していなければならない。
 *
 *   実行: node scripts/casino_rtp_report.js [試行回数]
 *
 * ⚠️ このスクリプトは各APIの抽選ロジックを「移植」している。
 *    本体（src/app/api/bet/*）を変更したらこちらも必ず同じ式へ追従させること。
 */

const N = Number(process.argv[2]) || 2_000_000;
const pct = (x) => (x * 100).toFixed(2).padStart(6) + '%';

// ============================================================
// 🎰 スロット  src/app/api/bet/slot/route.ts の spinReels()
// ============================================================
const SLOT_TABLE = [
  { label: '💎ジェム x3',   p: 0.002, mult: 50 },
  { label: '👾バロン x3',   p: 0.010, mult: 15 },
  { label: '🐉ドラゴン x3', p: 0.030, mult: 5 },
  { label: '🗡️ブレード x3', p: 0.070, mult: 3 },
  { label: '🐹ポロ x3',     p: 0.120, mult: 2 },
  { label: '💎ジェム x2',   p: 0.020, mult: 1.5 },
  { label: '🐹ポロ x2',     p: 0.050, mult: 1.0 },
];

function slotReport() {
  console.log('\n🎰 スロット (理論値・確率が固定テーブルのため解析的に算出)');
  let rtp = 0;
  let hit = 0;
  for (const row of SLOT_TABLE) {
    rtp += row.p * row.mult;
    hit += row.p;
    console.log(`   ${row.label.padEnd(14)} 確率 ${pct(row.p)}  配当 x${row.mult}`);
  }
  console.log(`   ${'ハズレ'.padEnd(14)} 確率 ${pct(1 - hit)}  配当 x0`);
  console.log(`   → RTP ${pct(rtp)} / ハウスエッジ ${pct(1 - rtp)}`);
  return rtp;
}

// ============================================================
// 🃏 バカラ  src/app/api/bet/baccarat/route.ts
// ============================================================
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardValue = (r) => (['10', 'J', 'Q', 'K'].includes(r) ? 0 : r === 'A' ? 1 : parseInt(r, 10));

function shuffleDeck() {
  const d = [];
  for (let i = 0; i < 8; i++) for (let s = 0; s < 4; s++) for (const r of RANKS) d.push(cardValue(r));
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
const score = (cards) => cards.reduce((a, b) => a + b, 0) % 10;

function shouldBankerDraw(b, playerDrew, p3) {
  if (!playerDrew) return b <= 5;
  const v = p3 ?? 0;
  if (b <= 2) return true;
  if (b === 3) return v !== 8;
  if (b === 4) return v >= 2 && v <= 7;
  if (b === 5) return v >= 4 && v <= 7;
  if (b === 6) return v === 6 || v === 7;
  return false;
}

// ⚠️ src/app/api/bet/baccarat/route.ts の PAYOUTS と一致させること
const BACCARAT_PAYOUTS = { PLAYER: 2.0, BANKER: 1.95, TIE: 9.0 };

function baccaratReport(n) {
  const count = { PLAYER: 0, BANKER: 0, TIE: 0 };
  const net = { PLAYER: 0, BANKER: 0, TIE: 0 };

  for (let i = 0; i < n; i++) {
    const deck = shuffleDeck();
    let idx = 0;
    const draw = () => deck[idx++];
    const P = [draw(), draw()];
    const B = [draw(), draw()];
    let ps = score(P);
    let bs = score(B);

    if (!(ps >= 8 || bs >= 8)) {
      const playerDrew = ps <= 5;
      let p3;
      if (playerDrew) { p3 = draw(); P.push(p3); ps = score(P); }
      if (shouldBankerDraw(bs, playerDrew, p3)) { B.push(draw()); bs = score(B); }
    }

    const result = ps > bs ? 'PLAYER' : bs > ps ? 'BANKER' : 'TIE';
    count[result]++;

    for (const bet of ['PLAYER', 'BANKER', 'TIE']) {
      if (bet === 'TIE') net.TIE += result === 'TIE' ? BACCARAT_PAYOUTS.TIE - 1 : -1;
      else if (result === 'TIE') net[bet] += 0;              // プッシュ（掛け金返還）
      else if (bet === result) net[bet] += BACCARAT_PAYOUTS[bet] - 1;
      else net[bet] -= 1;
    }
  }

  console.log(`\n🃏 バカラ (${n.toLocaleString()}ハンド実測)`);
  for (const k of ['PLAYER', 'BANKER', 'TIE']) {
    const rtp = 1 + net[k] / n;
    console.log(`   ${k.padEnd(7)} 出現率 ${pct(count[k] / n)}  配当 x${BACCARAT_PAYOUTS[k]}  RTP ${pct(rtp)}  ハウスエッジ ${pct(1 - rtp)}`);
  }
  return count;
}

// ============================================================
// 🚀 クラッシュ  src/app/api/bet/crash/route.ts の generateCrashPoint()
// ============================================================
const CRASH_RTP = 0.96;
const CRASH_MAX_MULTIPLIER = 50;

function generateCrashPoint() {
  const r = Math.random();
  const raw = CRASH_RTP / (1 - r);
  if (raw < 1.0) return 1.0;
  return Math.floor(Math.min(CRASH_MAX_MULTIPLIER, raw) * 100) / 100;
}

function crashReport(n) {
  const points = new Float64Array(n);
  for (let i = 0; i < n; i++) points[i] = generateCrashPoint();

  console.log(`\n🚀 ポロ・クラッシュ (${n.toLocaleString()}回実測 / 利確目標ごとのRTP)`);
  console.log('   ※ RTPが目標倍率によらず一定であることが是正の狙い');
  for (const t of [1.1, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0]) {
    let win = 0;
    for (let i = 0; i < n; i++) if (points[i] >= t) win++;
    const reach = win / n;
    console.log(`   ${String(t + 'x').padEnd(6)} 到達率 ${pct(reach)}  RTP ${pct(reach * t)}  ハウスエッジ ${pct(1 - reach * t)}`);
  }
  let instant = 0;
  for (let i = 0; i < n; i++) if (points[i] === 1.0) instant++;
  console.log(`   即クラッシュ(1.00x)の発生率: ${pct(instant / n)}`);
}

// ============================================================
// 🎟️ 宝くじ  src/lib/lotteryEngine.ts
// ============================================================
function lotteryReport() {
  const TICKET_PRICE = 100;
  const REFUND_PER_TICKET = 30;
  const FIRST_PRIZE_PROB = 0.08;

  console.log('\n🎟️ 週末メガ宝くじ (1回の抽選あたりの収支・解析値)');
  console.log('   口数   売上    3等還元  2等    金庫積立  発行超過(＋はインフレ)');
  for (const T of [5, 10, 20, 50, 100]) {
    const sales = T * TICKET_PRICE;
    const refund = T * REFUND_PER_TICKET;
    const second = Math.floor(Math.min(1000, sales * 0.10));
    const contribution = Math.max(0, sales - refund - second);
    // 金庫は最終的に誰かへ払い出されるので、長期的な発行超過は
    //   払戻総額(3等 + 2等 + 積立) - 売上
    const netIssue = refund + second + contribution - sales;
    console.log(
      `   ${String(T).padStart(4)}口 ${String(sales).padStart(6)}  ${String(refund).padStart(6)}  ${String(second).padStart(5)}  ${String(contribution).padStart(7)}  ${String(netIssue).padStart(6)}`
    );
  }
  console.log(`   → 発行超過が全口数で0＝売上の範囲内でのみ配当する純粋な再分配になっている`);
  console.log(`   （1等当選確率 ${FIRST_PRIZE_PROB * 100}% は「金庫がいつ放出されるか」のみを決め、総量には影響しない）`);
}

// ============================================================
console.log('='.repeat(70));
console.log(` KTMカジノ RTPレポート  (試行回数: ${N.toLocaleString()})`);
console.log('='.repeat(70));
slotReport();
baccaratReport(N);
crashReport(N);
lotteryReport();
console.log('\n' + '='.repeat(70));
