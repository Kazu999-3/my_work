import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHedgeBet, summarizeUserBet, ExistingBetItem } from '../betValidation';

test('ベット履歴がない場合: 両建てではない', () => {
  const bets: ExistingBetItem[] = [];
  const result = checkHedgeBet(bets, { discordId: '12345', name: 'PlayerA' }, 'BLUE');
  assert.equal(result.isHedge, false);
  assert.equal(result.oppositeTeam, undefined);
});

test('BLUEにベット済みのユーザーがREDにベットしようとした場合: 両建て検出 (isHedge: true, oppositeTeam: BLUE)', () => {
  const bets: ExistingBetItem[] = [
    { discord_id: '12345', player_name: 'PlayerA', team: 'BLUE', amount: 100, round_id: 'round-1' }
  ];
  const result = checkHedgeBet(bets, { discordId: '12345', name: 'PlayerA' }, 'RED', 'round-1');
  assert.equal(result.isHedge, true);
  assert.equal(result.oppositeTeam, 'BLUE');
});

test('BLUEにベット済みのユーザーがBLUEに追加ベットしようとした場合: 両建てではない (isHedge: false)', () => {
  const bets: ExistingBetItem[] = [
    { discord_id: '12345', player_name: 'PlayerA', team: 'BLUE', amount: 100, round_id: 'round-1' }
  ];
  const result = checkHedgeBet(bets, { discordId: '12345', name: 'PlayerA' }, 'BLUE', 'round-1');
  assert.equal(result.isHedge, false);
});

test('別ラウンドのベット履歴がある場合: 同一ラウンドでなければ両建てではない', () => {
  const bets: ExistingBetItem[] = [
    { discord_id: '12345', player_name: 'PlayerA', team: 'BLUE', amount: 100, round_id: 'old-round' }
  ];
  const result = checkHedgeBet(bets, { discordId: '12345', name: 'PlayerA' }, 'RED', 'new-round');
  assert.equal(result.isHedge, false);
});

test('名前のみ一致（Discord ID未連携等）でも両建てを検出できる', () => {
  const bets: ExistingBetItem[] = [
    { player_name: 'PlayerB', team: 'RED', amount: 300 }
  ];
  const result = checkHedgeBet(bets, { name: 'PlayerB' }, 'BLUE');
  assert.equal(result.isHedge, true);
  assert.equal(result.oppositeTeam, 'RED');
});

test('summarizeUserBet: ユーザーの現在の投票状況を正確にサマリーする', () => {
  const bets: ExistingBetItem[] = [
    { discord_id: '12345', player_name: 'PlayerA', team: 'BLUE', amount: 100 },
    { discord_id: '12345', player_name: 'PlayerA', team: 'BLUE', amount: 200 },
    { discord_id: '99999', player_name: 'OtherPlayer', team: 'RED', amount: 500 }
  ];
  const summary = summarizeUserBet(bets, { discordId: '12345', name: 'PlayerA' });
  assert.deepEqual(summary, { team: 'BLUE', amount: 300 });

  const otherSummary = summarizeUserBet(bets, { discordId: '99999', name: 'OtherPlayer' });
  assert.deepEqual(otherSummary, { team: 'RED', amount: 500 });

  const noBetSummary = summarizeUserBet(bets, { discordId: '00000', name: 'NoBet' });
  assert.equal(noBetSummary, null);
});
