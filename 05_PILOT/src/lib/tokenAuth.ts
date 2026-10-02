import type { NextResponse } from 'next/server';

// 秘密トークン認証ヘルパー（proxy.ts と /api/auth/login から使う）

export const PILOT_COOKIE_NAME = 'pilot_auth_token';

// ローカル開発専用のフォールバック。リポジトリは公開されているためこの値は誰でも読める。
// 本番で PILOT_SECRET_TOKEN が未設定のときにこれを使うと認証が無いのと同じになるので、
// 本番では使わず「誰も通さない」側に倒す。
const DEFAULT_DEV_TOKEN = 'pilot_dev_secret_2026';

const isProduction = () => process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

/** 期待するトークン。本番で未設定なら null（＝全リクエスト拒否） */
export function getExpectedToken(): string | null {
  const configured = process.env.PILOT_SECRET_TOKEN;
  // 2026-10-02: 本番・ローカルとも PILOT_SECRET_TOKEN にこの公開値がそのまま入っていた。
  // 本番で公開値を受け付けると認証が無いのと同じなので、設定されていても未設定扱いにする。
  if (configured && !(isProduction() && configured === DEFAULT_DEV_TOKEN)) return configured;
  return isProduction() ? null : DEFAULT_DEV_TOKEN;
}

// 文字列比較の所要時間から一致した文字数を推測されないよう、長さに関係なく全文字を比較する
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function verifyToken(token: string | null | undefined): boolean {
  const expected = getExpectedToken();
  if (!token || !expected) return false;
  return timingSafeEqual(token, expected);
}

export const PILOT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年（個人用端末で毎回入力させない）

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(PILOT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PILOT_COOKIE_MAX_AGE,
  });
}
