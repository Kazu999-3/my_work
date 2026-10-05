// 目標との比較の指標定義（クライアントからも読むため supabase に依存させない）。2026-10-06
// 保存・取得は lib/coachTargets.ts。

export const TARGET_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
export type TargetRole = (typeof TARGET_ROLES)[number];

export const TARGET_METRICS = [
  { key: 'cs_per_min', label: 'CS/分', step: 0.1, lowerIsBetter: false },
  { key: 'cs_at_15', label: '15分CS', step: 1, lowerIsBetter: false },
  { key: 'deaths', label: 'デス', step: 0.5, lowerIsBetter: true },
  { key: 'vision_per_min', label: '視界スコア/分', step: 0.1, lowerIsBetter: false },
  { key: 'kill_participation', label: 'キル関与率(%)', step: 1, lowerIsBetter: false },
  { key: 'damage_share', label: 'チーム内ダメージ割合(%)', step: 1, lowerIsBetter: false },
  { key: 'control_wards_bought', label: 'コントロールワード購入', step: 1, lowerIsBetter: false },
] as const;
export type TargetMetricKey = (typeof TARGET_METRICS)[number]['key'];

export type RoleTargets = Partial<Record<TargetMetricKey, number>>;
export type CoachTargets = Partial<Record<TargetRole, RoleTargets>>;

export function sanitizeRoleTargets(raw: unknown): RoleTargets {
  const out: RoleTargets = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const m of TARGET_METRICS) {
    const v = (raw as any)[m.key];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[m.key] = n;
  }
  return out;
}
