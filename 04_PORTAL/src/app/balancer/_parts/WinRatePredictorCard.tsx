"use client";

import React from "react";
import { calculateBlueWinProbability } from "../../../lib/mmr";
import type { BalanceResult, BalanceTeamMember } from "./types";

interface WinRatePredictorCardProps {
  balanceResult: BalanceResult;
}

export function WinRatePredictorCard({ balanceResult }: WinRatePredictorCardProps) {
  const teamBlue = balanceResult.teamBlue || balanceResult.blueTeam || [];
  const teamRed = balanceResult.teamRed || balanceResult.redTeam || [];

  if (teamBlue.length === 0 || teamRed.length === 0) return null;

  const blueAvg = teamBlue.reduce((s: number, p: BalanceTeamMember) => s + (p.mmr || 1200), 0) / teamBlue.length;
  const redAvg = teamRed.reduce((s: number, p: BalanceTeamMember) => s + (p.mmr || 1200), 0) / teamRed.length;
  const pBlue = calculateBlueWinProbability(blueAvg, redAvg);
  const bluePct = Math.round(pBlue * 100);
  const redPct = 100 - bluePct;
  const blueMmr = Number(balanceResult.teamBlueMMR ?? balanceResult.blueMmr ?? Math.round(blueAvg * teamBlue.length));
  const redMmr = Number(balanceResult.teamRedMMR ?? balanceResult.redMmr ?? Math.round(redAvg * teamRed.length));
  const mmrDiff = Math.abs(blueMmr - redMmr);
  const isCloseMatch = mmrDiff <= 50;

  return (
    <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-foreground">🔮 実力予測 (Elo) ＆ 接戦度診断（90点以上で接戦目安）</span>
          {isCloseMatch ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-success-100 text-success-800 border border-success-edge">
              🔥 超接戦（名勝負の予感！）
            </span>
          ) : mmrDiff <= 120 ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 border border-primary-edge">
              ⚔️ 互角（実力拮抗）
            </span>
          ) : (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-surface-subtle text-foreground-subtle border border-border">
              ⚖️ やや戦力差あり (差: {mmrDiff} MMR)
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-strong font-bold">50%に近いほど理想的なバランス</span>
      </div>

      {/* ゲージバー */}
      <div className="flex items-center gap-3">
        <div className="text-right w-24 shrink-0">
          <span className="text-xs font-extrabold text-secondary-700 block">🟦 BLUE TEAM</span>
          <strong className="text-base font-black text-secondary-900 font-mono">{bluePct}%</strong>
        </div>
        <div className="flex-1 h-4 rounded-full overflow-hidden bg-surface-subtle p-0.5 border border-border flex shadow-inner">
          <div
            className="bg-gradient-to-r from-secondary-600 to-secondary-500 rounded-l-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
            style={{ width: `${bluePct}%` }}
          >
            {bluePct >= 20 ? `${bluePct}%` : ''}
          </div>
          <div
            className="bg-gradient-to-l from-danger-600 to-danger-500 rounded-r-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
            style={{ width: `${redPct}%` }}
          >
            {redPct >= 20 ? `${redPct}%` : ''}
          </div>
        </div>
        <div className="text-left w-24 shrink-0">
          <span className="text-xs font-extrabold text-danger-700 block">🟥 RED TEAM</span>
          <strong className="text-base font-black text-danger-900 font-mono">{redPct}%</strong>
        </div>
      </div>
    </div>
  );
}
