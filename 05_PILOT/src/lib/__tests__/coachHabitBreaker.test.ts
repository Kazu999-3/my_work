import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditPlayerHabits, DeathEvent } from '../coachHabitBreaker';

describe('2026 Coach Habit Breaker Engine Tests', () => {
  it('ドラゴン直前（4:40）とバロン直前（19:30）にデスした場合、OBJECTIVE_PRE_THROW（最悪癖）と判定されること', () => {
    const deaths: DeathEvent[] = [
      { timestampSec: 280 }, // 4分40秒 (05:00ドラゴンの20秒前)
      { timestampSec: 1170 }, // 19分30秒 (20:00バロンの30秒前)
      { timestampSec: 1500 },
    ];

    const result = auditPlayerHabits(deaths, 'JUNGLE');
    assert.equal(result.objectiveThrowDeaths.length, 2);
    assert.equal(result.primaryHabitTrap.code, 'OBJECTIVE_PRE_THROW');
    assert.equal(result.primaryHabitTrap.severity, 'CRITICAL');
    assert.ok(result.primaryHabitTrap.nextGameActionRule.includes('45秒前'));
  });

  it('02:55カニ以前にデスした場合、EARLY_PATH_COLLAPSEと判定されること', () => {
    const deaths: DeathEvent[] = [
      { timestampSec: 130 }, // 2分10秒 (初動ファイト)
    ];

    const result = auditPlayerHabits(deaths, 'JUNGLE');
    assert.equal(result.primaryHabitTrap.code, 'EARLY_PATH_COLLAPSE');
    assert.ok(result.primaryHabitTrap.nextGameActionRule.includes('02:55スカトル'));
  });

  it('危険なタイミングのデスがない場合、CLEAN_PLAYと判定されること', () => {
    const deaths: DeathEvent[] = [
      { timestampSec: 420 }, // 7分00秒
      { timestampSec: 950 }, // 15分50秒
    ];

    const result = auditPlayerHabits(deaths, 'JUNGLE');
    assert.equal(result.primaryHabitTrap.code, 'CLEAN_PLAY');
  });
});
