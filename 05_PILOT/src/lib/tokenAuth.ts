import type { NextResponse } from 'next/server';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { supabase } from './supabaseClient';

// 秘密トークン ＆ 署名付きセッション認証ヘルパー（proxy.ts と /api/auth/* から使う）
export const PILOT_SESSION_COOKIE = 'pilot_session';
/** @deprecated 旧形式Cookie名。SPEC 02移行により全無効化 */
export const PILOT_COOKIE_NAME = 'pilot_auth_token';

// 過去にコード上に公開されていた開発用合言葉（ブラックリスト）。
// 環境変数にこの値が設定されていた場合は未設定扱い（全拒否）にする。
export const KNOWN_INSECURE_DEV_TOKEN = 'pilot_dev_secret_2026';

// セッション有効期限: 30日間（スライディング更新対応）
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30日 (秒)
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SEC * 1000;
export const SESSION_SLIDE_THRESHOLD_MS = SESSION_MAX_AGE_MS / 2; // 残り15日未満で自動延長

export interface SessionPayload {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

/** インメモリ失効キャッシュ（DBアクセス削減およびテスト用） */
const memoryRevokedSessions = new Set<string>();

/** 期待する合言葉。未設定または公開ブラックリスト値なら null（＝全リクエスト拒否） */
export function getExpectedToken(): string | null {
  const configured = process.env.PILOT_SECRET_TOKEN?.trim();
  if (!configured) return null;
  if (configured === KNOWN_INSECURE_DEV_TOKEN) {
    console.error('[tokenAuth] ⚠️ PILOT_SECRET_TOKEN に過去の公開値が設定されています。安全のため全リクエストを拒否します。');
    return null;
  }
  return configured;
}

/** 署名用シークレット。専用シークレットまたは合言葉を使用 */
function getSigningSecret(): string | null {
  return process.env.PILOT_SESSION_SECRET?.trim() || getExpectedToken();
}

/** 文字列比較の所要時間から文字数を推測されない安全な比較 */
export function safeTimingCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf-8');
  const bBuf = Buffer.from(b, 'utf-8');
  if (aBuf.length !== bBuf.length) {
    // 長さが異なる場合もダミー比較を行ってタイミング差を隠蔽
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/** 合言葉の一致判定（ログイン時専用） */
export function verifyToken(inputToken: string | null | undefined): boolean {
  const expected = getExpectedToken();
  if (!inputToken || !expected) return false;
  return safeTimingCompare(inputToken, expected);
}

/** セッション文字列に署名 */
function signPayload(sessionId: string, createdAt: number, expiresAt: number, secret: string): string {
  const data = `pilot-sess:${sessionId}:${createdAt}:${expiresAt}`;
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** 署名付きセッションCookie文字列を生成 */
export function encodeSession(sessionId: string, createdAt: number, expiresAt: number): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const signature = signPayload(sessionId, createdAt, expiresAt, secret);
  return `${sessionId}.${createdAt}.${expiresAt}.${signature}`;
}

/** 署名付きセッションCookie文字列をパース＆検証（未失効・期限内か） */
export async function decodeAndVerifySession(
  cookieValue: string | null | undefined,
): Promise<{ valid: boolean; session?: SessionPayload; shouldSlide?: boolean }> {
  if (!cookieValue) return { valid: false };

  const parts = cookieValue.split('.');
  if (parts.length !== 4) return { valid: false };

  const [sessionId, rawCreatedAt, rawExpiresAt, signature] = parts;
  const createdAt = Number(rawCreatedAt);
  const expiresAt = Number(rawExpiresAt);

  if (!sessionId || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || !signature) {
    return { valid: false };
  }

  // 有効期限切れチェック
  const now = Date.now();
  if (now > expiresAt) return { valid: false };

  const secret = getSigningSecret();
  if (!secret) return { valid: false };

  // 署名検証
  const expectedSignature = signPayload(sessionId, createdAt, expiresAt, secret);
  if (!safeTimingCompare(signature, expectedSignature)) {
    return { valid: false };
  }

  // サーバー側失効チェック
  if (await isSessionRevoked(sessionId)) {
    return { valid: false };
  }

  // スライディング更新が必要か判定（残り有効期間が半分未満）
  const shouldSlide = expiresAt - now < SESSION_SLIDE_THRESHOLD_MS;

  return {
    valid: true,
    session: { sessionId, createdAt, expiresAt },
    shouldSlide,
  };
}

/** サーバー側で特定セッションを失効させる */
export async function revokeSession(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  memoryRevokedSessions.add(sessionId);

  if (supabase) {
    try {
      await supabase.from('edge_tasks').insert({
        task_type: 'pilot_session_revocation',
        status: 'completed',
        payload: { sessionId, revokedAt: new Date().toISOString() },
      });
      return true;
    } catch (e) {
      console.error('[tokenAuth] セッション失効のDB永続化に失敗:', e);
      // メモリ側には入っているのでそのまま進む
    }
  }
  return true;
}

/** セッションが失効しているか確認 */
export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  if (!sessionId) return true;
  if (memoryRevokedSessions.has(sessionId)) return true;

  if (supabase) {
    try {
      const { count } = await supabase
        .from('edge_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('task_type', 'pilot_session_revocation')
        .contains('payload', { sessionId });
      if ((count || 0) > 0) {
        memoryRevokedSessions.add(sessionId);
        return true;
      }
    } catch {
      // DBアクセスエラー時は安全側に倒さず署名検証結果を優先（またはフェイル）
    }
  }
  return false;
}

/** テスト用: メモリ失効リストのクリア */
export function _clearMemoryRevocationListForTest() {
  memoryRevokedSessions.clear();
}

/** ログイン成功時にランダムセッションを発行してCookieにセットする */
export function setAuthCookie(res: NextResponse): { sessionId: string; expiresAt: number } | null {
  const sessionId = randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_MAX_AGE_MS;

  const cookieValue = encodeSession(sessionId, createdAt, expiresAt);
  if (!cookieValue) return null;

  res.cookies.set(PILOT_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });

  return { sessionId, expiresAt };
}

/** スライディング更新用: 既存のsessionIdを維持して有効期限を再延長したCookieをセットする */
export function slideSessionCookie(res: NextResponse, currentSession: SessionPayload): void {
  const createdAt = currentSession.createdAt;
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;

  const cookieValue = encodeSession(currentSession.sessionId, createdAt, expiresAt);
  if (!cookieValue) return;

  res.cookies.set(PILOT_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

/** ログアウト時用: Cookie削除 */
export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(PILOT_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  // 旧形式Cookieも併せて削除
  res.cookies.set(PILOT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
