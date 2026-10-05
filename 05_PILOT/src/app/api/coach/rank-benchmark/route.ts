import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTargetTier, tierNeedsDivision } from '@/lib/coachSettings';
import { BENCHMARK_WINDOW_DAYS, TARGET_METRICS, TARGET_ROLES, type RoleBenchmark, type TargetRole } from '@/lib/coachTargetMetrics';

// 目標ランクのロール別実測平均（2026-10-06）。試合後タブ「目標との比較」が読む。
// 元データは rank_benchmark_samples（毎日 GitHub Actions で収集）、平均は DB関数 rank_benchmark_averages。
// 認証は 05 の proxy.ts が担う。
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const targetTier = await getTargetTier();
    const [tierRaw, divRaw] = targetTier.toUpperCase().split(/\s+/);
    const division = tierNeedsDivision(tierRaw) ? divRaw || 'IV' : '';

    const { data, error } = await supabase.rpc('rank_benchmark_averages', {
      p_tier: tierRaw, p_division: division, p_days: BENCHMARK_WINDOW_DAYS,
    });
    if (error) throw error;

    const roles: Partial<Record<TargetRole, RoleBenchmark>> = {};
    for (const row of (data || []) as any[]) {
      if (!TARGET_ROLES.includes(row.role)) continue;
      const values: RoleBenchmark['values'] = {};
      for (const m of TARGET_METRICS) values[m.key] = row[m.key] == null ? null : Number(row[m.key]);
      roles[row.role as TargetRole] = {
        role: row.role,
        sample_count: Number(row.sample_count),
        cs_at_15_count: Number(row.cs_at_15_count),
        last_collected_at: row.last_collected_at,
        values,
      };
    }

    return NextResponse.json({ targetTier: `${tierRaw}${division ? ` ${division}` : ''}`, windowDays: BENCHMARK_WINDOW_DAYS, roles });
  } catch (e: any) {
    console.error('[coach/rank-benchmark]', e);
    return NextResponse.json({ error: e.message || '目標ランク平均の取得に失敗しました' }, { status: 500 });
  }
}
