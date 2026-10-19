import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectMission, targetFor, isAchieved, metricsFromParticipant, MISSION_METRIC_BY_KEY, type MatchMetrics } from '../missionLoop';

const m = (o: Partial<MatchMetrics>): MatchMetrics => ({
  deaths: 5, cs_per_min: 7, vision_per_min: 1, control_wards_bought: 1, kill_participation: 50, damage_share: 25, ...o,
});

describe('missionLoop', () => {
  it('目標ランク平均との差が一番大きい指標を選ぶ', () => {
    const recent = [m({ deaths: 8 }), m({ deaths: 7 }), m({ deaths: 9 })];
    const plan = selectMission({ role: 'MIDDLE', recent, benchmark: { deaths: 5, cs_per_min: 7, vision_per_min: 1, control_wards_bought: 1, kill_participation: 50, damage_share: 25 }, history: [] });
    assert.equal(plan?.metric, 'deaths');
    assert.equal(plan?.baseline, 8);
    assert.equal(plan?.target, 6); // (8+5)/2=6.5 → 6回以下
  });

  it('サポートには CS/分 とダメージ割合の課題を出さない', () => {
    const recent = [m({ cs_per_min: 1 }), m({ cs_per_min: 1 }), m({ cs_per_min: 1 })];
    const plan = selectMission({ role: 'UTILITY', recent, benchmark: { cs_per_min: 7 }, history: [] });
    assert.notEqual(plan?.metric, 'cs_per_min');
    assert.notEqual(plan?.metric, 'damage_share');
  });

  it('2回続けて達成するまでは同じ課題を続け、達成したら次へ', () => {
    const recent = [m({ deaths: 8 }), m({ deaths: 8 }), m({ deaths: 8, vision_per_min: 0.5 })];
    const bench = { deaths: 5, vision_per_min: 1.2 };
    const once = selectMission({ role: 'TOP', recent, benchmark: bench, history: [{ metric: 'vision_per_min', status: 'achieved' }] });
    assert.equal(once?.metric, 'vision_per_min');
    const twice = selectMission({ role: 'TOP', recent, benchmark: bench, history: [{ metric: 'vision_per_min', status: 'achieved' }, { metric: 'vision_per_min', status: 'achieved' }] });
    assert.equal(twice?.metric, 'deaths');
  });

  it('3回続けて届かなければ別の課題へ移る', () => {
    const recent = [m({ deaths: 8 }), m({ deaths: 8 }), m({ deaths: 8, vision_per_min: 0.5 })];
    const missed = { metric: 'deaths' as const, status: 'missed' as const };
    const p2 = selectMission({ role: 'TOP', recent, benchmark: { deaths: 5, vision_per_min: 1.2 }, history: [missed, missed] });
    assert.equal(p2?.metric, 'deaths');
    const p3 = selectMission({ role: 'TOP', recent, benchmark: { deaths: 5, vision_per_min: 1.2 }, history: [missed, missed, missed] });
    assert.notEqual(p3?.metric, 'deaths');
  });

  it('外した指標は選ばない・試合数が足りなければ出さない', () => {
    const recent = [m({ deaths: 8 }), m({ deaths: 8 }), m({ deaths: 8 })];
    const p = selectMission({ role: 'TOP', recent, benchmark: { deaths: 5 }, history: [], exclude: ['deaths'] });
    assert.notEqual(p?.metric, 'deaths');
    assert.equal(selectMission({ role: 'TOP', recent: recent.slice(0, 2), benchmark: null, history: [] }), null);
  });

  it('整数の指標は今より確実に1つ良い値を目標にする', () => {
    assert.equal(targetFor(MISSION_METRIC_BY_KEY.control_wards_bought, 0.4, 1.0), 1);
    assert.equal(targetFor(MISSION_METRIC_BY_KEY.deaths, 5.2, 5.0), 5);
    assert.equal(targetFor(MISSION_METRIC_BY_KEY.deaths, 5.0, null), 4);
    assert.equal(targetFor(MISSION_METRIC_BY_KEY.cs_per_min, 6.0, null), 6.6);
    assert.equal(targetFor(MISSION_METRIC_BY_KEY.cs_per_min, 7.5, 7.0), 8.3); // 平均を上回っている→1割上積み
  });

  it('達成判定は指標の向きに従う', () => {
    assert.equal(isAchieved('deaths', 4, 4), true);
    assert.equal(isAchieved('deaths', 5, 4), false);
    assert.equal(isAchieved('cs_per_min', 6.4, 6.4), true);
  });

  it('試合詳細から指標を計算する', () => {
    const me = { kills: 3, deaths: 2, assists: 5, totalMinionsKilled: 150, neutralMinionsKilled: 30, visionScore: 30, visionWardsBoughtInGame: 2, damageDealtToChampions: 10000, teamId: 100 };
    const team = [me, { kills: 7, damageDealtToChampions: 30000, teamId: 100 }, { kills: 9, damageDealtToChampions: 1, teamId: 200 }];
    const r = metricsFromParticipant(me, team, 1800);
    assert.deepEqual(r, { deaths: 2, cs_per_min: 6, vision_per_min: 1, control_wards_bought: 2, kill_participation: 80, damage_share: 25 });
  });
});
