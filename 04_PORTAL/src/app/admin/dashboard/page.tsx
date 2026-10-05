import { redirect } from 'next/navigation';

// 運用ダッシュボードは新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// 古いブックマークやURLからアクセスされた場合も05へ安全に転送する。
export default function AdminDashboardRedirect() {
  redirect('https://ktm-pilot.vercel.app/admin/dashboard');
}
