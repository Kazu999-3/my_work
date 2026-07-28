import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '../lib/adminSession';

export default async function Home() {
  // Server-side で即座にダイレクト転送（画面のチラつきCLSを排除）。
  // 管理者セッションが有効ならダッシュボードへ、そうでなければ一般ユーザー向けのチーム分けへ。
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    redirect('/admin/dashboard');
  }
  redirect('/balancer');
}
