import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectChampionsFromText } from '../championDetector';

describe('championDetector', () => {
  it('タイトルから日本語チャンピオン名を検出できる', () => {
    const res = detectChampionsFromText('【LoL】チョガスIS S+ TIER TO CLIMB NOW：究極のジャングル・チョガス攻略バイブル');
    assert.equal(res.main?.id, 'Chogath');
    assert.equal(res.main?.nameJa, 'チョ＝ガス');
  });

  it('タイトルから英語チャンピオン名を検出できる', () => {
    const res = detectChampionsFromText('I FIRST TIMED QIYANA IN MASTERS...HERE WHAT HAPPENED');
    assert.equal(res.main?.id, 'Qiyana');
    assert.equal(res.main?.nameJa, 'キヤナ');
  });

  it('「A vs B」構文から主役と対面相手を分離検出できる', () => {
    const res = detectChampionsFromText('【SHG Evi直伝】コーキ vs トリンダメア完全攻略バイブル：グラマス帯を破壊するマクロ');
    assert.equal(res.main?.id, 'Corki');
    assert.equal(res.main?.nameJa, 'コーキ');
    assert.equal(res.enemy?.id, 'Tryndamere');
    assert.equal(res.enemy?.nameJa, 'トリンダメア');
  });

  it('エイリアス（マスターイー / Yi）を正しく検出できる', () => {
    const res = detectChampionsFromText('Master Yiでチャレンジャー帯を駆け上がる！序盤から中盤のジャングル支配術');
    assert.equal(res.main?.id, 'MasterYi');
    assert.equal(res.main?.nameJa, 'マスター・イー');
  });

  it('タイトルにチャンプ名が無い場合、要約テキストからフォールバック検出できる', () => {
    const title = 'チャレンジャー直伝の悪魔の罠：敵をハメるカジャン戦術';
    const summary = '本動画の核心は、ノクターンの序盤の主導権とカジャンの釣り餌について解説しています。';
    const res = detectChampionsFromText(title, summary);
    assert.equal(res.main?.id, 'Nocturne');
    assert.equal(res.main?.nameJa, 'ノクターン');
  });

  it('カタカナ単語（リセット、ルール等）で短いチャンプ名（セト、ルル）が誤爆しない', () => {
    const res = detectChampionsFromText('【1分Tips】リセットのタイミングと効率的なジャングルキャンプの回り方ルール');
    assert.equal(res.main, undefined, 'リセットやルールでセトやルルに誤爆しないこと');
  });
});
