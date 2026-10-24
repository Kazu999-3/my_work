import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { betDeadlineMs, BET_DEADLINE_MINUTES } from '../betDeadline';

describe('betDeadline tests', () => {
  test('BET_DEADLINE_MINUTES は 15 分であること', () => {
    assert.equal(BET_DEADLINE_MINUTES, 15);
  });

  test('betDeadlineMs は createdAt から正確に15分後（900,000ms）を返すこと', () => {
    const baseTime = new Date('2026-10-19T20:00:00.000Z').getTime();
    const deadline = betDeadlineMs(baseTime);
    assert.equal(deadline, baseTime + 15 * 60 * 1000);
  });

  test('文字列の ISO 日時を正しくパースして判定できること', () => {
    const isoString = '2026-10-19T12:00:00.000Z';
    const expected = new Date(isoString).getTime() + 15 * 60 * 1000;
    assert.equal(betDeadlineMs(isoString), expected);
  });

  test('15分以内なら受付中、15分超過なら締め切り済みと判定できること', () => {
    const now = Date.now();
    const createdAt10MinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const createdAt16MinAgo = new Date(now - 16 * 60 * 1000).toISOString();

    const is10MinOpen = now <= betDeadlineMs(createdAt10MinAgo);
    const is16MinOpen = now <= betDeadlineMs(createdAt16MinAgo);

    assert.equal(is10MinOpen, true, '10分前作成はまだ受付中');
    assert.equal(is16MinOpen, false, '16分前作成は締め切り超過');
  });

  test('Discord発表時刻（announcedAt）を渡して15分後判定ができること', () => {
    const now = Date.now();
    const announcedAtJustNow = new Date(now).toISOString();
    const announcedAt14MinAgo = new Date(now - 14 * 60 * 1000).toISOString();
    const announcedAt15Min1SecAgo = new Date(now - (15 * 60 + 1) * 1000).toISOString();

    assert.equal(now <= betDeadlineMs(announcedAtJustNow), true, '発表直後は受付中');
    assert.equal(now <= betDeadlineMs(announcedAt14MinAgo), true, '発表14分後は受付中');
    assert.equal(now <= betDeadlineMs(announcedAt15Min1SecAgo), false, '発表15分1秒後は締め切り');
  });
});
