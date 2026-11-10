"use client";

import React from "react";
import { Zap, ShieldCheck, Trophy, Sparkles } from "lucide-react";
import type { LolalyticsData } from "./useLolalyticsData";

export default function LolalyticsBuildCard({
  data,
  loading,
  currentRole,
}: {
  data: LolalyticsData | null;
  loading: boolean;
  currentRole: string;
}) {
  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-48 mb-3" />
        <div className="space-y-2">
          <div className="h-16 bg-zinc-800/50 rounded-xl" />
          <div className="h-16 bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data?.builds && !data?.runes) return null;

  const core1 = data.builds?.core1 || [];
  const core2 = data.builds?.core2 || [];
  const boots = data.builds?.boots || [];
  const pickRune = data.runes?.pick;
  const winRune = data.runes?.win;

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/90 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-400" />
            Lolalytics 実測ビルド ＆ ルーン統計
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {currentRole} / 世界エメラルド以上実戦
          </span>
        </div>
        {data.stats?.games ? (
          <span className="text-[10px] text-zinc-400 font-mono">
            母数: {data.stats.games.toLocaleString()} 試合
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* おすすめアイテム（1手目・2手目） */}
        <div className="space-y-3">
          {core1.length > 0 && (
            <div>
              <div className="text-[11px] font-black text-zinc-400 mb-1.5 flex items-center gap-1">
                <Zap size={12} className="text-amber-400" />
                <span>1手目コア（1st Core）実測ランキング</span>
              </div>
              <div className="space-y-1">
                {core1.slice(0, 3).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/60 text-xs"
                  >
                    <span className="font-bold text-zinc-200">
                      {entry.items.map((i) => i.name).join(" ")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-black text-[11px]">
                        勝率 {entry.winRate}%
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {entry.games.toLocaleString()}戦
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {core2.length > 0 && (
            <div>
              <div className="text-[11px] font-black text-zinc-400 mb-1.5 flex items-center gap-1">
                <Sparkles size={12} className="text-cyan-400" />
                <span>2手目コンボ（1st + 2nd Core）</span>
              </div>
              <div className="space-y-1">
                {core2.slice(0, 3).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/60 text-xs"
                  >
                    <span className="font-bold text-zinc-200 truncate mr-2">
                      {entry.items.map((i) => i.name).join(" ➔ ")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-black text-[11px]">
                        勝率 {entry.winRate}%
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {entry.games.toLocaleString()}戦
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {boots.length > 0 && (
            <div>
              <div className="text-[11px] font-black text-zinc-400 mb-1.5">
                採用ブーツ
              </div>
              <div className="flex flex-wrap gap-1.5">
                {boots.slice(0, 3).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800/60 text-xs"
                  >
                    <span className="text-zinc-300 font-bold">{entry.items[0]?.name}</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {entry.winRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 推奨ルーン */}
        <div className="space-y-3">
          {pickRune && (
            <div className="bg-zinc-950/70 border border-zinc-800/60 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-amber-300 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-amber-400" />
                  最多ピックルーン（鉄板）
                </span>
                <span className="text-emerald-400 font-mono font-bold">
                  勝率 {pickRune.winRate}% ({pickRune.games.toLocaleString()}戦)
                </span>
              </div>
              <div className="space-y-1 text-zinc-300">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">メイン</span>
                  <span className="font-bold text-zinc-100">{pickRune.primaryPerks.map((p) => p.name).join(" > ")}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold">サブ</span>
                  <span className="text-zinc-300">{pickRune.subPerks.map((p) => p.name).join(" + ")}</span>
                </div>
              </div>
            </div>
          )}

          {winRune && winRune !== pickRune && winRune.winRate > (pickRune?.winRate || 0) && (
            <div className="bg-zinc-950/70 border border-emerald-950/60 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-400 flex items-center gap-1">
                  <Trophy size={13} />
                  最高勝率ルーン（高勝率特化）
                </span>
                <span className="text-emerald-300 font-mono font-bold">
                  勝率 {winRune.winRate}% ({winRune.games.toLocaleString()}戦)
                </span>
              </div>
              <div className="space-y-1 text-zinc-300">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">メイン</span>
                  <span className="font-bold text-zinc-100">{winRune.primaryPerks.map((p) => p.name).join(" > ")}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold">サブ</span>
                  <span className="text-zinc-300">{winRune.subPerks.map((p) => p.name).join(" + ")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
