'use client';

import React, { useState, useEffect, useRef } from 'react';

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
  // 入力欄の共有stateがonChangeのたびに更新されるため、1文字打つごとにAPIを叩いており、
  // デバウンスも無ければレスポンス順序保証も無かった(2026-08-05発覚)。高速入力時に
  // 古いレスポンスが新しい入力の結果を上書きし、一瞬誤った警戒メモが出ることがあった。
  // 400msデバウンス + リクエスト世代カウンタで、最新の入力に対する結果だけを反映する。
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!champion || !enemyChampion) {
      requestIdRef.current += 1;
      setWarning(null);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/soloq/matchup-warning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champion, enemyChampion }),
        });
        const data = await res.json();
        if (requestIdRef.current !== myRequestId) return; // 途中で新しい入力に上書きされていたら破棄
        setWarning(data.warning || null);
      } catch {
        if (requestIdRef.current === myRequestId) setWarning(null);
      } finally {
        if (requestIdRef.current === myRequestId) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
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
