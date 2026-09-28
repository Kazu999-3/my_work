/**
 * 一般ユーザーのログインセッション（ktm_user_session）の発行・検証。
 *
 * 以前はJSONをbase64にしただけの無署名Cookieで、ブラウザでCookieを手書きすれば
 * 任意のメンバー・管理者になりすませた（2026-09-29発覚）。adminSession.tsと同じ
 * HMAC-SHA256で署名し、"base64url(JSON).署名" 形式にする。
 * 署名対象には "user:" を前置し、admin_session("admin:<期限>")の署名と取り違えないようにする。
 *
 * ⚠️ proxy.ts(Edge Runtime)に同じ検証ロジックをWeb Cryptoで再実装している。
 * 形式・署名対象を変える場合は両方を同時に更新すること。
 */
import { createHmac, timingSafeEqual } from 'crypto';

export const USER_SESSION_COOKIE = 'ktm_user_session';
export const USER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30日間

const OWNER_DISCORD_ID = '697220229964759130';

export interface UserSessionData {
  discordId: string;
  username: string;
  displayName: string;
  avatar?: string;
  coins?: number;
  rank?: string;
  isAdmin?: boolean;
  loggedInAt: number;
}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET (または ADMIN_PASSWORD) が.envに設定されていません。');
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getSecret()).update(`user:${encodedPayload}`).digest('hex');
}

/** 管理者判定はDiscord IDのみで行う（表示名・ユーザー名による判定は偽装できるため廃止） */
export function isAdminDiscordId(discordId: string | null | undefined): boolean {
  if (!discordId) return false;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || OWNER_DISCORD_ID)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(discordId) || discordId === OWNER_DISCORD_ID;
}

export function encodeUserSession(data: UserSessionData): string {
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/** 署名と有効期限を検証し、正当なセッションだけを返す（不正・期限切れ・旧形式はnull） */
export function decodeUserSession(value: string | undefined | null): UserSessionData | null {
  if (!value) return null;
  const lastDot = value.lastIndexOf('.');
  if (lastDot <= 0) return null;

  const encoded = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(sign(encoded), 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (!data || typeof data.discordId !== 'string' || !data.discordId) return null;
    if (typeof data.loggedInAt !== 'number' || Date.now() - data.loggedInAt > USER_SESSION_MAX_AGE_SEC * 1000) {
      return null;
    }
    return data as UserSessionData;
  } catch {
    return null;
  }
}
