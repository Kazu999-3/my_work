import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOURNAMENT_DRAFT_SEQUENCE } from '../../app/festival/pick/FestivalTournamentDraftModal';

test('TOURNAMENT_DRAFT_SEQUENCE: 10ステップでBlue 5体・Red 5体を公式順序で配分すること', () => {
  assert.equal(TOURNAMENT_DRAFT_SEQUENCE.length, 10);

  const blueSteps = TOURNAMENT_DRAFT_SEQUENCE.filter((s) => s.team === 'BLUE');
  const redSteps = TOURNAMENT_DRAFT_SEQUENCE.filter((s) => s.team === 'RED');

  assert.equal(blueSteps.length, 5);
  assert.equal(redSteps.length, 5);

  // Blueのスロット0..4が過不足なく出現すること
  const blueSlots = blueSteps.map((s) => s.slot).sort();
  assert.deepEqual(blueSlots, [0, 1, 2, 3, 4]);

  // Redのスロット0..4が過不足なく出現すること
  const redSlots = redSteps.map((s) => s.slot).sort();
  assert.deepEqual(redSlots, [0, 1, 2, 3, 4]);

  // 公式大会シーケンス順: B1 -> R1,R2 -> B2,B3 -> R3,R4 -> B4,B5 -> R5
  const expectedLabels = ['B1', 'R1', 'R2', 'B2', 'B3', 'R3', 'R4', 'B4', 'B5', 'R5'];
  const actualLabels = TOURNAMENT_DRAFT_SEQUENCE.map((s) => s.label);
  assert.deepEqual(actualLabels, expectedLabels);
});
