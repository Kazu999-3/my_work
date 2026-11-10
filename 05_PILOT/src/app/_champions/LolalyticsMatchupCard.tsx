"use client";

import React from "react";
import { getChampIcon } from "@/lib/ddragonClient";
import { Swords, ShieldAlert, Trophy, ExternalLink } from "lucide-react";
import type { LolalyticsData } from "./useLolalyticsData";

export default function LolalyticsMatchupCard({
  data,
  loading,
  currentRole,
  onSelectEnemy,
}: {
  data: LolalyticsData | null;
  loading: boolean;
  currentRole: string;
  onSelectEnemy?: (enemyId: string) => void;
}) {
  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-48 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-28 bg-zinc-800/50 rounded-xl" />
          <div className="h-28 bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data?.matchups || (data.matchups.favorable.length === 0 && data.matchups.difficult.length === 0)) {
    return null;
  }

  const { favorable, difficult } = data.matchups;

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/90 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-400" />
            Lolalytics 実戦マッチアップ統計
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {currentRole} / エメラルド以上実測
          </span>
        </div>
        <a
          href={`https://lolalytics.com/lol/${data.champion.id.toLowerCase()}/build/?lane=${currentRole.toLowerCase()}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-zinc-400 hover:text-amber-300 transition flex items-center gap-1"
        >
          <span>Lolalyticsで詳細を見る</span>
          <ExternalLink size={9} />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 有利な対面 TOP 5 */}
        <div className="bg-zinc-950/70 border border-emerald-950/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2.5 text-xs font-black text-emerald-400">
            <Swords size={13} />
            <span>有利な対面 TOP 5（カモ対面）</span>
          </div>
          <div className="space-y-1.5">
            {favorable.map((opp) => (
              <div
                key={opp.id}
                onClick={() => onSelectEnemy && onSelectEnemy(opp.id)}
                className={`flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60 text-xs transition ${
                  onSelectEnemy ? "hover:border-emerald-500/50 hover:bg-zinc-850 cursor-pointer" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={getChampIcon(opp.id)}
                    alt={opp.name}
                    className="w-6 h-6 rounded-md object-cover border border-emerald-500/40 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <span className="font-bold text-zinc-200 truncate">{opp.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-black text-[11px]">
                    勝率 {opp.winRate}%
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {opp.games.toLocaleString()}戦
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 苦手な対面 TOP 5 */}
        <div className="bg-zinc-950/70 border border-rose-950/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2.5 text-xs font-black text-rose-400">
            <ShieldAlert size={13} />
            <span>苦手な対面 TOP 5（カウンター警戒）</span>
          </div>
          <div className="space-y-1.5">
            {difficult.map((opp) => (
              <div
                key={opp.id}
                onClick={() => onSelectEnemy && onSelectEnemy(opp.id)}
                className={`flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60 text-xs transition ${
                  onSelectEnemy ? "hover:border-rose-500/50 hover:bg-zinc-850 cursor-pointer" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={getChampIcon(opp.id)}
                    alt={opp.name}
                    className="w-6 h-6 rounded-md object-cover border border-rose-500/40 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <span className="font-bold text-zinc-200 truncate">{opp.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-black text-[11px]">
                    勝率 {opp.winRate}%
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {opp.games.toLocaleString()}戦
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
