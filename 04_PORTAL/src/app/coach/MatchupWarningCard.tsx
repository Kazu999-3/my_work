'use client';

import React, { useState, useEffect } from 'react';

interface MatchupWarningCardProps {
  champion: string;
  enemyChampion: string;
}

export default function MatchupWarningCard({ champion, enemyChampion }: MatchupWarningCardProps) {
  const [warning, setWarning] = useState<{
    champion: string;
    enemyChampion: string;
    memo: string;
    lastUpdatedAt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!champion || !enemyChampion) {
      setWarning(null);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/soloq/matchup-warning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champion, enemyChampion }),
        });
        const data = await res.json();
        setWarning(data.warning || null);
      } catch {
        setWarning(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [champion, enemyChampion]);

  if (!warning || !warning.memo) return null;

  return (
    <div className="mb-4 bg-rose-50 border-2 border-rose-400 rounded-xl p-4 shadow-md animate-fade-in text-stone-900">
      <div className="flex items-center justify-between border-b border-rose-200 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <h4 className="font-extrabold text-rose-950 text-sm">
            【過去の自分からの警戒メモ】 ({warning.champion} vs {warning.enemyChampion})
          </h4>
        </div>
        {warning.lastUpdatedAt && (
          <span className="text-[11px] text-rose-700 font-medium">
            更新: {new Date(warning.lastUpdatedAt).toLocaleDateString('ja-JP')}
          </span>
        )}
      </div>
      <p className="text-xs text-rose-900 font-semibold whitespace-pre-wrap leading-relaxed bg-white/80 p-3 rounded-lg border border-rose-200">
        {warning.memo}
      </p>
    </div>
  );
}
