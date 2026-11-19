import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, isLoginBlocked, MAX_LOGIN_ATTEMPTS } from '../loginRateLimit';

describe('loginRateLimit & IP Verification Tests (SPEC 02)', () => {
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
});
