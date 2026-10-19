'use client';

import React, { useState, useEffect } from 'react';
import { Swords, AlertTriangle, TrendingUp, TrendingDown, Target, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import type { LaneDiffReport } from '@/lib/laneDiffAnalyzer';

interface LaneDiffCardProps {
  riotId: string;
  matchId?: string;
}

export default function LaneDiffCard({ riotId, matchId }: LaneDiffCardProps) {
  const [report, setReport] = useState<LaneDiffReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!riotId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('riotId', riotId);
    if (matchId) params.set('matchId', matchId);

    fetch(`/api/lol/lane-diff?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'レーン戦データの取得に失敗しました。');
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setReport(data.report || null);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [riotId, matchId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex items-center justify-center gap-2 text-xs text-stone-400">
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        <span>序盤14分のタイムラインからレーン戦の分岐点を解析中...</span>
      </div>
    );
  }

  if (error || !report) {
    return null; // データがない時は静かに隠す
  }

  const { verdict, diffAt10, diffAt14, selfChampion, enemyChampion, selfRole, turningPoint, timelineMinutes } = report;

  const isWon = verdict === 'LANE_WON';
  const isLost = verdict === 'LANE_LOST';

  const badgeBg = isWon
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : isLost
    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
    : 'bg-amber-500/10 border-amber-500/30 text-amber-400';

  const badgeText = isWon
    ? '🏆 レーン戦勝利 (+優位獲得)'
    : isLost
    ? '💥 レーン戦敗北 (対面リード)'
    : '⚖️ レーン戦互角 (均衡)';

  return (
    <section className="rounded-2xl border border-stone-800 bg-stone-900/80 p-4 space-y-4 shadow-lg backdrop-blur-sm">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              レーン戦の勝敗分岐点
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">0〜14分実測</span>
            </h3>
            <p className="text-[11px] text-stone-400">
              {selfRole} 対面: <span className="font-bold text-stone-200">{selfChampion}</span> vs{' '}
              <span className="font-bold text-stone-200">{enemyChampion}</span>
            </p>
          </div>
        </div>

        <div className={`px-2.5 py-1 rounded-full border text-xs font-black flex items-center gap-1.5 ${badgeBg}`}>
          {isWon && <TrendingUp className="w-3.5 h-3.5" />}
          {isLost && <TrendingDown className="w-3.5 h-3.5" />}
          {!isWon && !isLost && <Target className="w-3.5 h-3.5" />}
          <span>{badgeText}</span>
        </div>
      </div>

      {/* 10分・14分スタッツ比較ピル */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/60">
          <div className="text-[10px] text-stone-400 mb-1">⏱️ 10分時点の対面差</div>
          <div className="flex items-center justify-between font-mono">
            <span className="text-stone-300">Gold差:</span>
            <span className={diffAt10.goldDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {diffAt10.goldDiff >= 0 ? `+${diffAt10.goldDiff}G` : `${diffAt10.goldDiff}G`}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono mt-0.5">
            <span className="text-stone-300">CS差:</span>
            <span className={diffAt10.csDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {diffAt10.csDiff >= 0 ? `+${diffAt10.csDiff}` : `${diffAt10.csDiff}`}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/60">
          <div className="text-[10px] text-stone-400 mb-1">🛡️ 14分時点（プレート消滅）</div>
          <div className="flex items-center justify-between font-mono">
            <span className="text-stone-300">Gold差:</span>
            <span className={diffAt14.goldDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {diffAt14.goldDiff >= 0 ? `+${diffAt14.goldDiff}G` : `${diffAt14.goldDiff}G`}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono mt-0.5">
            <span className="text-stone-300">CS差:</span>
            <span className={diffAt14.csDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {diffAt14.csDiff >= 0 ? `+${diffAt14.csDiff}` : `${diffAt14.csDiff}`}
            </span>
          </div>
        </div>
      </div>

      {/* 致命的分岐点 (Turning Point) */}
      {turningPoint ? (
        <div
          className={`p-3.5 rounded-xl border ${
            turningPoint.isPositive
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : 'bg-rose-950/20 border-rose-500/30'
          } space-y-2.5`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-black text-xs text-white">
              {turningPoint.isPositive ? (
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{turningPoint.title}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  turningPoint.goldDelta >= 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {turningPoint.goldDelta >= 0 ? `+${turningPoint.goldDelta}G` : `${turningPoint.goldDelta}G`}
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-300 leading-relaxed">{turningPoint.description}</p>

          <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800 text-[11px] text-stone-300 space-y-1">
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <Target className="w-3 h-3" /> 次戦への客観的教訓:
            </span>
            <p className="leading-relaxed">{turningPoint.advice}</p>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-stone-950/40 border border-stone-800/60 text-xs text-stone-400 text-center">
          急激なゴールド落差は見られず、0〜14分間終始互角のレーン戦でした。
        </div>
      )}

      {/* 0〜14分ミニタイムラインバー */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between text-[10px] text-stone-400 px-1">
          <span>0分 (開始)</span>
          <span>ゴールド差推移 (緑=有利 / 赤=不利)</span>
          <span>14分 (プレート終了)</span>
        </div>
        <div className="grid grid-cols-15 gap-0.5 h-3 bg-stone-950 rounded p-0.5 border border-stone-800/60">
          {timelineMinutes.map((snap) => {
            const isPos = snap.goldDiff > 50;
            const isNeg = snap.goldDiff < -50;
            const isTurn = turningPoint && turningPoint.minute === snap.minute;
            return (
              <div
                key={snap.minute}
                title={`${snap.minute}分: Gold差 ${snap.goldDiff >= 0 ? '+' : ''}${snap.goldDiff}G, CS差 ${snap.csDiff >= 0 ? '+' : ''}${snap.csDiff}`}
                className={`rounded-xs transition-all ${
                  isTurn
                    ? 'ring-1 ring-amber-400 ring-offset-1 ring-offset-black z-10'
                    : ''
                } ${
                  isPos
                    ? 'bg-emerald-500'
                    : isNeg
                    ? 'bg-rose-500'
                    : 'bg-stone-700'
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
