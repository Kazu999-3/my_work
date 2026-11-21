"use client";

import React from "react";
import { RoleIcon, CasinoBadges } from "./helpers";
import type { BalancerPlayer, BalanceTeamMember, ClashResponseData, FestivalRestriction } from "./types";

interface LaneMatchupRowProps {
  role: string;
  pB?: BalanceTeamMember;
  pR?: BalanceTeamMember;
  pBData?: BalancerPlayer;
  pRData?: BalancerPlayer;
  dragOverSlot: string | null;
  swapSource: { team: string; role: string; name: string } | null;
  handicapNames: Set<string>;
  clashData: ClashResponseData | null;
  handleDragStart: (e: React.DragEvent, team: string, role: string, name: string) => void;
  handleDragOver: (e: React.DragEvent, slotKey: string) => void;
  handleDragLeave: () => void;
  handleDropPlayer: (e: React.DragEvent, targetTeam: 'teamBlue' | 'teamRed' | 'spectators', targetRole: string) => void;
  handleSelectSwapPlayer: (team: string, role: string, name: string) => void;
  renderSwapSelect: (team: 'teamBlue' | 'teamRed' | 'spectators', role: string, currentPlayerName: string) => React.ReactNode;
  onOpenTactics?: (role: string, myPlayerName: string, enemyPlayerName: string, myChampion?: string, enemyChampion?: string) => void;
}

