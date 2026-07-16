/**
 * 管理者セッション（パスワード認証専用・Discord OAuth非依存）
 *
 * HttpOnly Cookieに「有効期限 + HMAC署名」を持たせた軽量セッショントークンを発行する。
 * 外部JWTライブラリは使わず、Node標準の crypto(HMAC-SHA256) のみで署名検証する。
 * 全ての /admin/* ページ・/api/admin/* ルートはこれ1本に統一し、
 * Discord OAuth (adminAuth.ts の verifyAdminSession) には依存しない。
 */
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12時間

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET (または ADMIN_PASSWORD) が.envに設定されていません。');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/** ログイン成功時に呼び出し、Cookieにセットする値そのもの（"payload.signature"形式）を返す */
export function createSessionToken(): { token: string; maxAgeSec: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expiresAt}`;
  const signature = sign(payload);
  return { token: `${payload}.${signature}`, maxAgeSec: SESSION_TTL_MS / 1000 };
}

/** Cookie文字列（またはヘッダーから取り出した値）を検証する */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = sign(payload);

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return false;
  } catch {
    return false;
  }

  const match = payload.match(/^admin:(\d+)$/);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  return Date.now() < expiresAt;
}

export const ADMIN_SESSION_COOKIE = COOKIE_NAME;

/** APIルート(Route Handler)内でNextRequestから検証する共通関数。adminAuth.tsのDiscord版を置き換える。 */
export async function verifyAdminSession(req: Request): Promise<{ ok: boolean; error?: string }> {
  // Cron等、パスワードセッションを持てない呼び出し元用の抜け道は維持
  const cronSecret = req.headers.get('x-cron-secret') || '';
  const expectedCronSecret = process.env.CRON_SECRET || '';
  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    return { ok: true };
  }

  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;

  if (verifySessionToken(token)) return { ok: true };
  return { ok: false, error: '認証セッションが無効または期限切れです。/login から再ログインしてください。' };
}
