'use client';

import React, { useState } from 'react';
import { getChampIcon, formatChampId, DDRAGON_FALLBACK_PATCH } from '@/lib/ddragonClient';

interface ChampAvatarProps {
  champion: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  alt?: string;
}

const SIZE_MAP = {
  sm: 'w-5 h-5 rounded-md text-[10px]',
  md: 'w-8 h-8 rounded-lg text-xs',
  lg: 'w-10 h-10 rounded-xl text-sm',
};

export default function ChampAvatar({
  champion,
  size = 'md',
  className = '',
  alt,
}: ChampAvatarProps) {
  const [errorLevel, setErrorLevel] = useState<number>(0);

  const formattedId = formatChampId(champion);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  // 1. 通常: getChampIcon(champion)
  // 2. エラー1回目: 確実な公式フォールバックパッチ (DDRAGON_FALLBACK_PATCH)
  // 3. エラー2回目: 公式プロファイルアイコン (profileicon/29.png)
  // 4. エラー3回目: 頭文字アバター（画像が完全不通の時）

  const getSourceUrl = () => {
    if (errorLevel === 0) {
      return getChampIcon(champion);
    }
    if (errorLevel === 1) {
      return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_FALLBACK_PATCH}/img/champion/${formattedId}.png`;
    }
    if (errorLevel === 2) {
      return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_FALLBACK_PATCH}/img/profileicon/29.png`;
    }
    return '';
  };

  const handleError = () => {
    setErrorLevel((prev) => prev + 1);
  };

  // 画像が完全エラー（level >= 3）またはURLが空の場合は頭文字アバターを表示
  if (errorLevel >= 3) {
    const initials = (champion || '?').slice(0, 2).toUpperCase();
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-amber-600/40 via-zinc-800 to-zinc-900 border border-amber-500/30 flex items-center justify-center font-black text-amber-300 select-none shrink-0 ${className}`}
        title={champion}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={getSourceUrl()}
      alt={alt || champion}
      loading="lazy"
      onError={handleError}
      className={`${sizeClasses} object-cover border border-zinc-800 shrink-0 ${className}`}
    />
  );
}
