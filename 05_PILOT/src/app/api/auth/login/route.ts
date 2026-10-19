import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getExpectedToken, setAuthCookie } from '@/lib/tokenAuth';
import { clientIp, isLoginBlocked, recordLoginFailure } from '@/lib/loginRateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!getExpectedToken()) {
    return NextResponse.json(
      { error: 'サーバーに PILOT_SECRET_TOKEN が設定されていません。Vercel の環境変数を設定してください。' },
      { status: 503 },
    );
  }

  // 2026-10-19: 以前は失敗時に0.8秒待たせるだけで回数の制限が無く、同時にいくらでも試せた
  const ip = clientIp(req.headers);
  if (await isLoginBlocked(ip)) {
    return NextResponse.json({ error: '試行回数が多すぎます。15分ほど待ってから再試行してください。' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || '');

  if (!verifyToken(token)) {
    await recordLoginFailure(ip);
    // 総当たりを遅らせる
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: '合言葉が違います。' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  setAuthCookie(res, token);
  return res;
}
