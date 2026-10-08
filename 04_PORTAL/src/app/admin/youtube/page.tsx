import { redirect } from 'next/navigation';
import { buildPilotUrl } from '@/lib/pilotRedirect';

// 動画キュー管理は05(KTM Pilot)の /admin/youtube へ移植済み（2026-10-02）。
// 以前は旧辞典ページのタブ(/champions?scope=knowledge&tab=video)へ飛ばしていたが、そこも05へ転送になったため直接送る。
export default function YoutubeAdminRedirect() {
  redirect(buildPilotUrl('/admin/youtube', {}));
}
