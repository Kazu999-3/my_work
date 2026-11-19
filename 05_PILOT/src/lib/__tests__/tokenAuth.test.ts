import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExpectedToken,
  verifyToken,
  encodeSession,
  decodeAndVerifySession,
  revokeSession,
  isSessionRevoked,
  _clearMemoryRevocationListForTest,
  KNOWN_INSECURE_DEV_TOKEN,
  SESSION_MAX_AGE_MS,
  safeTimingCompare,
} from '../tokenAuth';

describe('tokenAuth & Session Security Tests (SPEC 02)', () => {
  const originalEnvToken = process.env.PILOT_SECRET_TOKEN;
  const originalSecret = process.env.PILOT_SESSION_SECRET;

  beforeEach(() => {
    _clearMemoryRevocationListForTest();
    process.env.PILOT_SECRET_TOKEN = 'valid_test_secret_token_123';
    process.env.PILOT_SESSION_SECRET = 'session_signing_secret_456';
  });

  test('getExpectedToken: 未設定時は null（全拒否）', () => {
    delete process.env.PILOT_SECRET_TOKEN;
    assert.equal(getExpectedToken(), null);
  });

  test('getExpectedToken: 公開値（KNOWN_INSECURE_DEV_TOKEN）が設定されていたら未設定扱い（全拒否）', () => {
    process.env.PILOT_SECRET_TOKEN = KNOWN_INSECURE_DEV_TOKEN;
    assert.equal(getExpectedToken(), null);
  });

  test('getExpectedToken: 正常なトークンが設定されていればその値を返す', () => {
    process.env.PILOT_SECRET_TOKEN = 'custom_strong_password_2026';
    assert.equal(getExpectedToken(), 'custom_strong_password_2026');
  });

  test('verifyToken: 合言葉の一致判定が正しく機能する', () => {
    assert.equal(verifyToken('valid_test_secret_token_123'), true);
    assert.equal(verifyToken('wrong_password'), false);
    assert.equal(verifyToken(''), false);
    assert.equal(verifyToken(null), false);
    assert.equal(verifyToken(undefined), false);
  });

  test('safeTimingCompare: タイミングセーフな比較が長さ違いや空文字でも安全に判定できる', () => {
    assert.equal(safeTimingCompare('abc', 'abc'), true);
    assert.equal(safeTimingCompare('abc', 'ab'), false);
    assert.equal(safeTimingCompare('abc', 'abcd'), false);
    assert.equal(safeTimingCompare('', ''), true);
    assert.equal(safeTimingCompare('a', 'b'), false);
  });

  test('encodeSession & decodeAndVerifySession: 正常な署名付きセッションの発行と復元', async () => {
    const sessionId = 'test-session-uuid-001';
    const now = Date.now();
    const expiresAt = now + SESSION_MAX_AGE_MS;

    const cookieValue = encodeSession(sessionId, now, expiresAt);
    assert.ok(cookieValue);
    assert.ok(cookieValue.includes('.'));

    const result = await decodeAndVerifySession(cookieValue);
    assert.equal(result.valid, true);
    assert.ok(result.session);
    assert.equal(result.session.sessionId, sessionId);
    assert.equal(result.session.createdAt, now);
    assert.equal(result.session.expiresAt, expiresAt);
    assert.equal(result.shouldSlide, false); // まだ発行直後なのでスライディング不要
  });

  test('decodeAndVerifySession: 改ざんされたセッションは拒否される', async () => {
    const sessionId = 'test-session-uuid-002';
    const now = Date.now();
    const expiresAt = now + SESSION_MAX_AGE_MS;
    const cookieValue = encodeSession(sessionId, now, expiresAt);
    assert.ok(cookieValue);

    // 署名を改ざん
    const tamperedSig = cookieValue.slice(0, -4) + '0000';
    const res1 = await decodeAndVerifySession(tamperedSig);
    assert.equal(res1.valid, false);

    // sessionIdを改ざん
    const parts = cookieValue.split('.');
    parts[0] = 'hacked-session-id';
    const tamperedPayload = parts.join('.');
    const res2 = await decodeAndVerifySession(tamperedPayload);
    assert.equal(res2.valid, false);
  });

  test('decodeAndVerifySession: 有効期限切れのセッションは拒否される', async () => {
    const sessionId = 'expired-session-003';
    const past = Date.now() - 10000; // 過去日時
    const cookieValue = encodeSession(sessionId, past - 1000, past);
    assert.ok(cookieValue);

    const result = await decodeAndVerifySession(cookieValue);
    assert.equal(result.valid, false);
  });

  test('decodeAndVerifySession: 旧形式の合言葉直入れCookieは拒否される（SPEC 02移行）', async () => {
    const oldCookieValue = 'valid_test_secret_token_123';
    const result = await decodeAndVerifySession(oldCookieValue);
    assert.equal(result.valid, false);
  });

  test('decodeAndVerifySession: 残り有効期間が15日未満の場合に shouldSlide: true を返す', async () => {
    const sessionId = 'sliding-session-004';
    const createdAt = Date.now() - 16 * 24 * 60 * 60 * 1000; // 16日前発行
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 残り14日 (< 15日)
    const cookieValue = encodeSession(sessionId, createdAt, expiresAt);
    assert.ok(cookieValue);

    const result = await decodeAndVerifySession(cookieValue);
    assert.equal(result.valid, true);
    assert.equal(result.shouldSlide, true);
  });

  test('revokeSession: サーバー側で特定セッションを失効できる', async () => {
    const sessionId = 'revoked-session-005';
    const now = Date.now();
    const expiresAt = now + SESSION_MAX_AGE_MS;
    const cookieValue = encodeSession(sessionId, now, expiresAt);

    // 失効前は有効
    const resBefore = await decodeAndVerifySession(cookieValue);
    assert.equal(resBefore.valid, true);

    // サーバー側で失効実行
    await revokeSession(sessionId);
    assert.equal(await isSessionRevoked(sessionId), true);

    // 失効後は拒否される
    const resAfter = await decodeAndVerifySession(cookieValue);
    assert.equal(resAfter.valid, false);
  });
});
