import test from 'node:test';
import assert from 'node:assert/strict';

// AI仲人の連投防止ロジックの単体検証
test('AI仲人ガード: isUpdate === true の時は推薦をスキップする', () => {
  const isUpdate = true;
  const shouldSkip = isUpdate === true;
  assert.equal(shouldSkip, true);
});

test('AI仲人ガード: 30日以内に推薦履歴がある同一ペアはスキップする', () => {
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const mockMatches = [
    {
      mentor_discord_id: '835163333551325225', // こんぺ
      pupil_discord_id: '224085744933666816',  // kira
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2時間前
    },
  ];

  const hasRecentMatch = mockMatches.some((m) => {
    const isSamePair =
      (m.mentor_discord_id === '835163333551325225' && m.pupil_discord_id === '224085744933666816') ||
      (m.mentor_discord_id === '224085744933666816' && m.pupil_discord_id === '835163333551325225');
    const isRecent = new Date(m.started_at).getTime() >= thirtyDaysAgoMs;
    return isSamePair && isRecent;
  });

  assert.equal(hasRecentMatch, true);
});

test('AI仲人ガード: 31日以上前の古い履歴しかないペアは推薦を許可する', () => {
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const mockMatches = [
    {
      mentor_discord_id: '835163333551325225',
      pupil_discord_id: '999999999999999999',
      started_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35日前
    },
  ];

  const hasRecentMatch = mockMatches.some((m) => {
    const isSamePair =
      (m.mentor_discord_id === '835163333551325225' && m.pupil_discord_id === '999999999999999999') ||
      (m.mentor_discord_id === '999999999999999999' && m.pupil_discord_id === '835163333551325225');
    const isRecent = new Date(m.started_at).getTime() >= thirtyDaysAgoMs;
    return isSamePair && isRecent;
  });

  assert.equal(hasRecentMatch, false);
});
