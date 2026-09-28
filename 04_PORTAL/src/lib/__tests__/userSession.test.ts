import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

process.env.ADMIN_SESSION_SECRET = 'test-secret';
process.env.ADMIN_DISCORD_IDS = '697220229964759130';

import { encodeUserSession, decodeUserSession, isAdminDiscordId } from '../userSession';
import { proxy } from '../../proxy';

const OWNER = '697220229964759130';
const base = { username: 'u', displayName: 'かずき', loggedInAt: Date.now() };

test('署名付きセッションは往復でき、日本語の表示名も壊れない', () => {
  const s = decodeUserSession(encodeUserSession({ ...base, discordId: '111' }));
  assert.equal(s?.discordId, '111');
  assert.equal(s?.displayName, 'かずき');
});

test('中身を書き換えたセッションは拒否される', () => {
  const token = encodeUserSession({ ...base, discordId: '111' });
  const [, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...base, discordId: OWNER })).toString('base64url');
  assert.equal(decodeUserSession(`${forged}.${sig}`), null);
});

test('旧形式(無署名base64)のCookieは拒否される', () => {
  const legacy = Buffer.from(JSON.stringify({ ...base, discordId: OWNER, isAdmin: true })).toString('base64');
  assert.equal(decodeUserSession(legacy), null);
});

test('30日を過ぎたセッションは拒否される', () => {
  const old = encodeUserSession({ ...base, discordId: '111', loggedInAt: Date.now() - 31 * 24 * 3600 * 1000 });
  assert.equal(decodeUserSession(old), null);
});

test('管理者判定はDiscord IDのみ(表示名「かずき」では管理者にならない)', () => {
  assert.equal(isAdminDiscordId(OWNER), true);
  assert.equal(isAdminDiscordId('111'), false);
});

async function proxyStatus(cookie: string) {
  const req = new NextRequest('https://example.com/api/admin/anything', { headers: { cookie } });
  const res = await proxy(req);
  return res.status;
}

test('proxy: 正規の管理者セッションは管理APIを通過する', async () => {
  const token = encodeUserSession({ ...base, discordId: OWNER });
  assert.equal(await proxyStatus(`ktm_user_session=${encodeURIComponent(token)}`), 200);
});

test('proxy: 管理者でない正規セッション・偽造セッション・旧形式は401', async () => {
  const member = encodeUserSession({ ...base, discordId: '111' });
  assert.equal(await proxyStatus(`ktm_user_session=${encodeURIComponent(member)}`), 401);

  const [, sig] = member.split('.');
  const forged = Buffer.from(JSON.stringify({ ...base, discordId: OWNER })).toString('base64url');
  assert.equal(await proxyStatus(`ktm_user_session=${forged}.${sig}`), 401);

  const legacy = Buffer.from(JSON.stringify({ ...base, discordId: OWNER, isAdmin: true })).toString('base64');
  assert.equal(await proxyStatus(`ktm_user_session=${encodeURIComponent(legacy)}`), 401);
});
