import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlaystyle } from '../playstyle';

describe('Playstyle Engine Unit Tests', () => {
  it('空配列のとき安全なデフォルト値（50/50）を返すこと', () => {
    const result = calculatePlaystyle([]);
    assert.equal(result.sliders.aggressive, 50);
    assert.equal(result.sliders.supportive, 50);
    assert.equal(result.tags.length, 0);
  });

  it('高キル数・アグレッシブな試合で early-brawler タグが付与されること', () => {
    const matches = [
      { kills: 8, deaths: 3, assists: 2, damage_dealt: 25000, game_duration: 1800, win: true },
      { kills: 7, deaths: 4, assists: 1, damage_dealt: 22000, game_duration: 1800, win: true },
    ];
    const result = calculatePlaystyle(matches, { reliableCsAndFb: false });
    assert.ok(result.sliders.aggressive > 50, 'aggressive should be above 50');
    const hasEarlyBrawler = result.tags.some(t => t.id === 'early-brawler');
    assert.ok(hasEarlyBrawler, 'early-brawler tag should be assigned');
  });

  it('高アシスト・高ビジョンで supportive-guardian タグが付与されること', () => {
    const matches = [
      { kills: 0, deaths: 2, assists: 15, damage_dealt: 5000, vision_score: 50, game_duration: 1800, win: true },
      { kills: 1, deaths: 1, assists: 12, damage_dealt: 6000, vision_score: 45, game_duration: 1800, win: true },
    ];
    const result = calculatePlaystyle(matches, { reliableCsAndFb: false });
    assert.ok(result.sliders.supportive >= 70, 'supportive score should be high');
    const hasSupportive = result.tags.some(t => t.id === 'supportive-guardian');
    assert.ok(hasSupportive, 'supportive-guardian tag should be assigned');
  });

  it('3戦以上・勝率70%以上のときに hot-streak タグが付与されること', () => {
    const matches = [
      { kills: 5, deaths: 2, assists: 5, damage_dealt: 15000, game_duration: 1800, win: true },
      { kills: 4, deaths: 3, assists: 6, damage_dealt: 14000, game_duration: 1800, win: true },
      { kills: 6, deaths: 1, assists: 8, damage_dealt: 16000, game_duration: 1800, win: true },
    ];
    const result = calculatePlaystyle(matches, { reliableCsAndFb: false });
    const hasHotStreak = result.tags.some(t => t.id === 'hot-streak');
    assert.ok(hasHotStreak, 'hot-streak tag should be assigned');
  });

  it('特徴的なタグに該当しない場合 balanced-player にフォールバックすること', () => {
    const matches = [
      { kills: 3, deaths: 4, assists: 4, damage_dealt: 10000, vision_score: 15, game_duration: 1800, win: false },
      { kills: 4, deaths: 4, assists: 3, damage_dealt: 11000, vision_score: 15, game_duration: 1800, win: false },
    ];
    const result = calculatePlaystyle(matches, { reliableCsAndFb: false });
    const hasBalanced = result.tags.some(t => t.id === 'balanced-player');
    assert.ok(hasBalanced, 'balanced-player tag should be assigned as fallback');
  });

  it('reliableCsAndFb: false の時に CS・FB・diffs が除外されること', () => {
    const matches = [
      { kills: 3, deaths: 2, assists: 5, damage_dealt: 10000, cs: 150, first_blood: true, game_duration: 1800, win: true },
    ];
    const result = calculatePlaystyle(matches, { reliableCsAndFb: false });
    assert.equal(result.sliders.farming, undefined);
    assert.equal(result.diffs, undefined);
  });
});
