"use client";

import React, { memo } from "react";
import { RefreshCw, Trophy } from "lucide-react";

export interface Bo3State {
  isActive: boolean;
  gameNumber: number; // 1, 2, 3
  team1Name: string;
  team2Name: string;
  team1Wins: number;
  team2Wins: number;
  team1IsCurrentlyBlue: boolean;
  isFinished: boolean;
  history: Array<{ game: number; winnerTeamName: string; winnerSide: 'BLUE' | 'RED' }>;
}

interface BalancerBo3ManagerProps {
  bo3State: Bo3State | null;
  onStartBo3?: () => void;
  onRecordBo3Win: (side: 'BLUE' | 'RED') => void;
  onNextBo3Game: () => void;
  onResetBo3: () => void;
}


export const BalancerBo3Manager = memo(function BalancerBo3Manager({
  bo3State,
  onRecordBo3Win,
  onNextBo3Game,
  onResetBo3,
}: BalancerBo3ManagerProps) {
  if (!bo3State) return null;


  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 shadow-md space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <strong className="text-stone-900 text-sm font-black">
            BO3 シリーズ進行中 — 第{bo3State.gameNumber}戦
          </strong>
          {bo3State.gameNumber === 3 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
              🔥 1-1 運命の最終決戦！
            </span>
          )}
          {bo3State.isFinished && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
              🎉 シリーズ決着！
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onResetBo3}
          className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
        >
          BO3を終了
        </button>
      </div>

      {/* チーム別スコア比較 */}
      <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-amber-200">
        {/* BLUEチーム */}
        <div className="text-center space-y-1">
          <span className="text-[11px] font-extrabold text-blue-700 block">
            🔵 BLUE: {bo3State.team1IsCurrentlyBlue ? bo3State.team1Name : bo3State.team2Name}
          </span>
          <div className="flex items-center justify-center gap-1.5 text-lg font-black">
            <span className={`w-3.5 h-3.5 rounded-full border ${ (bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins) >= 1 ? 'bg-blue-600 border-blue-600' : 'bg-stone-200 border-stone-300' }`} />
            <span className={`w-3.5 h-3.5 rounded-full border ${ (bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins) >= 2 ? 'bg-blue-600 border-blue-600' : 'bg-stone-200 border-stone-300' }`} />
            <span className="text-sm font-mono ml-1 text-blue-900">
              ({bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins}勝)
            </span>
          </div>
          {!bo3State.isFinished && (
            <button
              type="button"
              onClick={() => onRecordBo3Win('BLUE')}
              className="mt-1 px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-[11px] border border-blue-300 transition cursor-pointer"
            >
              🔵 この試合 Blue勝利
            </button>
          )}
        </div>

        {/* REDチーム */}
        <div className="text-center space-y-1 border-l border-stone-200">
          <span className="text-[11px] font-extrabold text-rose-700 block">
            🔴 RED: {!bo3State.team1IsCurrentlyBlue ? bo3State.team1Name : bo3State.team2Name}
          </span>
          <div className="flex items-center justify-center gap-1.5 text-lg font-black">
            <span className={`w-3.5 h-3.5 rounded-full border ${ (!bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins) >= 1 ? 'bg-rose-600 border-rose-600' : 'bg-stone-200 border-stone-300' }`} />
            <span className={`w-3.5 h-3.5 rounded-full border ${ (!bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins) >= 2 ? 'bg-rose-600 border-rose-600' : 'bg-stone-200 border-stone-300' }`} />
            <span className="text-sm font-mono ml-1 text-rose-900">
              ({!bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins}勝)
            </span>
          </div>
          {!bo3State.isFinished && (
            <button
              type="button"
              onClick={() => onRecordBo3Win('RED')}
              className="mt-1 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-[11px] border border-rose-300 transition cursor-pointer"
            >
              🔴 この試合 Red勝利
            </button>
          )}
        </div>
      </div>

      {/* 次戦へ進むボタン */}
      {!bo3State.isFinished && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onNextBo3Game}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            第{bo3State.gameNumber + 1}戦へ進む (陣営サイド交代)
          </button>
        </div>
      )}
    </div>
  );
});
