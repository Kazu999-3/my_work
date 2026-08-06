'use client';

import React from 'react';

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-black/5 border border-black/10 rounded-2xl p-4 space-y-3">
          <div className="h-4 bg-stone-300/60 rounded w-1/3" />
          <div className="h-6 bg-stone-300/80 rounded w-2/3" />
          <div className="space-y-1 pt-1">
            <div className="h-3 bg-stone-200/60 rounded w-full" />
            <div className="h-3 bg-stone-200/60 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-black/5 border border-black/10 rounded-2xl p-3 flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-stone-300/80 rounded-full" />
          <div className="h-3 bg-stone-300/60 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}
