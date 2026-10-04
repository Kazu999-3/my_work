import { redirect } from 'next/navigation';

// 辞典ヘルス画面は05(KTM Pilot)へ移植済み（2026-10-04 旧版797行を削除）。
// このポータルの定期チェック（cron/freshness-check・dict-review-check）の通知がこのURLを指すため、
// ページは消さずに05へ転送する。
export default function DictHealthRedirect() {
  redirect('https://ktm-pilot.vercel.app/admin/dict-health');
}
