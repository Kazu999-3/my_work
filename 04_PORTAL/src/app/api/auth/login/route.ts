import { NextResponse } from 'next/server';

// 管理者パスワードでのログインは廃止した（2026-10-19、ユーザー判断）。管理画面へは Discord ログインだけで入る
// （/api/auth/discord → callback が管理者の Discord ID に admin_session を発行する）。
// パスワードの入口は、15分10回の制限があっても総当たりの対象になり、パスワードの管理も必要だったため。
// 緊急時（Discord ログインが壊れた時）は、.env.local の ADMIN_SESSION_SECRET で admin_session を手元で作って入れる。
export async function POST() {
  return NextResponse.json(
    { success: false, error: '管理者パスワードでのログインは廃止しました。Discord アカウントでログインしてください。' },
    { status: 410 }
  );
}
