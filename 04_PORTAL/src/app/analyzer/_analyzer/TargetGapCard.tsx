"use client";

import { Sparkles, CheckCircle2 } from 'lucide-react';

// 目標ランク・同ロールの実測平均との差
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function TargetGapCard({ report, targetTier }: {
  report: any;
  targetTier: string;
}) {
  return (
    <>
          {/* 🎯 目標ランク基準ギャップ診断（2026-10-07: 目標ランク・同ロールの実測平均と比較。以前は手入力の目標値） */}
          {report.sessionAnalytics?.targetRankGap ? (() => {
            const g = report.sessionAnalytics.targetRankGap;
            const items = [
              { key: 'deaths', title: '① 平均デス', gap: g.gaps.deathsDiff, actual: g.currentActual.avgDeaths, avg: g.benchmark.avgDeaths, unit: '' },
              { key: 'cs', title: '② 分間CS', gap: g.gaps.csDiff, actual: g.currentActual.csPerMin, avg: g.benchmark.csPerMin, unit: '' },
              { key: 'kp', title: '③ キル関与率', gap: g.gaps.kpDiff, actual: g.currentActual.killParticipation, avg: g.benchmark.killParticipation, unit: '%' },
              { key: 'vision', title: '④ 分間視界スコア', gap: g.gaps.visionDiff, actual: g.currentActual.visionScorePerMin, avg: g.benchmark.visionScorePerMin, unit: '' },
            ];
            return (
              <div className="rounded-3xl border border-success-edge bg-gradient-to-br from-success-50/90 via-white to-secondary-50/70 p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-success-edge-soft gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-success-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
                      🎯
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-success-100 text-success-900 border border-success-edge">
                          比較相手: {g.benchmark.tierName}・同ロールの実測平均
                        </span>
                        <h3 className="text-lg font-black text-foreground">目標ランク平均との比較</h3>
                      </div>
                      <p className="text-xs text-muted font-medium mt-0.5">
                        {g.benchmark.tierName} のプレイヤー本人の直近ランクソロ {g.benchmark.sampleCount}試合（直近30日）の平均と、現在の実測値を比べています
                        {g.lowSample && <span className="block text-[10px] text-danger-700 font-bold">※試合数が少ないため参考値です</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-faint font-bold">平均以上の項目</span>
                    <div className="text-2xl font-black text-success-700 font-mono">
                      {g.passedCount} / {g.totalCount}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {items.map((it) => (
                    <div key={it.key} className="p-3.5 bg-surface rounded-2xl border border-border/80 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-muted">{it.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${it.gap.passed ? 'bg-success-100 text-success-900' : 'bg-danger-100 text-danger-900'}`}>
                          {it.gap.passed ? '平均以上' : '平均未満'}
                        </span>
                      </div>
                      <div className="text-foreground font-black font-mono">
                        実測 {it.actual}{it.unit} / 平均 {it.avg}{it.unit}
                      </div>
                      <div className="text-[10px] text-muted-strong">{it.gap.label}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-success-edge-soft space-y-2">
                  <div className="text-xs font-black text-success-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-success-600" />
                    <span>{g.benchmark.tierName}平均を下回っている項目:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-foreground-subtle font-medium">
                    {g.keyActionToPromote?.map((act: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="text-success-600 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })() : (
            <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted">
              🎯 目標ランク【{targetTier}】の実測平均はまだ収集中のため、目標ランクとの比較は表示していません（毎日自動で収集しています）。
            </div>
          )}
    </>
  );
}
