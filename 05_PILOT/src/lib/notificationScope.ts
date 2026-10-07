// 通知ベルの振り分け（2026-10-08）。admin_notifications は 04 と 05 で同じテーブルを使うため、
// 以前は両方のベルに同じ通知が全部出ていた。04 向けの種類を除いたものを 05 に出す。
// ⚠️ 04_PORTAL/src/lib/notificationScope.ts と同じ一覧を保つこと（片方だけ足すと、どちらにも出ない・両方に出る通知ができる）。
export const PORTAL_NOTIFICATION_TYPES = ['balancer_accuracy', 'portal_boundary_error'] as const;

/** supabase-js の .not('type', 'in', ...) に渡す形 */
export const PORTAL_TYPES_FILTER = `(${PORTAL_NOTIFICATION_TYPES.join(',')})`;
