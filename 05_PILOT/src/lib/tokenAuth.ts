// 秘密URLトークン認証ヘルパー

export const PILOT_COOKIE_NAME = 'pilot_auth_token';

// ローカル開発用のフォールバックトークン
export const DEFAULT_DEV_TOKEN = 'pilot_dev_secret_2026';

export function getExpectedToken(): string {
  if (typeof process !== 'undefined' && process.env.PILOT_SECRET_TOKEN) {
    return process.env.PILOT_SECRET_TOKEN;
  }
  return DEFAULT_DEV_TOKEN;
}

export function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return token === getExpectedToken();
}
