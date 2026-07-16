import { NextResponse } from 'next/server';
import { createSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/adminSession';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json(
        { success: false, error: 'サーバー設定エラー: ADMIN_PASSWORDが設定されていません。' },
        { status: 500 }
      );
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { success: false, error: 'パスワードが正しくありません。' },
        { status: 401 }
      );
    }

    const { token, maxAgeSec } = createSessionToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSec,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `認証処理中にエラーが発生しました: ${err.message}` },
      { status: 500 }
    );
  }
}
