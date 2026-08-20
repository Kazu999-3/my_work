'use client';

import React from 'react';
import { Shield, Zap, Target, AlertTriangle, ExternalLink } from 'lucide-react';
import { KAZURIN_STYLE_PROFILE } from '../../lib/playerStyleProfile';

export default function PlayerStyleRadarCard() {
  const p = KAZURIN_STYLE_PROFILE;

  return (
    <div className="bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 border border-stone-700/80 rounded-3xl p-5 shadow-xl text-stone-100 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-stone-700/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="font-black text-sm text-white flex items-center gap-2">
              <span>プレイスタイル特性カルテ</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                your.gg 実戦データ連動
              </span>
            </h3>
            <p className="text-[11px] text-stone-400 font-mono">
              {p.summonerName} | {p.tier} ({p.role} メイン)
            </p>
          </div>
        </div>
        <a
          href="https://your.gg/en/jp/profile/Kazurin%234036"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
        >
          <span>your.gg で確認</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* 3大指標カードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 生存力 */}
        <div className="bg-stone-800/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
              <Shield size={13} />
              <span>生存能力 (Survival)</span>
            </span>
            <span className="text-xs font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
              {p.survivalRating}
            </span>
          </div>
          <div className="text-xl font-black text-white">
            {p.avgDeaths} <span className="text-xs font-normal text-stone-400">平均デス</span>
          </div>
          <p className="text-[11px] text-emerald-300/90 font-bold">
            上位 {p.survivalRankPercentile}% の極めて高い安全性
          </p>
        </div>

        {/* 序盤ファーム力 */}
        <div className="bg-stone-800/90 border border-sky-500/30 rounded-2xl p-3.5 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-sky-400 flex items-center gap-1">
              <Zap size={13} />
              <span>15分CSリード (CSD@15)</span>
            </span>
            <span className="text-xs font-black px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded-lg">
              +13.9
            </span>
          </div>
          <div className="text-xl font-black text-white">
            +{p.csd15} <span className="text-xs font-normal text-stone-400">CSリード</span>
          </div>
          <p className="text-[11px] text-sky-300/90 font-bold">
            上位 {p.csdRankPercentile}% の高いルート精度
          </p>
        </div>

        {/* 序盤戦闘関与 (ボトルネック) */}
        <div className="bg-stone-800/90 border border-rose-500/40 rounded-2xl p-3.5 space-y-1 relative overflow-hidden bg-gradient-to-b from-rose-950/20 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-400 flex items-center gap-1">
              <AlertTriangle size={13} />
              <span>15分キル関与 (KP@15)</span>
            </span>
            <span className="text-xs font-black px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-lg animate-pulse">
              要改善 (C-)
            </span>
          </div>
          <div className="text-xl font-black text-rose-300">
            {p.earlyKp15}% <span className="text-xs font-normal text-stone-400">関与率</span>
          </div>
          <p className="text-[11px] text-rose-400 font-bold">
            下位 {100 - p.kpRankPercentile}% (味方崩壊の放置に注意)
          </p>
        </div>
      </div>

      {/* ボトルネック解説 ＆ AI戦術指針 */}
      <div className="bg-stone-950/80 border border-amber-600/40 rounded-2xl p-4 space-y-2">
        <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
          <Target size={14} />
          <span>AIコーチによる勝率改善の核（ボトルネック解消）</span>
        </div>
        <p className="text-xs text-stone-300 leading-relaxed font-medium">
          {p.coreBottleNeck}
        </p>
        <div className="bg-amber-950/40 border border-amber-600/30 p-2.5 rounded-xl text-xs font-bold text-amber-200 flex items-start gap-2">
          <span className="shrink-0 text-base">🎯</span>
          <span><strong>最重要アクション:</strong> {p.actionGuideline}</span>
        </div>
      </div>
    </div>
  );
}
