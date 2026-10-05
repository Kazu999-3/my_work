'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import {
  TARGET_METRICS, BENCHMARK_MIN_SAMPLES,
  type TargetMetricKey, type RoleBenchmark, type TargetRole,
} from '@/lib/coachTargetMetrics';

// 目標との比較（2026-10-06）。目標ランク・同じロールのプレイヤーの実測平均（毎日収集）と、
// この試合・自分の直近平均を並べ、目標ランク平均に届いていない指標を出す。

const ROLE_LABEL: Record<string, string> = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

interface Props {
  role: string;
  thisMatch: Partial<Record<TargetMetricKey, number | null>>;
  recentAvg: Partial<Record<TargetMetricKey, number | null>>;
  recentCount: number;
}

const fmt = (v: number | null | undefined) =>
  v == null ? '-' : Number.isInteger(v) ? v.toLocaleString() : String(Number(v.toFixed(v < 10 ? 2 : 1)));

export default function TargetComparisonCard({ role, thisMatch, recentAvg, recentCount }: Props) {
  const [bench, setBench] = useState<RoleBenchmark | null>(null);
  const [targetTier, setTargetTier] = useState('');
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/coach/rank-benchmark', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '目標ランク平均の取得に失敗しました');
        if (cancelled) return;
        setTargetTier(json.targetTier || '');
        setWindowDays(json.windowDays || 30);
        setBench((json.roles || {})[role as TargetRole] || null);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  const roleLabel = ROLE_LABEL[role] || role;
  const shortOf = (key: TargetMetricKey, v: number | null | undefined) => {
    const avg = bench?.values[key];
    if (avg == null || v == null) return null;
    const m = TARGET_METRICS.find((x) => x.key === key)!;
    return m.lowerIsBetter ? v > avg : v < avg;
  };
  const missing = TARGET_METRICS.filter((m) => shortOf(m.key, thisMatch[m.key]) === true);
  const lowSample = !!bench && bench.sample_count < BENCHMARK_MIN_SAMPLES;
  const lastDate = bench?.last_collected_at ? new Date(bench.last_collected_at).toLocaleDateString('ja-JP') : null;

  return (
    <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-amber-400" />
          目標ランク平均との比較（{targetTier || '目標ランク'}・{roleLabel}）
        </span>
        {bench && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            lowSample ? 'text-amber-300 bg-amber-950/30 border-amber-800/60' : 'text-stone-400 bg-stone-900 border-stone-800'
          }`}>
            {lowSample ? '参考値・' : ''}{bench.sample_count}試合{lastDate ? `・最終収集 ${lastDate}` : ''}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-[11px] text-stone-400">読み込み中...</p>
      ) : error ? (
        <p className="text-[11px] text-rose-400">{error}</p>
      ) : !bench ? (
        <p className="text-[11px] text-stone-400">
          {targetTier}の{roleLabel}のデータがまだありません。毎日の自動収集（目標ランクのプレイヤーの試合を1日約60試合）で貯まり次第、ここに平均との比較が表示されます。
        </p>
      ) : (
        <>
          {missing.length > 0 ? (
            <div className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-2.5 text-[11px]">
              <span className="font-black text-rose-400">この試合で{targetTier}平均に届かなかった指標: </span>
              <span className="text-stone-200">{missing.map((m) => m.label).join('・')}</span>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-2.5 text-[11px] text-emerald-400 font-bold">
              この試合は、すべての指標で{targetTier}の平均以上でした。
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-stone-500 text-[10px]">
                  <th className="text-left font-bold py-1"></th>
                  <th className="text-right font-bold py-1">{targetTier}平均</th>
                  <th className="text-right font-bold py-1">この試合</th>
                  <th className="text-right font-bold py-1">自分の直近{recentCount}戦</th>
                </tr>
              </thead>
              <tbody>
                {TARGET_METRICS.map((m) => {
                  const cell = (v: number | null | undefined) => {
                    const s = shortOf(m.key, v);
                    return <span className={s == null ? 'text-stone-400' : s ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{fmt(v)}</span>;
                  };
                  return (
                    <tr key={m.key} className="border-t border-stone-800/60">
                      <td className="py-1.5 text-stone-400 font-sans font-bold">{m.label}</td>
                      <td className="py-1.5 text-right text-stone-200">{fmt(bench.values[m.key])}</td>
                      <td className="py-1.5 text-right">{cell(thisMatch[m.key])}</td>
                      <td className="py-1.5 text-right">{cell(recentAvg[m.key])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-[10px] text-stone-500">
        平均は、{targetTier || '目標ランク'}の一覧から選んだプレイヤー本人の直近ランクソロ（直近{windowDays}日・同じロール）の実測値です。
        {lowSample && `試合数が${BENCHMARK_MIN_SAMPLES}未満のうちはぶれが大きいため参考値として見てください。`}
        自分の直近平均は直近のソロQのうち{roleLabel}で出た試合（15分CSはこの試合のみ）。
      </p>
    </div>
  );
}
