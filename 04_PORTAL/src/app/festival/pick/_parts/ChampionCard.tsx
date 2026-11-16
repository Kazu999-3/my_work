'use client';

import { ChampionIcon } from '../../../../components/ChampionIcon';
import { REGIONS, type ChampionMeta } from '../../../../lib/championMetadata';

interface ChampionCardProps {
  meta: ChampionMeta;
  isExcluded: boolean;
  onClick: () => void;
}

export default function ChampionCard({ meta, isExcluded, onClick }: ChampionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center p-1 sm:p-1.5 rounded-xl border transition-all text-center cursor-pointer select-none ${
        isExcluded
          ? 'bg-danger-500/5 border-danger-500/30 opacity-35 hover:opacity-70'
          : 'bg-surface-subtle hover:bg-surface-hover border-border/80 hover:border-primary-500/60 shadow-2xs hover:shadow-sm'
      }`}
      title={`${meta.name} (${REGIONS[meta.region]?.name || meta.region})\nクリックで${isExcluded ? '解除' : '❌除外'}`}
    >
      {/* アイコン枠（ChampionIcon耐障害性対応） */}
      <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-border/80 group-hover:scale-105 transition-transform shadow-xs">
        <ChampionIcon
          champId={meta.id}
          champName={meta.name}
          className="w-full h-full object-cover"
        />

        {/* ❌ 除外オーバーレイ */}
        {isExcluded && (
          <div className="absolute inset-0 bg-danger-950/75 flex items-center justify-center animate-fade-in backdrop-blur-[1px]">
            <span className="text-danger-400 font-black text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">✕</span>
          </div>
        )}
      </div>

      {/* 名前（ダークモード超高視認性） */}
      <span
        className={`mt-1 text-[10px] sm:text-[11px] font-black leading-tight truncate w-full px-0.5 tracking-tight ${
          isExcluded
            ? 'line-through text-faint'
            : 'text-foreground dark:text-zinc-100 group-hover:text-primary-500 dark:group-hover:text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]'
        }`}
      >
        {meta.name}
      </span>
    </button>
  );
}
