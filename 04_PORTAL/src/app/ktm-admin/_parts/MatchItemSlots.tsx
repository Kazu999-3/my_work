'use client';

import React from 'react';
import { getItemIcon } from '../../../lib/ddragonClient';

export interface MatchItemSlotsProps {
  items?: number[];
}

export default function MatchItemSlots({ items }: MatchItemSlotsProps) {
  if (!items || items.length === 0 || items.every((id) => !id || id <= 0)) return null;

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
      <div className="grid grid-flow-col grid-rows-2 gap-0.5">
        {items.slice(0, 6).map((itemId, i) => {
          const icon = getItemIcon(itemId);
          return (
            <div
              key={i}
              className="w-5 h-5 rounded bg-black/40 border border-border/40 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs"
            >
              {icon ? (
                <img
                  src={icon}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-black/20" />
              )}
            </div>
          );
        })}
      </div>
      {/* トリンケット枠 */}
      {items[6] !== undefined && items[6] > 0 && (
        <div className="w-5 h-5 rounded-full bg-black/40 border border-amber-500/30 overflow-hidden flex items-center justify-center shrink-0 ml-0.5 self-center shadow-2xs">
          {getItemIcon(items[6]) ? (
            <img
              src={getItemIcon(items[6])!}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-black/20" />
          )}
        </div>
      )}
    </div>
  );
}
