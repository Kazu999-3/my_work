import test from 'node:test';
import assert from 'node:assert/strict';

test('Lolalytics API: レスポンス構造の定義確認', () => {
  const dummyResponse = {
    success: true,
    source: 'Lolalytics',
    champion: { id: 'Aatrox', name: 'エイトロックス', lane: 'TOP' },
    stats: { rank: 1, winRate: 52.29, pickRate: 4.46, banRate: 5.92, games: 257152 },
    matchups: {
      favorable: [{ id: 'DrMundo', name: 'ドクター・ムンド', winRate: 56.14, games: 6648 }],
      difficult: [{ id: 'Singed', name: 'シンジド', winRate: 46.70, games: 4122 }]
    }
  };

  assert.equal(dummyResponse.success, true);
  assert.equal(dummyResponse.matchups.favorable[0].name, 'ドクター・ムンド');
  assert.ok(dummyResponse.matchups.favorable[0].winRate > 50);
  assert.ok(dummyResponse.matchups.difficult[0].winRate < 50);
});
