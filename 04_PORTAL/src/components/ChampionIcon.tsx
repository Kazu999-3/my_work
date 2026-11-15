'use client';

import React, { useState, useCallback } from 'react';
import { getChampIcon } from '../lib/ddragonClient';

export interface ChampionIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  champId?: string | null;
  champName?: string | null;
  size?: number | string;
  fallbackIcon?: string;
  className?: string;
}

// 既定の安全なフォールバックアイコン（DDragonデフォルトアイコン #29）
const DEFAULT_FALLBACK_URL =
  'https://ddragon.leagueoflegends.com/cdn/16.19.1/img/profileicon/29.png';

/**
 * チャンピオンアイコンの統一画像コンポーネント (耐障害性・404フォールバック完備)
 * - CDN遅延や404発生時に自動で安全な代替画像へフォールバック
 * - lazy loading & async decoding を標準適用
 */
export function ChampionIcon({
  champId,
  champName,
  size,
  fallbackIcon = DEFAULT_FALLBACK_URL,
  className = '',
  alt,
  ...props
}: ChampionIconProps) {
  const [hasError, setHasError] = useState(false);

  const initialSrc = champId ? getChampIcon(champId) : fallbackIcon;
  const [imgSrc, setImgSrc] = useState(initialSrc);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackIcon);
    }
  }, [hasError, fallbackIcon]);

  const style: React.CSSProperties = {
    ...props.style,
    ...(typeof size === 'number'
      ? { width: size, height: size }
      : size
      ? { width: size, height: size }
      : {}),
  };

  return (
    <img
      src={imgSrc}
      alt={alt || champName || champId || 'Champion'}
      onError={handleError}
      loading="lazy"
      decoding="async"
      style={style}
      className={`object-cover select-none ${className}`}
      {...props}
    />
  );
}

export default ChampionIcon;
