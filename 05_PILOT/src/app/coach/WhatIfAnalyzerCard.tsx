"use client";

import { AlertTriangle, TrendingDown, ArrowRightLeft, Sparkles, HelpCircle, CheckCircle2 } from "lucide-react";
import type { WhatIfAnalysisReport } from "@/lib/whatIfAnalyzer";

interface WhatIfAnalyzerCardProps {
  report?: WhatIfAnalysisReport | null;
  isWin?: boolean;
}

export default function WhatIfAnalyzerCard({ report, isWin }: WhatIfAnalyzerCardProps) {
  if (!report || !report.turningPoint) {
    return null;
  }

  const tp = report.turningPoint;
  const isCriticalFault = tp.tradeoffVerdict === 'CRITICAL_SPLIT_FAULT';
  const isWorthwhile = tp.tradeoffVerdict === 'WORTHWHILE_TRADE';

  return (
    <div className={`rounded-xl border p-4 shadow-xl backdrop-blur-md space-y-3.5 transition-all ${
      isCriticalFault
        ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 via-zinc-900/50 to-zinc-900/80 ring-1 ring-amber-500/30'
        : 'border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 via-zinc-900/50 to-zinc-900/80'
    }`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isCriticalFault ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'
          }`}>
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                もしもの世界 • タイムライン逆再生
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300">
                What-If Engine
              </span>
            </div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>🌪️ 敗因分岐点: {tp.timeFormatted}</span>
              <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-mono font-bold text-rose-300 border border-rose-500/30">
                {tp.goldSwing.toLocaleString()}G 急落
              </span>
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className={`px-2 py-1 rounded text-[11px] font-bold ${
            isCriticalFault
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : isWorthwhile
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
          }`}>
            {tp.verdictTitle}
          </span>
        </div>
      </div>

      {/* トレードオフ対比グリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* 自身が得たもの */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300 border-b border-emerald-500/20 pb-1.5">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 自身が得たもの (Action)
            </span>
            <span className="font-mono text-emerald-400">
              +{tp.selfGained.totalGold.toLocaleString()}G
            </span>
          </div>
          <ul className="space-y-1 text-xs text-zinc-200">
            {tp.selfGained.actions.map((act, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="text-emerald-400">•</span>
                <span>{act}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* チームが失ったもの */}
        <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-rose-300 border-b border-rose-500/20 pb-1.5">
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> チームが失ったもの (Loss)
            </span>
            <span className="font-mono text-rose-400">
              -{tp.teamLost.totalGoldLoss.toLocaleString()}G
            </span>
          </div>
          <ul className="space-y-1 text-xs text-zinc-200">
            {tp.teamLost.actions.map((act, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="text-rose-400">•</span>
                <span>{act}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 客観的アドバイス */}
      <div className="rounded-lg bg-black/40 border border-white/5 p-3 space-y-1 text-xs">
        <div className="font-bold text-zinc-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" /> 客観的教訓 ＆ 次戦への指針
        </div>
        <p className="text-zinc-300 leading-relaxed">
          {tp.verdictAdvice}
        </p>
      </div>
    </div>
  );
}
