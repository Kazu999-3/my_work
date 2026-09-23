/**
 * minesMath.ts（ブッシュ・スカウトの配当計算）のユニットテスト。
 *
 * このゲームは「どこでやめるか」をプレイヤーが決めるため、還元率は1つの数字では決まらず
 * 「どのマス数で利確しても期待値が同じ」ことによって初めて 95% が保証される。
 * 単に倍率表を目視するだけでは崩れに気づけないので、全ての地雷数 × 全ての開封数について
 * 期待値を機械的に検証する。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MINES_GRID_SIZE,
  MINES_RTP,
  MINES_MAX_PAYOUT,
  MINES_ALLOWED_MINE_COUNTS,
  MINES_ALLOWED_BETS,
  survivalProbability,
  fairMultiplier,
  payoutMultiplier,
  payoutCoins,
  maxRevealCount,
  multiplierTable,
} from '../minesMath';

test('生存確率: 0マスなら1、安全マスを超えると0', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    const safeTiles = MINES_GRID_SIZE - mines;
    assert.equal(survivalProbability(mines, 0), 1);
    assert.ok(survivalProbability(mines, safeTiles) > 0, '全安全マスを開ける確率は0より大きい');
    assert.equal(survivalProbability(mines, safeTiles + 1), 0, '安全マスより多くは開けられない');
  }
});

test('生存確率: 手計算した値と一致する', () => {
  // 地雷3個で1マス開ける = 22/25
  assert.ok(Math.abs(survivalProbability(3, 1) - 22 / 25) < 1e-12);
  // 地雷3個で2マス開ける = (22/25) * (21/24)
  assert.ok(Math.abs(survivalProbability(3, 2) - (22 / 25) * (21 / 24)) < 1e-12);
  // 地雷1個で24マス（全安全マス）開ける = 1/25
  assert.ok(Math.abs(survivalProbability(1, 24) - 1 / 25) < 1e-12);
});

test('配当倍率は開封数に対して常に増加し、1.00倍を下回らない', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    const safeTiles = MINES_GRID_SIZE - mines;
    let prev = 0;
    for (let n = 1; n <= safeTiles; n++) {
      const m = payoutMultiplier(mines, n);
      assert.ok(m >= 1, `地雷${mines}個/${n}マスの倍率が元本割れしている: ${m}`);
      assert.ok(m > prev, `地雷${mines}個/${n}マスで倍率が増えていない: ${prev} -> ${m}`);
      prev = m;
    }
  }
});

test('どのマス数で利確しても期待値は賭け金の約95%になる', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    const safeTiles = MINES_GRID_SIZE - mines;
    for (let n = 1; n <= safeTiles; n++) {
      const ev = survivalProbability(mines, n) * payoutMultiplier(mines, n);
      // 倍率を小数第2位で切り捨てているぶん、95%をわずかに下回る方向へずれる。
      // 逆に上振れ（プレイヤー有利）は地雷1個・1マスの元返し保証のケースのみ。
      assert.ok(
        ev <= MINES_RTP + 0.012 && ev >= MINES_RTP - 0.02,
        `地雷${mines}個/${n}マスの期待値が95%から離れている: ${ev.toFixed(4)}`
      );
    }
  }
});

test('公平倍率は還元率を掛ける前の値であり、配当倍率より必ず大きい', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    for (let n = 2; n <= MINES_GRID_SIZE - mines; n++) {
      assert.ok(fairMultiplier(mines, n) > payoutMultiplier(mines, n));
    }
  }
});

test('払い戻しは上限（50,000コイン）を超えない', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    for (const bet of MINES_ALLOWED_BETS) {
      for (let n = 1; n <= MINES_GRID_SIZE - mines; n++) {
        assert.ok(
          payoutCoins(bet, mines, n) <= MINES_MAX_PAYOUT,
          `地雷${mines}個/ベット${bet}/${n}マスで上限超過`
        );
      }
    }
  }
});

test('開けられる上限マス数は、上限額を超えない範囲で最大になっている', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    for (const bet of MINES_ALLOWED_BETS) {
      const max = maxRevealCount(mines, bet);
      assert.ok(max >= 1, '最低1マスは開けられること');
      assert.ok(max <= MINES_GRID_SIZE - mines, '安全マス数を超えないこと');

      // 上限マス数までは上限額に収まる
      assert.ok(Math.floor(bet * payoutMultiplier(mines, max)) <= MINES_MAX_PAYOUT);

      // もう1マス開けると上限を超える（＝これ以上伸ばせないところまで伸ばしている）
      if (max < MINES_GRID_SIZE - mines) {
        assert.ok(
          Math.floor(bet * payoutMultiplier(mines, max + 1)) > MINES_MAX_PAYOUT,
          `地雷${mines}個/ベット${bet}: まだ伸ばせるのに ${max} マスで打ち切っている`
        );
      }
    }
  }
});

test('倍率表は上限マス数ぶんの行を持ち、表示倍率と払い戻し額が一致する', () => {
  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    for (const bet of MINES_ALLOWED_BETS) {
      const table = multiplierTable(mines, bet);
      assert.equal(table.length, maxRevealCount(mines, bet));
      for (const row of table) {
        assert.equal(row.payout, payoutCoins(bet, mines, row.revealCount));
        assert.equal(row.multiplier, payoutMultiplier(mines, row.revealCount));
      }
    }
  }
});

/** 0..24 を Fisher-Yates で完全シャッフルして返す */
function shuffled(): number[] {
  const tiles = Array.from({ length: MINES_GRID_SIZE }, (_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

test('モンテカルロ: 実効還元率が95%付近に収まる（各戦略20万ラウンド）', () => {
  // 「nマス開けたら必ず利確する」という固定戦略で実際に盤面を引いてシミュレーションする。
  // 期待値の計算式が正しくても、盤面の生成（重複しない地雷配置）が偏っていれば破綻するため、
  // 確率計算とは独立に抽選を回して確かめる。
  const ROUNDS = 200000;
  const BET = 100;

  for (const mines of MINES_ALLOWED_MINE_COUNTS) {
    const targets = [1, 3, Math.min(6, MINES_GRID_SIZE - mines)];
    for (const target of targets) {
      if (target > maxRevealCount(mines, BET)) continue;

      let wagered = 0;
      let returned = 0;

      for (let r = 0; r < ROUNDS; r++) {
        // 盤面生成（api/bet/mines と同じ方式: 0..24 をシャッフルして先頭 mines 個を地雷にする）
        const minePositions = new Set(shuffled().slice(0, mines));

        wagered += BET;

        // プレイヤーが開けるマスは盤面とは独立に選ばれるので、別のシャッフルを引く
        const picks = shuffled();
        let survived = true;
        for (let k = 0; k < target; k++) {
          if (minePositions.has(picks[k])) {
            survived = false;
            break;
          }
        }
        if (survived) returned += payoutCoins(BET, mines, target);
      }

      const rtp = returned / wagered;
      assert.ok(
        rtp > 0.92 && rtp < 0.98,
        `地雷${mines}個/${target}マス利確の実効還元率が想定外: ${(rtp * 100).toFixed(2)}%`
      );
    }
  }
});
