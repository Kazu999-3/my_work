import { redirect } from 'next/navigation';

export default async function Home() {
  // Server-side で即座に /balancer へダイレクト転送（画面のチラつきCLSを排除）
  redirect('/balancer');
}
