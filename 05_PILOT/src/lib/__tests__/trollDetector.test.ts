import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAlliesTroll, type RawParticipant } from '../trollDetector';

const MY_PUUID = 'puuid-me';
const ALLY_PUUID = 'puuid-ally-1';

function makeParticipant(overrides: Partial<RawParticipant> = {}): RawParticipant {
  return {
    puuid: 'puuid-other',
    teamId: 100,
    championName: 'Ahri',
    lane: 'MIDDLE',
    teamPosition: 'MIDDLE',
    kills: 3,
    deaths: 3,
    assists: 4,
    damageDealtToChampions: 15000,
    totalMinionsKilled: 150,
    neutralMinionsKilled: 10,
    champLevel: 14,
    item0: 3020, // Sorcerer's Shoes
    item1: 3089, // Rabadon
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    ...overrides,
  };
}

test('通常試合: トロールがいない場合は detected: false を返す', () => {
  const me = makeParticipant({ puuid: MY_PUUID, championName: 'Jinx', lane: 'BOTTOM' });
  const ally1 = makeParticipant({ puuid: ALLY_PUUID, championName: 'Lulu', lane: 'UTILITY' });
  const ally2 = makeParticipant({ puuid: 'p2', championName: 'Darius', lane: 'TOP' });
  const ally3 = makeParticipant({ puuid: 'p3', championName: 'LeeSin', lane: 'JUNGLE' });
  const ally4 = makeParticipant({ puuid: 'p4', championName: 'Syndra', lane: 'MIDDLE' });

  const result = detectAlliesTroll([me, ally1, ally2, ally3, ally4], MY_PUUID, 1500);
  assert.equal(result.detected, false);
  assert.equal(result.severity, 'none');
  assert.equal(result.trollPlayer, null);
});

test('トロールビルド: 靴を2足以上購入している味方をsevere検出する', () => {
  const me = makeParticipant({ puuid: MY_PUUID });
  const trollAlly = makeParticipant({
    puuid: ALLY_PUUID,
    championName: 'Yasuo',
    lane: 'MIDDLE',
    item0: 3006, // Berserker's Greaves
    item1: 3009, // Boots of Swiftness
  });

  const result = detectAlliesTroll([me, trollAlly], MY_PUUID, 1200);
  assert.equal(result.detected, true);
  assert.equal(result.severity, 'severe');
  assert.ok(result.reasons.some((r) => r.includes('靴を2足購入')));
  assert.equal(result.trollPlayer?.championName, 'Yasuo');
});

test('意図的利敵(Inting): 0/14/1で分間0.6デス以上の味方をsevere検出する', () => {
  const me = makeParticipant({ puuid: MY_PUUID, kills: 5, assists: 2 });
  const intingAlly = makeParticipant({
    puuid: ALLY_PUUID,
    championName: 'Nunu',
    lane: 'JUNGLE',
    kills: 0,
    deaths: 14,
    assists: 1,
    damageDealtToChampions: 1200,
  });

  // 20分（1200秒）で14デス = 分間0.7デス
  const result = detectAlliesTroll([me, intingAlly], MY_PUUID, 1200);
  assert.equal(result.detected, true);
  assert.equal(result.severity, 'severe');
  assert.ok(result.reasons.some((r) => r.includes('デス頻度') || r.includes('大量デス')));
  assert.equal(result.trollPlayer?.championName, 'Nunu');
});

test('放置・AFK: 20分試合でLv4の味方をsevere検出する', () => {
  const me = makeParticipant({ puuid: MY_PUUID });
  const afkAlly = makeParticipant({
    puuid: ALLY_PUUID,
    championName: 'Teemo',
    lane: 'TOP',
    champLevel: 4,
    damageDealtToChampions: 350,
  });

  const result = detectAlliesTroll([me, afkAlly], MY_PUUID, 1200);
  assert.equal(result.detected, true);
  assert.equal(result.severity, 'severe');
  assert.ok(result.reasons.some((r) => r.includes('実質AFK')));
});

test('敵チームのトロールには反応しない（味方のみを検出対象とする）', () => {
  const me = makeParticipant({ puuid: MY_PUUID, teamId: 100 });
  const enemyTroll = makeParticipant({
    puuid: 'enemy-1',
    teamId: 200, // 敵チーム
    championName: 'Sion',
    deaths: 20,
    item0: 1001,
    item1: 3006,
  });

  const result = detectAlliesTroll([me, enemyTroll], MY_PUUID, 1200);
  assert.equal(result.detected, false);
});
