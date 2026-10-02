import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getExpectedToken, setAuthCookie } from '@/lib/tokenAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!getExpectedToken()) {
    return NextResponse.json(
      { error: 'サーバーに PILOT_SECRET_TOKEN が設定されていません。Vercel の環境変数を設定してください。' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || '');

  if (!verifyToken(token)) {
    // 総当たりを遅らせる
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: '合言葉が違います。' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  setAuthCookie(res, token);
  return res;
}
