import { redirect } from 'next/navigation';

export default function ChangelogPage() {
  // 2026-10-08: 更新情報の表示はやめた（ユーザー判断）。古いリンク用にガイドへ転送だけ残す
  redirect('/guide');
}
