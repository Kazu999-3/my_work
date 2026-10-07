"use client";

import type { MeasuredBuild } from "./types";

// 実測ビルド（2026-10-07）。直近30日・同じロールのランク試合から集計した、各スロットで最も多い選択と採用率。
// 集計: champion_build_summary（migration 90）。収集: rank_benchmark_collector.py（毎日、目標ランク帯の試合の10人分）
const pct = (v?: number) => (v == null || Number.isNaN(v) ? "" : `${Math.round(v)}%`);

export default function MeasuredBuildCard({ build }: { build: MeasuredBuild }) {
  const slots = ["1コア", "2コア", "3コア"];
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {build.core.map((c, i) => (
          <div key={i} className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
            <span className="text-[10px] font-black text-amber-400 block mb-1">{slots[i]}</span>
            <p className="font-bold text-zinc-100 text-sm">{c.name}</p>
            <span className="text-[11px] text-zinc-400 mt-1 block">{slots[i]}まで買った試合の {pct(c.rate)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
          <span className="text-[10px] font-black text-emerald-400 block mb-1">キーストーン</span>
          <p className="font-bold text-zinc-100 text-sm">{build.keystone?.name || "—"}</p>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {build.keystone ? `${pct(build.keystone.rate)} が採用` : ""}
            {build.primaryStyle ? `（${build.primaryStyle}${build.subStyle ? ` / サブ ${build.subStyle}` : ""}）` : ""}
          </span>
          {build.perks.length === 6 && (
            <span className="text-[10px] text-zinc-500 mt-1 block leading-relaxed">
              最多の構成: {build.perks.join(" / ")}（{pct(build.perksRate)}）
            </span>
          )}
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
          <span className="text-[10px] font-black text-teal-400 block mb-1">靴</span>
          <p className="font-bold text-zinc-100 text-sm">{build.boots?.name || "—"}</p>
          <span className="text-[11px] text-zinc-400 mt-1 block">{build.boots ? `${pct(build.boots.rate)} が採用` : ""}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
          <span className="text-[10px] font-black text-amber-400 block mb-1">スキルを上げきる順</span>
          <p className="font-bold text-zinc-100 text-sm">{build.skillOrder ? build.skillOrder.join(" > ") : "—"}</p>
          <span className="text-[11px] text-zinc-400 mt-1 block">{build.skillOrder ? `${pct(build.skillRate)} がこの順` : ""}</span>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        実測: 直近30日のランク戦 {build.samples}試合（{build.tiers.join("・")} 前後、パッチ {build.patches.join("・")}）／ この構成での勝率 {build.winRate}%
      </p>
    </div>
  );
}
