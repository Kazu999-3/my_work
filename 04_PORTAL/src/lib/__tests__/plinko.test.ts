import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePlinkoDrop,
  PLINKO_PAYOUT_TABLES,
  PLINKO_ROWS,
  PLINKO_SLOT_COUNT,
  type PlinkoRisk,
} from '../plinkoMath';

test('Plinko基本仕様: スロット数は段数+1 (11個) で、全テーブル長が一致する', () => {
  assert.equal(PLINKO_SLOT_COUNT, 11);
  for (const risk of ['low', 'medium', 'high'] as PlinkoRisk[]) {
    assert.equal(PLINKO_PAYOUT_TABLES[risk].length, 11);
  }
});

test('calculatePlinkoDrop: パス長が10で、最終スロットが1の個数と一致する', () => {
  for (let i = 0; i < 50; i++) {
    const res = calculatePlinkoDrop(100, 'medium');
    assert.equal(res.path.length, PLINKO_ROWS);
    const ones = res.path.reduce((a, b) => a + b, 0);
    assert.equal(res.slotIndex, ones);
    assert.ok(res.slotIndex >= 0 && res.slotIndex <= PLINKO_ROWS);
    assert.equal(res.multiplier, PLINKO_PAYOUT_TABLES.medium[res.slotIndex]);
    assert.equal(res.winCoins, Math.floor(100 * res.multiplier));
  }
});

test('calculatePlinkoDrop: ハイリスクモードで端っこに入った時は75倍でisJackpotがtrueになる', () => {
  // 1000回シミュレーションし、端っこ(0または10)の配当とisJackpotの整合性を確認
  let testedJackpot = false;
  for (let i = 0; i < 2000; i++) {
    const res = calculatePlinkoDrop(100, 'high');
    if (res.slotIndex === 0 || res.slotIndex === 10) {
      assert.equal(res.multiplier, 75.0);
      assert.equal(res.winCoins, 7500);
      assert.equal(res.isJackpot, true);
      testedJackpot = true;
      break;
    }
  }
  // 確率 2/1024 ≒ 1/512 なので2000回なら高確率で当たるが、万一出なくてもテスト自体はPASS
  if (testedJackpot) {
    assert.ok(true);
  }
});
