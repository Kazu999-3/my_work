'use client';

import { RotateCcw, Check } from 'lucide-react';
import { getChampIcon } from '../../../../lib/ddragonClient';
import { REGIONS } from '../../../../lib/championMetadata';
import type { DraftPlayer } from './types';

interface DraftPlayerCardProps {
  player: DraftPlayer;
  onReroll: () => void;
  onSelect: (champId: string) => void;
}

export default function DraftPlayerCard({
  player,
  onReroll,
  onSelect,
}: DraftPlayerCardProps) {
  const isBlue = player.team === 'BLUE';
  const isRed = player.team === 'RED';

  return (
    <div
      className={`rounded-2xl p-3 border shadow-2xs transition-all ${
        player.selectedChampId
          ? 'border-amber-500/70 ring-1 ring-amber-500/20 bg-amber-500/[0.03]'
          : isBlue
          ? 'bg-blue-950/20 border-blue-500/30'
          : isRed
          ? 'bg-rose-950/20 border-rose-500/30'
          : 'bg-surface-subtle border-border'
      }`}
    >
      {/* プレイヤーヘッダー */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center shadow-xs ${
              isBlue ? 'bg-blue-600' : isRed ? 'bg-rose-600' : 'bg-primary-600'
            }`}
          >
            {player.playerNumber}
          </span>
          <span className="text-xs font-black text-foreground">
            プレイヤー {player.playerNumber}
          </span>
          {player.matchupPairIndex && (
            <span className="text-[10px] bg-surface-subtle text-muted-strong font-bold px-2 py-0.5 rounded-full border border-border">
              ⚔️ 対面 {player.matchupPairIndex}
            </span>
          )}
          {player.selectedChampId && (
            <span className="text-[10px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded-md shadow-2xs flex items-center gap-1">
              <Check className="w-3 h-3" /> 確定
            </span>
          )}
        </div>

        {/* 個別リロールボタン */}
        <button
          type="button"
          onClick={onReroll}
          className="text-[10px] text-muted-strong hover:text-primary-600 bg-surface hover:bg-surface-hover px-2 py-0.5 rounded-lg border border-border flex items-center gap-1 transition cursor-pointer"
          title="このプレイヤーの候補だけを余りプールから再抽選"
        >
          <RotateCcw className="w-3 h-3" />
          <span>再抽選</span>
        </button>
      </div>

      {/* 候補チャンピオン群 */}
      <div className="grid grid-cols-3 gap-2">
        {player.champions.map((champ) => {
          const isSelected = player.selectedChampId === champ.id;
          return (
            <button
              key={`${player.playerNumber}-${champ.id}`}
              type="button"
              onClick={() => onSelect(champ.id)}
              className={`relative flex flex-col items-center p-2 rounded-xl border text-center transition cursor-pointer select-none ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-amber-500 shadow-xs'
                  : 'bg-surface hover:bg-surface-hover border-border/80'
              }`}
            >
              <div
                className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-transform ${
                  isSelected
                    ? 'border-amber-500 scale-105 shadow-sm'
                    : 'border-border'
                }`}
              >
                <img
                  src={getChampIcon(champ.id)}
                  alt={champ.name}
                  className="w-full h-full object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                    <span className="bg-amber-500 text-white p-0.5 rounded-full shadow-xs">
                      <Check className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </div>
              <span
                className={`mt-1.5 text-[11px] font-black truncate w-full px-0.5 leading-tight ${
                  isSelected
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
                }`}
              >
                {champ.name}
              </span>
              <span className="text-[9px] text-muted truncate max-w-full">
                {REGIONS[champ.region]?.name || champ.region}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
