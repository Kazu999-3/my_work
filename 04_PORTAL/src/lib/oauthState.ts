// Discord ログインの state（戻り先と使い捨ての合言葉）を作る・確かめる（2026-10-19）。
// 以前は state に戻り先しか入れておらず、
//   - 戻り先をそのまま `${baseUrl}${returnTo}` に繋げていたため、`@evil.com` 等を渡すとログイン後に外部サイトへ飛ばせた
//   - 合言葉が無く、他人のログインコードを踏ませて攻撃者のアカウントでログインさせられた（ログイン CSRF）

export const OAUTH_STATE_COOKIE = 'ktm_oauth_state';
export const OAUTH_STATE_MAX_AGE_SEC = 10 * 60;

/** 自サイト内のパス（`/` 始まりで、`//` や `/\` で他サイトにならない物）だけを戻り先として認める */
export function safeReturnTo(value: unknown, fallback = '/casino'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}

export function encodeOAuthState(returnTo: string, nonce: string): string {
  return Buffer.from(JSON.stringify({ returnTo: safeReturnTo(returnTo), nonce })).toString('base64url');
}

export function decodeOAuthState(state: string | null): { returnTo: string; nonce: string | null } {
  if (!state) return { returnTo: '/casino', nonce: null };
  try {
    // 以前の base64（+/=）で作られた state も読めるように、両方を受け付ける
    const json = Buffer.from(state.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return { returnTo: safeReturnTo(parsed?.returnTo), nonce: typeof parsed?.nonce === 'string' ? parsed.nonce : null };
  } catch {
    return { returnTo: '/casino', nonce: null };
  }
}
