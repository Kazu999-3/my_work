// 通知ベルの振り分け（2026-10-08）。admin_notifications は 04 と 05 で同じテーブルを使うため、
// 以前は両方のベルに同じ通知が全部出ていた。種類（type）で 04 向けを決め、それ以外は 05 に出す。
// ⚠️ 05_PILOT/src/lib/notificationScope.ts と同じ一覧を保つこと（片方だけ足すと、どちらにも出ない・両方に出る通知ができる）。
//
// 04（内戦・ポータル）に出すもの:
//   balancer_accuracy     チーム分けの予測精度アラート（lib/balancer.ts）
//   portal_boundary_error ポータル画面のエラー（/api/health）
// 05 に出すもの（それ以外すべて）: coach_review / dict_review / patch_update / system_health / edge_task など
export const PORTAL_NOTIFICATION_TYPES = ['balancer_accuracy', 'portal_boundary_error'] as const;
