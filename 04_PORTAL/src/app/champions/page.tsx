import { redirect } from 'next/navigation';

// チャンピオン辞典は新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// 古いブックマークや通知URLからアクセスされた場合も05へ安全に転送する。
export default function ChampionsRedirect() {
  redirect('https://ktm-pilot.vercel.app');
}
