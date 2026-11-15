"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import type { ClashResponseData } from "./types";

interface NemesisClashCardProps {
  clashData: ClashResponseData | null;
  loadingClash: boolean;
}

export default function NemesisClashCard({ clashData, loadingClash }: NemesisClashCardProps) {
  if (!loadingClash && !clashData?.featuredClash && (!clashData?.goldenDuos || clashData.goldenDuos.length === 0)) {
    return null;
  }

  return (
    <div className="p-4 rounded-2xl border border-primary-edge-soft/70 bg-gradient-to-br from-primary-50/50 via-surface to-surface shadow-xs space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚔️</span>
          <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
            対戦データ（ライバル・直接対決・名コンビ）
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 border border-primary-edge">
              Nemesis Clash
            </span>
          </h3>
        </div>
        {loadingClash && (
          <span className="text-[10px] text-muted-strong flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin text-primary-600" />
            対戦履歴を照合中…
          </span>
        )}
      </div>

      {/* ハイライト因縁カード */}
      {clashData?.featuredClash && (
        <div className="p-3 rounded-xl bg-surface border border-border shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                clashData.featuredClash.type === 'NEMESIS'
                  ? 'bg-danger-100 text-danger-900 border border-danger-edge'
                  : 'bg-primary-100 text-primary-900 border border-primary-edge'
              }`}>
                {clashData.featuredClash.type === 'NEMESIS' ? '💥 最大の因縁' : '🔥 好敵手'}
              </span>
              <strong className="text-xs font-black text-foreground">
                {clashData.featuredClash.headline}
              </strong>
            </div>
            <p className="text-[11px] text-foreground-soft leading-relaxed">
              {clashData.featuredClash.subtext}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center font-mono">
            <span className="text-xs font-bold text-secondary-700 bg-secondary-100 px-2 py-1 rounded-lg border border-secondary-edge">
              {clashData.featuredClash.bluePlayer} ({clashData.featuredClash.blueWins}勝)
            </span>
            <span className="text-[10px] font-black text-muted-strong">vs</span>
            <span className="text-xs font-bold text-danger-700 bg-danger-100 px-2 py-1 rounded-lg border border-danger-edge">
              {clashData.featuredClash.redPlayer} ({clashData.featuredClash.redWins}勝)
            </span>
          </div>
        </div>
      )}

      {/* 黄金デュオ一覧 */}
      {clashData?.goldenDuos && clashData.goldenDuos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          {clashData.goldenDuos.map((duo, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                duo.teamSide === 'BLUE'
                  ? 'bg-secondary-50/70 border-secondary-edge-soft text-secondary-900'
                  : 'bg-danger-50/70 border-danger-edge-soft text-danger-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🤝</span>
                <div>
                  <span className="font-black block text-xs">
                    {duo.player1} ＆ {duo.player2}
                  </span>
                  <span className="text-[10px] opacity-80 font-medium">
                    {duo.label}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                duo.teamSide === 'BLUE' ? 'bg-secondary-100 text-secondary-800' : 'bg-danger-100 text-danger-800'
              }`}>
                {duo.teamSide} TEAM
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
