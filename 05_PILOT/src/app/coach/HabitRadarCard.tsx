"use client";

import { useState, useEffect } from "react";
import { Eye, ShoppingBag, ShieldAlert, Sparkles, RefreshCw, Crosshair, HelpCircle } from "lucide-react";
import type { HabitRadarSummary } from "@/lib/habitRadar";

interface HabitRadarCardProps {
  puuid?: string;
  riotId?: string;
  championName?: string;
}

export default function HabitRadarCard({ puuid, riotId, championName }: HabitRadarCardProps) {
  const [radar, setRadar] = useState<HabitRadarSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRadar = async () => {
    if (!puuid && !riotId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (puuid) params.set('puuid', puuid);
      if (riotId) params.set('riotId', riotId);
      params.set('count', '6');

      const res = await fetch(`/api/lol/habit-radar?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || '癖データの取得に失敗しました。');
      }

      setRadar(json.radar);
    } catch (err: any) {
      console.error('[HabitRadar] fetch error:', err);
      setError(err.message || 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (puuid || riotId) {
      fetchRadar();
    }
  }, [puuid, riotId]);

  if (!puuid && !riotId) {
    return null;
  }

  return (
    <div className="rounded-xl border border-rose-500/30 bg-gradient-to-b from-rose-950/20 via-zinc-900/40 to-zinc-900/60 p-4 shadow-xl backdrop-blur-md">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
            <Crosshair className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                対面実測スカウター
              </span>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                Habit Radar
              </span>
            </div>
            <h3 className="text-sm font-bold text-zinc-100">
              対面の無意識の癖 暴露レポート {championName && `(${championName})`}
            </h3>
          </div>
        </div>

        <button
          onClick={fetchRadar}
          disabled={loading}
          className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
          title="再取得"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-rose-400" : ""}`} />
        </button>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
          <RefreshCw className="h-6 w-6 animate-spin text-rose-500 mb-2" />
          <p className="text-xs">Riot公式タイムライン実測から直近の癖を解析中...</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && !loading && (
        <div className="my-2 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* 解析結果表示 */}
      {radar && !loading && (
        <div className="mt-3 space-y-2.5">
          {/* 3行スカウター弾丸サマリー (ピル形式) */}
          <div className="grid gap-2">
            {/* 1. 初手ワード */}
            <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/20 bg-sky-950/20 p-2.5 transition hover:border-sky-500/40">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/20 text-sky-400">
                <Eye className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-300">初手ワード癖</span>
                  <span className="text-[11px] font-mono text-sky-400">
                    設置率: {(radar.earlyWard.placementRate * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-200">
                  {radar.earlyWard.advice}
                </p>
              </div>
            </div>

            {/* 2. 1stリコール */}
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-950/20 p-2.5 transition hover:border-amber-500/40">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-400">
                <ShoppingBag className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300">1stリコール癖</span>
                  <span className="text-[11px] font-mono text-amber-400">
                    平均: {radar.firstRecall.averageTimeFormatted}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-200">
                  {radar.firstRecall.advice}
                </p>
              </div>
            </div>

            {/* 3. 序盤被デス傾向 */}
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-950/20 p-2.5 transition hover:border-rose-500/40">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-500/20 text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-300">序盤ガンク耐性・被デス癖</span>
                  <span className="text-[11px] font-mono text-rose-400">
                    10分デス率: {(radar.earlyDeath.deathRateUnder10Min * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-200">
                  {radar.earlyDeath.advice}
                </p>
              </div>
            </div>
          </div>

          {/* フッター母数注記 */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500">
            <span>※ 直近 {radar.sampleGames} 試合のMatch-V5 Timeline実測から機械抽出</span>
            <span className="flex items-center gap-1 text-rose-400/80">
              <Sparkles className="h-3 w-3" /> AI推測ゼロ・実測値のみ
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
