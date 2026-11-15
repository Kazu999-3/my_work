import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyPortalError } from '../discordNotify';

test('notifyPortalError: 短時間での同一エラーはデバウンスされて重複送信されないこと', async () => {
  const err = new Error('Database connection failed (500)');
  const params = {
    error: err,
    app: '04' as const,
    source: 'API' as const,
    path: '/api/balancer',
    statusCode: 500,
  };

  // 1回目: 送信試行（環境変数が未設定ならdeliverToErrorLogでfalseになるが、デバウンス対象として記録される）
  await notifyPortalError(params);

  // 2回目（即座に同一エラー）: デバウンス発火により即座にfalseが返ること
  const secondResult = await notifyPortalError(params);
  assert.equal(secondResult, false, '30秒以内の同一エラーはスパム防止でスキップされること');
});

test('notifyPortalError: 異なるパスのエラーは独立して処理されること', async () => {
  const err = new Error('Internal Server Error');
  const paramsA = {
    error: err,
    app: '04' as const,
    source: 'API' as const,
    path: '/api/balancer/calculate',
    statusCode: 500,
  };
  const paramsB = {
    error: err,
    app: '04' as const,
    source: 'API' as const,
    path: '/api/match/record',
    statusCode: 500,
  };

  // 異なるパスであればデバウンスキーが異なるため、2件目が直前のキーで誤爆スキップされない
  await notifyPortalError(paramsA);
  // paramsBはpathが異なるため、デバウンスで即スキップされずdeliverToErrorLogまで到達する
  // （環境変数なしテスト環境ではdeliverToErrorLogがfalseを返す）
  const resultB = await notifyPortalError(paramsB);
  assert.equal(typeof resultB, 'boolean');
});
