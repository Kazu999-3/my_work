import { redirect } from 'next/navigation';

// レーン別攻略ガイドは新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// 古いブックマークやURLからアクセスされた場合も05へ安全に転送する。
export default function LaneGuidesRedirect() {
  redirect('https://ktm-pilot.vercel.app/lane-guides');
}
