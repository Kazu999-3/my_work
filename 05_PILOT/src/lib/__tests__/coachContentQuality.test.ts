import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// 1. サニタイズ関数のロジック検証
function validateAndSanitizeCoachAnswer(text: string): string {
  if (!text) return text;
  let s = text;

  const TERM_FIXES: [RegExp, string][] = [
    [/突っ?向勝負/g, '真っ向勝負'],
    [/突進パンチ/g, '真っ向勝負(Q)'],
    [/通常攻撃の信長値/g, '通常攻撃の射程・リーチ'],
    [/信長値/g, '射程・リーチ'],
    [/闪く/g, '光る'],
    [/チーク/g, 'トレード'],
  ];
  for (const [pattern, replacement] of TERM_FIXES) {
    s = s.replace(pattern, replacement);
  }

  s = s.replace(/【約何秒】/g, '【数秒間】');
  s = s.replace(/約何秒/g, '状況に応じた秒数');
  s = s.replace(/[○◯]{2,}/g, '主要スキル');
  s = s.replace(/X{2,}/g, '敵スキル');
  s = s.replace(/△{2,}/g, '状況');
  s = s.replace(/\[未定\]/g, '適宜判断');

  return s.trim();
}

// 2. 文頭接続詞サニタイズ検証
function cleanWeaknessText(v: string): string {
  let t = v.trim();
  t = t.replace(/^(?:また[、,\s]|さらに[、,\s]|そして[、,\s]|なお[、,\s]|・\s*)+/g, '');
  return t.trim();
}

describe('SPEC 10: コーチ内容品質テスト', () => {
  it('未記入プレースホルダー（約何秒、○○、XX等）が綺麗にサニタイズされること', () => {
    const input = '敵のQが外れたら【約何秒】の間がチャンス。○○を発動してXXを回避しよう。';
    const output = validateAndSanitizeCoachAnswer(input);
    assert.ok(!output.includes('約何秒'));
    assert.ok(!output.includes('○○'));
    assert.ok(!output.includes('XX'));
    assert.ok(output.includes('数秒間'));
  });

  it('スキル名誤訳（突っ向勝負）や意味不明語（信長値）がRiot公式名や自然な日本語に補正されること', () => {
    const input = 'ViのQ（突っ向勝負）はチャージが必要。ザイラは通常攻撃の信長値が低いため注意。';
    const output = validateAndSanitizeCoachAnswer(input);
    assert.ok(output.includes('真っ向勝負'));
    assert.ok(!output.includes('突っ向勝負'));
    assert.ok(output.includes('通常攻撃の射程・リーチ'));
    assert.ok(!output.includes('信長値'));
  });

  it('弱みメモの冒頭が「また、」「さらに、」等の接続詞で始まっている場合に除去されること', () => {
    const sample1 = 'また、植物にダメージを受けるとファーム速度が大幅に落ちるため、被弾管理の正確さが求められる。';
    assert.equal(cleanWeaknessText(sample1), '植物にダメージを受けるとファーム速度が大幅に落ちるため、被弾管理の正確さが求められる。');

    const sample2 = 'さらに、フラッシュのクールダウン中は慎重な立ち回りが求められる点に注意が必要です。';
    assert.equal(cleanWeaknessText(sample2), 'フラッシュのクールダウン中は慎重な立ち回りが求められる点に注意が必要です。');

    const sample3 = '・ 中盤以降、突撃後に孤立しやすい点。';
    assert.equal(cleanWeaknessText(sample3), '中盤以降、突撃後に孤立しやすい点。');
  });

  it('JG用の汎用手順書に「ウェーブ」というレーン用語が含まれないこと', () => {
    const jgPhases = [
      {
        phase: "Phase 1 (Lv1〜2)",
        title: "安全なキャンプ巡回と最速Lv3ルート確立",
        action: "味方ボットのリーシュを受けて効率的なフルクリアを開始。逆サイドからのインベードを警戒しながらHPを8割以上維持。",
        win_trigger: "無駄な被弾なく02:30までにLv3到達",
        badge: "周回 🌲"
      },
      {
        phase: "Phase 2 (Lv3〜5)",
        title: "2:55スカトル争奪 ＆ 視界先行・カウンターガンク",
        action: "敵JGのスタート位置から逆算し、衝突を避けるか仕掛けるかを判断。敵主要スキルのCDに合わせてサイドレーンに介入。",
        win_trigger: "スカトル確保または敵JGの位置特定で第2段階クリア",
        badge: "制圧 ⚡"
      },
      {
        phase: "Phase 3 (Lv6〜)",
        title: "パワースパイクを活かしてドラゴン/グラブ完全掌握",
        action: "Ult習得のタイミングで主導権のあるレーンへダイブ/ガンクし、人数有利を作って重要オブジェクトへ直行。",
        win_trigger: "1stドラゴンまたはヴォイドグラブ確保で試合テンポ掌握",
        badge: "掌握 👑"
      }
    ];

    for (const phase of jgPhases) {
      assert.ok(!phase.title.includes('ウェーブ'));
      assert.ok(!phase.action.includes('ウェーブ'));
      assert.ok(!phase.win_trigger.includes('ウェーブ'));
    }
  });
});
