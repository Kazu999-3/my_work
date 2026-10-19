/**
 * Discord ログインの戻り先・state の検証（lib/oauthState.ts）。
 * 戻り先は `${baseUrl}${returnTo}` に繋げるため、自サイト内のパス以外を通すとログイン後に外部サイトへ飛ばせてしまう。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo, encodeOAuthState, decodeOAuthState } from '../oauthState';

test('safeReturnTo: 自サイト内のパスはそのまま通す', () => {
  assert.equal(safeReturnTo('/casino'), '/casino');
  assert.equal(safeReturnTo('/player/abc?tab=1'), '/player/abc?tab=1');
});

test('safeReturnTo: 外部サイトになり得る値は既定値に戻す', () => {
  for (const bad of ['@evil.com', '.evil.com/x', '//evil.com', '/\\evil.com', 'https://evil.com', '', null, undefined, 123, '/a\r\nSet-Cookie: x=1']) {
    assert.equal(safeReturnTo(bad as any), '/casino', String(bad));
  }
});

test('state: 作った値を読み戻せる（戻り先と合言葉）', () => {
  const s = encodeOAuthState('/mentorship', 'nonce-1');
  assert.deepEqual(decodeOAuthState(s), { returnTo: '/mentorship', nonce: 'nonce-1' });
});

test('state: 改ざんされた戻り先は既定値になり、壊れた state は合言葉なし扱い', () => {
  const forged = Buffer.from(JSON.stringify({ returnTo: '@evil.com', nonce: 'n' })).toString('base64');
  assert.deepEqual(decodeOAuthState(forged), { returnTo: '/casino', nonce: 'n' });
  assert.deepEqual(decodeOAuthState('not-json'), { returnTo: '/casino', nonce: null });
  assert.deepEqual(decodeOAuthState(null), { returnTo: '/casino', nonce: null });
});
