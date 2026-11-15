'use client';

import { getChampIcon } from '../../../../lib/ddragonClient';
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
      className={`group relative flex flex-col items-center p-1.5 rounded-xl border transition-all text-center cursor-pointer select-none ${
        isExcluded
          ? 'bg-danger-500/5 border-danger-500/30 opacity-40 hover:opacity-75'
          : 'bg-surface-subtle hover:bg-surface-hover border-border/80 hover:border-primary-500/50 shadow-2xs hover:shadow-sm'
      }`}
      title={`${meta.name} (${REGIONS[meta.region]?.name || meta.region})\nクリックで${isExcluded ? '解除' : '❌除外'}`}
    >
      {/* アイコン枠 */}
      <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-border/80 group-hover:scale-105 transition-transform">
        <img
          src={getChampIcon(meta.id)}
          alt={meta.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        {/* ❌ 除外オーバーレイ */}
        {isExcluded && (
          <div className="absolute inset-0 bg-danger-950/70 flex items-center justify-center animate-fade-in">
            <span className="text-danger-400 font-black text-2xl drop-shadow-md">✕</span>
          </div>
        )}
      </div>

      {/* 名前 */}
      <span
        className={`mt-1 text-[11px] font-bold leading-tight truncate w-full px-0.5 ${
          isExcluded ? 'line-through text-faint' : 'text-foreground-soft group-hover:text-foreground'
        }`}
      >
        {meta.name}
      </span>
    </button>
  );
}
