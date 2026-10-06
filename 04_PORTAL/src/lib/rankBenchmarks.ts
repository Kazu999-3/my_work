import { supabaseAdmin } from './supabaseAdmin';
import type { MeasuredRankBenchmark } from './sessionAnalyticsCalculator';

// 目標ランク・同じロールの実測平均を取得する（2026-10-07）。
// 元データは rank_benchmark_samples（migration 88）。毎日 .github/workflows/rank-benchmark-update.yml が
// コーチの目標ランクと、プレイヤー外部分析で選べる目標ランク（GOLD/PLATINUM/EMERALD/DIAMOND IV）を収集する。
// 05 の /api/coach/rank-benchmark と同じDB関数を使う。

const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const WINDOW_DAYS = 30;

/** Riot のポジション表記をDBのロール名にそろえる */
function normalizeRole(role: string): string {
  const r = (role || '').toUpperCase();
  if (r === 'SUPPORT' || r === 'SUP') return 'UTILITY';
  if (r === 'BOT' || r === 'ADC') return 'BOTTOM';
  if (r === 'MID') return 'MIDDLE';
  if (r === 'JG' || r === 'JUNGLER') return 'JUNGLE';
  return r;
}

/** "Emerald IV" → { tier: 'EMERALD', division: 'IV', label: 'Emerald IV' } */
function parseTier(targetTier: string) {
  const [t = 'EMERALD', d = 'IV'] = targetTier.trim().toUpperCase().split(/\s+/);
  const division = APEX.includes(t) ? '' : d;
  const label = `${t.charAt(0)}${t.slice(1).toLowerCase()}${division ? ` ${division}` : ''}`;
  return { tier: t, division, label };
}

/** データが無い・取得に失敗した時は null（呼び出し側は目標ランク比較を出さない） */
export async function fetchRankBenchmark(targetTier: string, role: string): Promise<MeasuredRankBenchmark | null> {
  const { tier, division, label } = parseTier(targetTier);
  const dbRole = normalizeRole(role);
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('rank_benchmark_averages', {
    p_tier: tier, p_division: division, p_days: WINDOW_DAYS,
  });
  if (error) {
    console.error('[rankBenchmarks] rank_benchmark_averages の取得に失敗:', error.message);
    return null;
  }
  const row = (data || []).find((r: any) => r.role === dbRole);
  if (!row) return null;
  return {
    tierName: label,
    role: dbRole,
    sampleCount: Number(row.sample_count),
    lastCollectedAt: row.last_collected_at,
    avgDeaths: Number(row.deaths),
    csPerMin: Number(row.cs_per_min),
    killParticipation: Number(row.kill_participation),
    visionScorePerMin: Number(row.vision_per_min),
  };
}
