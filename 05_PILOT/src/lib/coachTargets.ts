import { supabase } from './supabaseClient';

// 試合後タブ「目標との比較」で使う、ロール別の目標スタッツ。2026-10-06
// ランク帯ごとの実在の平均値は持っていない（lib/sessionAnalyticsCalculator.ts の ROLE_RANK_BENCHMARKS も
// 手入力の値）。ここは「プレイヤー自身が決めた目標値」であることを前提に、ユーザーが入力した値だけを保存し、
// 画面にもそう明記する。初期値は入れない（未設定の指標は比較しない）。

export const COACH_TARGETS_KEY = 'coach_stat_targets';

import {
  TARGET_METRICS, TARGET_ROLES, sanitizeRoleTargets,
  type TargetRole, type TargetMetricKey, type RoleTargets, type CoachTargets,
} from './coachTargetMetrics';
export { TARGET_METRICS, TARGET_ROLES, sanitizeRoleTargets };
export type { TargetRole, TargetMetricKey, RoleTargets, CoachTargets };

export async function getCoachTargets(): Promise<CoachTargets> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('ktm_settings').select('value').eq('key', COACH_TARGETS_KEY).maybeSingle();
  if (error) throw error;
  return ((data as any)?.value as CoachTargets) || {};
}

export async function saveRoleTargets(role: TargetRole, values: RoleTargets): Promise<CoachTargets> {
  if (!supabase) throw new Error('Supabaseクライアントが未初期化です');
  const current = await getCoachTargets();
  const next: CoachTargets = { ...current, [role]: values };
  const { error } = await supabase
    .from('ktm_settings')
    .upsert({ key: COACH_TARGETS_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  return next;
}
