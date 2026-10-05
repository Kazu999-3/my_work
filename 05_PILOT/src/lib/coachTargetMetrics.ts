// 目標との比較の指標定義（クライアントからも読むため supabase に依存させない）。2026-10-06
// 比較相手は目標ランク・同じロールのプレイヤーの実測平均（rank_benchmark_samples / migration 88、
// 収集は 03_SYSTEMS/v2_CORE/_LOL/rank_benchmark_collector.py）。
// key は DB関数 rank_benchmark_averages の列名・postgame-deep-analytics の自分側の値と一致させている。

export const TARGET_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
export type TargetRole = (typeof TARGET_ROLES)[number];

export const TARGET_METRICS = [
  { key: 'cs_per_min', label: 'CS/分', lowerIsBetter: false },
  { key: 'cs_at_15', label: '15分CS', lowerIsBetter: false },
  { key: 'deaths', label: 'デス', lowerIsBetter: true },
  { key: 'vision_per_min', label: '視界スコア/分', lowerIsBetter: false },
  { key: 'kill_participation', label: 'キル関与率(%)', lowerIsBetter: false },
  { key: 'damage_share', label: 'チーム内ダメージ割合(%)', lowerIsBetter: false },
  { key: 'control_wards_bought', label: 'コントロールワード購入', lowerIsBetter: false },
] as const;
export type TargetMetricKey = (typeof TARGET_METRICS)[number]['key'];

/** この試合数未満のロールは「参考値」として表示する */
export const BENCHMARK_MIN_SAMPLES = 30;
/** 平均の対象期間（日） */
export const BENCHMARK_WINDOW_DAYS = 30;

export interface RoleBenchmark {
  role: TargetRole;
  sample_count: number;
  cs_at_15_count: number;
  last_collected_at: string | null;
  values: Partial<Record<TargetMetricKey, number | null>>;
}
