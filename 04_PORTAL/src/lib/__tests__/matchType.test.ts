import test from 'node:test';
import assert from 'node:assert/strict';
import { getMatchType, isNormalMatch, isEventMatch } from '../matchType';

test('matchType: match_type カラムが明示されている場合はそれを最優先する', () => {
  assert.equal(getMatchType({ match_type: 'EVENT' }), 'EVENT');
  assert.equal(getMatchType({ match_type: 'NORMAL' }), 'NORMAL');
  assert.equal(getMatchType({ match_type: 'TOURNAMENT' }), 'TOURNAMENT');
  assert.equal(getMatchType({ match_type: 'event' }), 'EVENT');
});

test('matchType: 旧データ（riot_match_id === EXHIBITION）は EVENT として判定される', () => {
  assert.equal(getMatchType({ riot_match_id: 'EXHIBITION', winning_team: 'DRAW' }), 'EVENT');
  assert.equal(isNormalMatch({ riot_match_id: 'EXHIBITION' }), false);
  assert.equal(isEventMatch({ riot_match_id: 'EXHIBITION' }), true);
});

test('matchType: 旧データ（winning_team === DRAW）は EVENT として判定される', () => {
  assert.equal(getMatchType({ winning_team: 'DRAW' }), 'EVENT');
  assert.equal(isNormalMatch({ winning_team: 'DRAW' }), false);
  assert.equal(isEventMatch({ winning_team: 'DRAW' }), true);
});

test('matchType: 通常のカスタム戦は NORMAL として判定される', () => {
  const normalMatch = {
    riot_match_id: '609617813',
    winning_team: 'BLUE',
  };
  assert.equal(getMatchType(normalMatch), 'NORMAL');
  assert.equal(isNormalMatch(normalMatch), true);
  assert.equal(isEventMatch(normalMatch), false);
});

test('matchType: null や undefined、空オブジェクトでも安全に NORMAL を返す', () => {
  assert.equal(getMatchType(null), 'NORMAL');
  assert.equal(getMatchType(undefined), 'NORMAL');
  assert.equal(getMatchType({}), 'NORMAL');
  assert.equal(isNormalMatch(null), true);
  assert.equal(isEventMatch(null), false);
});