export function LaneMatchupRow({
  role,
  pB,
  pR,
  pBData,
  pRData,
  dragOverSlot,
  swapSource,
  handicapNames,
  clashData,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDropPlayer,
  handleSelectSwapPlayer,
  renderSwapSelect,
  onOpenTactics,
}: LaneMatchupRowProps) {
  const offB = pB && pB.mainLane !== 'ALL' && pB.mainLane !== '-' && pB.currentRole !== pB.mainLane;
  const offR = pR && pR.mainLane !== 'ALL' && pR.mainLane !== '-' && pR.currentRole !== pR.mainLane;
  const bKey = `teamBlue-${role}`;
  const rKey = `teamRed-${role}`;
  const bMMR = pB?.mmr || 1200;
  const rMMR = pR?.mmr || 1200;
  const diff = bMMR - rMMR;

  const bFestival = pB?.festivalRestriction as FestivalRestriction | undefined;
  const rFestival = pR?.festivalRestriction as FestivalRestriction | undefined;

  const clash = clashData?.laneClashes?.find((c) => c.role === role);

  return (
    <div className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center bg-black/[0.03] dark:bg-white/[0.02] p-2 md:p-3 rounded-2xl border border-black/5 dark:border-white/5">
      {/* BLUEプレイヤー側 */}
      <div
        draggable={!!pB?.name}
        onDragStart={(e) => handleDragStart(e, 'teamBlue', role, pB?.name || '')}
        onDragOver={(e) => handleDragOver(e, bKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropPlayer(e, 'teamBlue', role)}
        onClick={() => { if (pB?.name) handleSelectSwapPlayer('teamBlue', role, pB.name); }}
        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer select-none ${
          dragOverSlot === bKey
            ? 'border-secondary-edge-strong bg-secondary-100 border-dashed'
            : 'bg-secondary-50 dark:bg-secondary-950/20 border-secondary-edge-soft hover:bg-secondary-100 dark:hover:bg-secondary-900/30'
        } ${swapSource?.name === pB?.name ? 'ring-2 ring-primary-500 bg-primary-100 animate-pulse' : ''}`}
      >
        <div className="flex-1 min-w-[5.5rem]" onClick={(e) => e.stopPropagation()}>
          {renderSwapSelect('teamBlue', role, pB?.name || '')}
        </div>
        {pB?.name && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectSwapPlayer('teamBlue', role, pB.name);
            }}
            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${
              swapSource?.name === pB.name
                ? 'bg-primary-500 text-black'
                : 'text-secondary-700 hover:text-foreground hover:bg-secondary-200'
            }`}
            title="タップして入れ替え"
          >
            ⇄
          </button>
        )}
        {offB && (
          <span className="text-[9px] bg-danger-100 border border-danger-edge text-danger-700 px-1.5 py-0.5 rounded font-black shrink-0">
            ⚠️OFF
          </span>
        )}
        {pB?.name && handicapNames.has(pB.name) && (
          <span
            className="text-[9px] bg-primary-100 border border-primary-edge text-primary-700 px-1.5 py-0.5 rounded font-black shrink-0"
            title="ハンデ参加（オフロール等の制約付き）"
          >
            🎗️ハンデ
          </span>
        )}
        {bFestival && (
          <span
            className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-1 shadow-2xs ${
              bFestival.level === 'heavy'
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                : bFestival.level === 'medium'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
            }`}
            title={`${bFestival.levelLabel}縛り: ${bFestival.description}`}
          >
            <span>{bFestival.level === 'heavy' ? '🔴' : bFestival.level === 'medium' ? '🟡' : '🟢'}</span>
            <span className="truncate max-w-[120px]">{bFestival.title}</span>
          </span>
        )}
        <CasinoBadges player={pBData} />
        {pB?.name && (pB.mainLane !== 'ALL' || pB.subLane !== 'ALL') && (
          <span
            className="text-[9px] bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-muted-strong px-1.5 py-0.5 rounded font-bold shrink-0"
            title="第一希望／第二希望レーン"
          >
            {pB.mainLane !== 'ALL' && pB.mainLane !== '-' ? pB.mainLane : '指定無'}
            {pB.subLane !== 'ALL' && pB.subLane !== '-' ? `/${pB.subLane}` : ''}
          </span>
        )}
        <span className="font-mono text-xs font-bold text-secondary-700 shrink-0 bg-secondary-100 dark:bg-secondary-900/50 px-2 py-0.5 rounded border border-secondary-edge">
          {bMMR}
        </span>
      </div>

      {/* 中央ロール ＆ MMR差 */}
      <div className="col-span-1 flex flex-col items-center py-1">
        <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center shadow-lg">
          <RoleIcon role={role} className="w-4 h-4" />
        </div>
        <span
          className={`text-[10px] font-mono mt-0.5 font-extrabold ${
            diff > 0 ? 'text-secondary-700' : diff < 0 ? 'text-danger-700' : 'text-muted-strong'
          }`}
        >
          {diff > 0 ? `+${diff}` : diff < 0 ? diff : '±0'}
        </span>
        {pB?.name && pR?.name && onOpenTactics && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTactics(role, pB.name, pR.name);
            }}
            className="text-[9px] font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 mt-1 transition-colors flex items-center gap-0.5 shadow-2xs"
            title="試合前30秒 虎の巻を開く"
          >
            ⚡虎の巻
          </button>
        )}
        {clash && clash.games > 0 && (
          <span
            className="text-[8px] font-mono font-bold text-muted-strong bg-surface border border-border px-1 py-0.2 rounded mt-0.5 shadow-2xs whitespace-nowrap cursor-help"
            title={`過去の直接対決: ${clash.bluePlayer} ${clash.blueWins}勝 - ${clash.redWins}勝 ${clash.redPlayer} (${clash.headline || ''})`}
          >
            {clash.blueWins}勝-{clash.redWins}勝
          </span>
        )}
      </div>

      {/* REDプレイヤー側 */}
      <div
        draggable={!!pR?.name}
        onDragStart={(e) => handleDragStart(e, 'teamRed', role, pR?.name || '')}
        onDragOver={(e) => handleDragOver(e, rKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropPlayer(e, 'teamRed', role)}
        onClick={() => { if (pR?.name) handleSelectSwapPlayer('teamRed', role, pR.name); }}
        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer select-none ${
          dragOverSlot === rKey
            ? 'border-danger-edge-strong bg-danger-100 border-dashed'
            : 'bg-danger-50 dark:bg-danger-950/20 border-danger-edge-soft hover:bg-danger-100 dark:hover:bg-danger-900/30'
        } ${swapSource?.name === pR?.name ? 'ring-2 ring-primary-500 bg-primary-100 animate-pulse' : ''}`}
      >
        <span className="font-mono text-xs font-bold text-danger-700 shrink-0 bg-danger-100 dark:bg-danger-900/50 px-2 py-0.5 rounded border border-danger-edge">
          {rMMR}
        </span>
        {offR && (
          <span className="text-[9px] bg-danger-100 border border-danger-edge text-danger-700 px-1.5 py-0.5 rounded font-black shrink-0">
            ⚠️OFF
          </span>
        )}
        {pR?.name && handicapNames.has(pR.name) && (
          <span
            className="text-[9px] bg-primary-100 border border-primary-edge text-primary-700 px-1.5 py-0.5 rounded font-black shrink-0"
            title="ハンデ参加（オフロール等の制約付き）"
          >
            🎗️ハンデ
          </span>
        )}
        {rFestival && (
          <span
            className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-1 shadow-2xs ${
              rFestival.level === 'heavy'
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                : rFestival.level === 'medium'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
            }`}
            title={`${rFestival.levelLabel}縛り: ${rFestival.description}`}
          >
            <span>{rFestival.level === 'heavy' ? '🔴' : rFestival.level === 'medium' ? '🟡' : '🟢'}</span>
            <span className="truncate max-w-[120px]">{rFestival.title}</span>
          </span>
        )}
        <CasinoBadges player={pRData} />
        {pR?.name && (pR.mainLane !== 'ALL' || pR.subLane !== 'ALL') && (
          <span
            className="text-[9px] bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-muted-strong px-1.5 py-0.5 rounded font-bold shrink-0"
            title="第一希望／第二希望レーン"
          >
            {pR.mainLane !== 'ALL' && pR.mainLane !== '-' ? pR.mainLane : '指定無'}
            {pR.subLane !== 'ALL' && pR.subLane !== '-' ? `/${pR.subLane}` : ''}
          </span>
        )}
        {pR?.name && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectSwapPlayer('teamRed', role, pR.name);
            }}
            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${
              swapSource?.name === pR.name
                ? 'bg-primary-500 text-black'
                : 'text-danger-700 hover:text-foreground hover:bg-danger-200'
            }`}
            title="タップして入れ替え"
          >
            ⇄
          </button>
        )}
        <div className="flex-1 min-w-[5.5rem]" onClick={(e) => e.stopPropagation()}>
          {renderSwapSelect('teamRed', role, pR?.name || '')}
        </div>
      </div>
    </div>
  );
}
