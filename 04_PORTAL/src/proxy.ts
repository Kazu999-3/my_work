import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16はMiddlewareの概念を"proxy"(この関数)に置き換えた。
// middleware.tsとproxy.tsを両方置くとビルドエラーになるため、
// /admin・/api/adminのCookie認証ゲートはここに実装する。
//
// Edge Runtimeで動くため Node の`crypto`は使わず Web Crypto(SubtleCrypto)で
// adminSession.ts と同じ HMAC-SHA256 署名検証ロジックを再実装している
// （検証アルゴリズムを変える場合は両方を同時に更新すること）。

const ADMIN_SESSION_COOKIE = 'admin_session';

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// adminSession.ts(Node crypto.timingSafeEqual)と同じ非タイミング攻撃の意図だが、
// Edge RuntimeにはNodeのtimingSafeEqual相当が無いため、早期リターンしない定数時間の
// XOR比較を自前実装する。以前は`signature !== expected`という通常の文字列比較のままで、
// 一次認証ゲート側だけタイミング安全性の対策が漏れていた(2026-08-05発覚)。
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function isValidAdminSession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqualHex(signature, expected)) return false;

  const match = payload.match(/^admin:(\d+)$/);
  if (!match) return false;
  return Date.now() < Number(match[1]);
}

// lib/userSession.ts と同じ「base64url(JSON).HMAC("user:"+base64url)」形式を検証する。
// 以前は無署名のJSONを信用しており、Cookieを手書きするだけで管理画面に入れた(2026-09-29修正)。
const USER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const OWNER_DISCORD_ID = '697220229964759130';

function decodeBase64UrlUtf8(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function isValidDiscordAdminSession(sessionCookie: string | undefined, secret: string): Promise<boolean> {
  if (!sessionCookie) return false;
  try {
    const value = decodeURIComponent(sessionCookie);
    const lastDot = value.lastIndexOf('.');
    if (lastDot <= 0) return false;
    const encoded = value.slice(0, lastDot);
    const signature = value.slice(lastDot + 1);
    const expected = await hmacSha256Hex(secret, `user:${encoded}`);
    if (!timingSafeEqualHex(signature, expected)) return false;

    const session = JSON.parse(decodeBase64UrlUtf8(encoded));
    if (!session || typeof session.discordId !== 'string') return false;
    if (typeof session.loggedInAt !== 'number' || Date.now() - session.loggedInAt > USER_SESSION_MAX_AGE_MS) return false;

    const adminIds = (process.env.ADMIN_DISCORD_IDS || OWNER_DISCORD_ID).split(',').map((s) => s.trim()).filter(Boolean);
    return adminIds.includes(session.discordId) || session.discordId === OWNER_DISCORD_ID;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // /login ページ自体はそのまま通す
  if (path.startsWith('/login')) {
    return NextResponse.next();
  }

  const isAdminGuardedRoute = path.startsWith('/admin') || path.startsWith('/api/admin');
  if (!isAdminGuardedRoute) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    return NextResponse.json(
      { error: 'サーバー設定エラー: ADMIN_SESSION_SECRET/ADMIN_PASSWORD未設定です。' },
      { status: 500 }
    );
  }

  // cronジョブ等、Cookieを持てない呼び出し元向けの抜け道（adminSession.tsのAPI版と同じ条件）
  const cronSecret = req.headers.get('x-cron-secret') || '';
  const expectedCronSecret = process.env.CRON_SECRET || '';
  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await isValidAdminSession(token, secret)) {
    return NextResponse.next();
  }

  // Discord OAuth2 ログインセッション (ktm_user_session) の管理者チェック
  const discordSession = req.cookies.get('ktm_user_session')?.value;
  if (await isValidDiscordAdminSession(discordSession, secret)) {
    return NextResponse.next();
  }

  // API routeはJSON 401、ページ遷移は/loginへリダイレクト
  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('returnTo', path);
  return NextResponse.redirect(loginUrl);
}

// 適用するルートの定義
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
