'use client';

import React from 'react';
import { BookOpen, Flame, Sparkles, TrendingUp, Search } from 'lucide-react';
import { getChampIcon } from '@/lib/ddragonClient';

export interface BibleStats {
  totalApproved: number;
  totalPending: number;
  todayApproved: number;
  topChampions: Array<{ champion: string; nameJa: string; count: number }>;
}

interface BibleProgressHeaderProps {
  stats: BibleStats | null;
  onSelectChampion: (champNameJa: string) => void;
  activeSearchQuery: string;
}

export default function BibleProgressHeader({
  stats,
  onSelectChampion,
  activeSearchQuery,
}: BibleProgressHeaderProps) {
  if (!stats) return null;

  const totalAll = stats.totalApproved + stats.totalPending;
  const progressPercent = totalAll > 0 ? Math.round((stats.totalApproved / totalAll) * 100) : 0;

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-zinc-900/95 via-zinc-900/80 to-zinc-950/90 border border-zinc-800/90 shadow-xl space-y-3">
      {/* 上段: メトリクス ＆ 進捗バー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* 左側: 進捗数字 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white tracking-wide">
                  教本インテリジェンス蓄積度
                </span>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                  {progressPercent}%
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                <span className="text-white font-bold">{stats.totalApproved.toLocaleString()}</span> 件 統合完了 / 未承認 <span className="text-amber-400 font-bold">{stats.totalPending.toLocaleString()}</span> 件
              </p>
            </div>
          </div>

          {/* 本日の成果バッジ */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse shrink-0" />
            <span>本日統合:</span>
            <span className="font-mono text-sm font-black text-amber-200">
              +{stats.todayApproved}
            </span>
            <span className="text-[10px] text-amber-400/80">知見</span>
          </div>
        </div>

        {/* 右側: 簡易補足 */}
        <div className="text-[11px] text-zinc-500 flex items-center gap-1 sm:self-center">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
          <span>承認するたびにバイブルが自動強化されます</span>
        </div>
      </div>

      {/* 中段: プログレスバー */}
      <div className="w-full bg-zinc-950/80 rounded-full h-2 p-0.5 border border-zinc-800/80 overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 h-full rounded-full transition-all duration-500 ease-out shadow-sm"
          style={{ width: `${Math.min(100, Math.max(3, progressPercent))}%` }}
        />
      </div>

      {/* 下段: 知見充実度 Top チャンピオン（クイック絞り込みボタン群） */}
      {stats.topChampions.length > 0 && (
        <div className="pt-1 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>充実度 TOP:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5">
            {stats.topChampions.map((c) => {
              const isActive = activeSearchQuery.trim() === c.nameJa;
              return (
                <button
                  key={c.champion}
                  type="button"
                  onClick={() => onSelectChampion(isActive ? '' : c.nameJa)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-bold transition cursor-pointer shadow-sm ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/70 shadow-amber-500/10'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white hover:bg-zinc-900'
                  }`}
                  title={`「${c.nameJa}」の記事で絞り込み`}
                >
                  <img
                    src={getChampIcon(c.champion)}
                    alt={c.nameJa}
                    className="w-4 h-4 rounded-full border border-zinc-700 object-cover shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span>{c.nameJa}</span>
                  <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-amber-400">
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
