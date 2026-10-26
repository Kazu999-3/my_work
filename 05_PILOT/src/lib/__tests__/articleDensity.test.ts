import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessArticleDensity, stripArticleChrome, extractArticleSummary } from '../articleDensity';

const HEADER = '> 📺 **元動画情報**\n> - **動画タイトル**: x\n> - **動画リンク**: [https://youtu.be/abc](https://youtu.be/abc)\n\n---\n\n';

describe('articleDensity', () => {
  it('元動画情報とリンクURLを本文から除く', () => {
    const body = stripArticleChrome(HEADER + '本文 [▶ 02:15](https://youtu.be/abc?t=135) です');
    assert.ok(!body.includes('元動画情報'));
    assert.ok(!body.includes('https://'));
  });

  it('具体的な記述が無い長文は薄い', () => {
    const generic = '集団戦では状況に応じて判断することが重要です。しっかり意識しましょう。'.repeat(30);
    const r = assessArticleDensity(HEADER + generic);
    assert.equal(r.level, 'thin');
    assert.ok(r.reasons.length > 0);
  });

  it('数値・スキル順が多い記事は薄くない', () => {
    const dense = '3:15 に Lv3 で Q → E を入れる。2コア完成の 14分 までに 2回 ドラゴンを狙う。CS は 10分 で 80。'.repeat(10);
    const r = assessArticleDensity(HEADER + dense);
    assert.equal(r.level, 'ok');
    assert.ok(r.specificPer1k > 5);
  });

  it('新しい解析は事実の件数で判定する', () => {
    const dense = '3:15 に Lv3 で Q → E。'.repeat(20);
    assert.equal(assessArticleDensity(dense, { fact_count: 3 }).level, 'thin');
    assert.equal(assessArticleDensity(dense, { fact_count: 12 }).level, 'ok');
  });

  it('旧形式で「現パッチ」とある記事は薄い扱い', () => {
    const legacy = '# 🏆 X 究極完全攻略バイブル\n現パッチの仕様に準拠。' + '3分 に Lv2。'.repeat(40);
    const r = assessArticleDensity(legacy);
    assert.equal(r.legacyTemplate, true);
    assert.equal(r.level, 'thin');
  });

  it('分割知見と Shorts は短くても密度では判定しない', () => {
    assert.equal(assessArticleDensity('短い知見', null, { isAtomic: true }).level, 'ok');
    assert.equal(assessArticleDensity('意識しましょう。'.repeat(80), null, { isShort: true }).level, 'ok');
  });

  it('extractArticleSummary: 元動画ヘッダーを除き、核心段落を抽出する', () => {
    const raw = `> 📺 **元動画情報**
> - **動画タイトル**: テスト
> - **動画リンク**: [https://youtu.be/xyz](https://youtu.be/xyz)

---

# 🏆 テストタイトル

## 1. 📌 本質テーマ＆戦術コンセプト
カジャンの真の目的は敵を動かすための釣り餌である。相手の森を荒らすこと自体が主目的ではない。

## 2. 🛡️ 立ち回り
その他`;
    const summary = extractArticleSummary(raw);
    assert.ok(!summary.includes('元動画情報'));
    assert.ok(!summary.includes('https://'));
    assert.ok(summary.includes('カジャンの真の目的は敵を動かすための釣り餌である'));
  });
});
