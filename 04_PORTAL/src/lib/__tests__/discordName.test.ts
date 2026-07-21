import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDisplayName } from '../discordName';

// 「同じ人なのに画面によって名前が違う」不具合の再発防止。
// 優先順位: nick → global_name → username

test('サーバーのニックネームを最優先する', () => {
  const name = resolveDisplayName({
    nick: 'かず',
    user: { global_name: 'Kazurin', username: 'kazurin0' },
  });
  assert.strictEqual(name, 'かず');
});

test('ニックネーム未設定ならグローバル表示名を使う', () => {
  const name = resolveDisplayName({
    nick: null,
    user: { global_name: 'Kazurin', username: 'kazurin0' },
  });
  assert.strictEqual(name, 'Kazurin');
});

test('どちらも無ければユーザー名を使う', () => {
  const name = resolveDisplayName({ nick: null, user: { username: 'kazurin0' } });
  assert.strictEqual(name, 'kazurin0');
});

test('空文字のニックネームは未設定として扱う', () => {
  // Discordは未設定を空文字で返すことがあり、|| だけだと空欄が表示されてしまう
  const name = resolveDisplayName({
    nick: '   ',
    user: { global_name: 'Kazurin', username: 'kazurin0' },
  });
  assert.strictEqual(name, 'Kazurin');
});

test('情報が無い場合はフォールバックを返す', () => {
  assert.strictEqual(resolveDisplayName(null), 'Unknown');
  assert.strictEqual(resolveDisplayName({}), 'Unknown');
  assert.strictEqual(resolveDisplayName({}, '（不明）'), '（不明）');
});
