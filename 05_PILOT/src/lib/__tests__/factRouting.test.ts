import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateFactCategories } from '@/app/admin/review/_review/factRouting';

describe('estimateFactCategories Unit Tests', () => {
  it('Lvやパワースパイクに関する記述から power_spikes を推定できること', () => {
    const text = 'Lv3でEが揃った時点で本格的なパワースパイクを迎える。序盤のダメージ差を突く。';
    const categories = estimateFactCategories(text);
    const keys = categories.map((c) => c.key);
    assert.ok(keys.includes('power_spikes'), 'power_spikes が検出されること');
  });

  it('靴やアイテム購入に関する記述から build_runes を推定できること', () => {
    const text = '初手でソーサラーシューズを急ぎ、1コアにロケットベルトを積むのが鉄板ビルド。';
    const categories = estimateFactCategories(text);
    const keys = categories.map((c) => c.key);
    assert.ok(keys.includes('build_runes'), 'build_runes が検出されること');
  });

  it('強みやバーストに関する記述から strengths を推定できること', () => {
    const text = '圧倒的なバーストダメージと一方的トレードが最大の強み。';
    const categories = estimateFactCategories(text);
    const keys = categories.map((c) => c.key);
    assert.ok(keys.includes('strengths'), 'strengths が検出されること');
  });

  it('空文字や該当キーワードがない場合は空配列を返すこと', () => {
    assert.deepEqual(estimateFactCategories(''), []);
    assert.deepEqual(estimateFactCategories('こんにちは'), []);
  });
});
