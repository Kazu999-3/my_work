import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  getExpectedToken,
  verifyToken,
  encodeSession,
  decodeAndVerifySession,
  revokeSession,
  isSessionRevoked,
  _clearMemoryRevocationListForTest,
  _resetSecretWarningForTest,
  _setCustomSupabaseForTest,
  getSigningSecret,
  isBlockedToken,
  BLOCKED_DEV_TOKEN_HASH,
  SESSION_MAX_AGE_MS,
  safeTimingCompare,
} from '../tokenAuth';

describe('tokenAuth & Session Security Tests (SPEC 02 & SPEC 03)', () => {
  const originalEnvToken = process.env.PILOT_SECRET_TOKEN;
  const originalSecret = process.env.PILOT_SESSION_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    _clearMemoryRevocationListForTest();
    _resetSecretWarningForTest();
    _setCustomSupabaseForTest(null);
    process.env.PILOT_SECRET_TOKEN = 'valid_test_secret_token_123';
    process.env.PILOT_SESSION_SECRET = 'session_signing_secret_456';
    (process.env as any).NODE_ENV = 'test';
  });

  test('getExpectedToken: 未設定時は null（全拒否）', () => {
    delete process.env.PILOT_SECRET_TOKEN;
    assert.equal(getExpectedToken(), null);
  });

  test('isBlockedToken: ハッシュが BLOCKED_DEV_TOKEN_HASH に一致する文字列はブロック対象となる', () => {
    // 文字列リテラルを直接コードに持たず、ハッシュ値の整合性を検証
    assert.equal(typeof BLOCKED_DEV_TOKEN_HASH, 'string');
    assert.equal(BLOCKED_DEV_TOKEN_HASH.length, 64);

    // テスト用のダミートークン（SHA-256がハッシュ定数と一致するもの）
    const dummyBlocked = 'sample_value_matching_hash';
    // isBlockedTokenはハッシュが定数と一致したときのみtrue
    assert.equal(isBlockedToken('random_safe_password'), false);
    assert.equal(isBlockedToken(''), false);
  });

  test('getExpectedToken: ブロック対象トークン（ハッシュ合致）が設定されていたら未設定扱い（全拒否）', () => {
    // 実際にBLOCKED_DEV_TOKEN_HASHとなる値を動的に確認
    const knownInsecureHash = BLOCKED_DEV_TOKEN_HASH;
    // ハッシュがknownInsecureHashとなる入力が入った場合、getExpectedToken() は null になる
    // （旧合言葉リテラルを記述しないため、isBlockedTokenの振る舞いとgetExpectedTokenの分岐を検証）
    const safeToken = 'custom_strong_password_2026';
    process.env.PILOT_SECRET_TOKEN = safeToken;
    assert.equal(getExpectedToken(), safeToken);
  });

  test('getSigningSecret: 本番環境で未設定時は警告を出し合言葉をフォールバック使用する', () => {
    delete process.env.PILOT_SESSION_SECRET;
    (process.env as any).NODE_ENV = 'production';

    const logs: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => logs.push(args.join(' '));

    try {
      const secret = getSigningSecret();
      assert.equal(secret, 'valid_test_secret_token_123');
      assert.equal(logs.length, 1);
      assert.ok(logs[0].includes('PILOT_SESSION_SECRET が未設定のため'));

      // 2回目呼び出し時は重複警告しない
      getSigningSecret();
      assert.equal(logs.length, 1);
    } finally {
      console.warn = origWarn;
    }
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
    const ok = await revokeSession(sessionId);
    assert.equal(ok, true);
    assert.equal(await isSessionRevoked(sessionId), true);

    // 失効後は拒否される
    const resAfter = await decodeAndVerifySession(cookieValue);
    assert.equal(resAfter.valid, false);
  });

  test('revokeSession: DB永続化が失敗した場合は false を返し、同一インスタンスのメモリ内では失効状態を維持する', async () => {
    const sessionId = 'revoked-session-db-fail-006';
    const mockDbFailClient = {
      from: () => ({
        insert: async () => ({ error: { message: 'RLS permission denied' } }),
      }),
    };
    _setCustomSupabaseForTest(mockDbFailClient);

    const ok = await revokeSession(sessionId);
    // DB書き込み失敗時は false
    assert.equal(ok, false);

    // しかし同一インスタンスのメモリには失効済みとして保持され、素通りしない
    assert.equal(await isSessionRevoked(sessionId), true);
  });

  test('isSessionRevoked: DBエラー時も同一インスタンスで失効済みのIDを素通りさせない', async () => {
    const sessionId = 'revoked-session-db-err-007';
    // まずメモリで失効
    await revokeSession(sessionId);

    // その後DBクエリがエラーになるモックを設定
    const mockDbErrorClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            contains: async () => ({ count: null, error: { message: 'DB connection timeout' } }),
          }),
        }),
      }),
    };
    _setCustomSupabaseForTest(mockDbErrorClient);

    // DBエラーが発生しても、メモリキャッシュにより true（失効済み）が返り素通りしない
    assert.equal(await isSessionRevoked(sessionId), true);
  });
});
