import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clientIp,
  isLoginBlocked,
  recordLoginFailure,
  MAX_LOGIN_ATTEMPTS,
  _setSupabaseForTest,
} from '../loginRateLimit';

describe('loginRateLimit & IP Verification Tests (SPEC 02 & SPEC 03)', () => {
  beforeEach(() => {
    _setSupabaseForTest(null);
  });

  test('clientIp: x-forwarded-for の先頭（VercelクライアントIP）を最優先で取得する', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18, 150.172.238.178');
    headers.set('x-real-ip', '70.41.3.18');
    assert.equal(clientIp(headers), '203.0.113.195');
  });

  test('clientIp: x-forwarded-for が単一IPの場合も正しく取得する', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', ' 198.51.100.42 ');
    assert.equal(clientIp(headers), '198.51.100.42');
  });

  test('clientIp: x-forwarded-for が無い場合は x-vercel-forwarded-for や x-real-ip にフォールバックする', () => {
    const headers1 = new Headers();
    headers1.set('x-vercel-forwarded-for', '192.0.2.1');
    assert.equal(clientIp(headers1), '192.0.2.1');

    const headers2 = new Headers();
    headers2.set('x-real-ip', '192.0.2.2');
    assert.equal(clientIp(headers2), '192.0.2.2');

    const headers3 = new Headers();
    headers3.set('cf-connecting-ip', '192.0.2.3');
    assert.equal(clientIp(headers3), '192.0.2.3');
  });

  test('clientIp: IP関連ヘッダーが一切無い場合は unknown を返す', () => {
    const headers = new Headers();
    assert.equal(clientIp(headers), 'unknown');
  });

  test('MAX_LOGIN_ATTEMPTS は 10 回であること', () => {
    assert.equal(MAX_LOGIN_ATTEMPTS, 10);
  });

  // SPEC 03 追加テスト: fail-closed & 境界値
  test('isLoginBlocked: 基盤（Supabase）が利用できない場合は fail-closed (blocked: true, unavailable: true) となる', async () => {
    // customClient が null（テスト環境では未初期化）
    const res = await isLoginBlocked('192.0.2.100');
    assert.equal(res.blocked, true);
    assert.equal(res.unavailable, true);
  });

  test('isLoginBlocked: DBクエリがエラーとなった場合も fail-closed (blocked: true, unavailable: true) となる', async () => {
    const mockErrorClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            contains: () => ({
              gt: async () => ({ count: null, error: { message: 'DB connection refused' } }),
            }),
          }),
        }),
      }),
    };
    _setSupabaseForTest(mockErrorClient);

    const res = await isLoginBlocked('192.0.2.101');
    assert.equal(res.blocked, true);
    assert.equal(res.unavailable, true);
  });

  test('isLoginBlocked: 失敗回数が上限未満（9回）の境界ケースでは blocked: false, remainingAttempts: 1 を返す', async () => {
    const mockCount9Client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            contains: () => ({
              gt: async () => ({ count: 9, error: null }),
            }),
          }),
        }),
      }),
    };
    _setSupabaseForTest(mockCount9Client);

    const res = await isLoginBlocked('192.0.2.102');
    assert.equal(res.blocked, false);
    assert.equal(res.remainingAttempts, 1);
    assert.equal(res.unavailable, undefined);
  });

  test('isLoginBlocked: 失敗回数が上限ちょうど（10回）の境界ケースでは blocked: true, remainingAttempts: 0 を返す', async () => {
    const mockCount10Client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            contains: () => ({
              gt: async () => ({ count: 10, error: null }),
            }),
          }),
        }),
      }),
    };
    _setSupabaseForTest(mockCount10Client);

    const res = await isLoginBlocked('192.0.2.103');
    assert.equal(res.blocked, true);
    assert.equal(res.remainingAttempts, 0);
  });

  test('isLoginBlocked: 失敗回数が上限超過（15回）の場合も blocked: true, remainingAttempts: 0 を返す', async () => {
    const mockCount15Client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            contains: () => ({
              gt: async () => ({ count: 15, error: null }),
            }),
          }),
        }),
      }),
    };
    _setSupabaseForTest(mockCount15Client);

    const res = await isLoginBlocked('192.0.2.104');
    assert.equal(res.blocked, true);
    assert.equal(res.remainingAttempts, 0);
  });

  test('recordLoginFailure: DB利用不可時は ok: false を返す', async () => {
    // 未設定時
    const res = await recordLoginFailure('192.0.2.105');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'DATABASE_CLIENT_UNAVAILABLE');
  });

  test('recordLoginFailure: DB挿入成功時は ok: true を返す', async () => {
    const mockSuccessClient = {
      from: () => ({
        insert: async () => ({ error: null }),
      }),
    };
    _setSupabaseForTest(mockSuccessClient);

    const res = await recordLoginFailure('192.0.2.106');
    assert.equal(res.ok, true);
  });
});
