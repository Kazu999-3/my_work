"use client";

import { useState, useEffect } from "react";
import { Compass, Footprints, ShieldAlert, Sparkles, RefreshCw, Trees, Bug } from "lucide-react";
import type { JgPathSummary } from "@/lib/jgPathPredictor";

interface JgPredictCardProps {
  puuid?: string;
  riotId?: string;
  championName?: string;
}

export default function JgPredictCard({ puuid, riotId, championName }: JgPredictCardProps) {
  const [prediction, setPrediction] = useState<JgPathSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    if (!puuid && !riotId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (puuid) params.set('puuid', puuid);
      if (riotId) params.set('riotId', riotId);
      params.set('count', '6');

      const res = await fetch(`/api/lol/jg-predict?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'JG行動予測データの取得に失敗しました。');
      }

      setPrediction(json.prediction);
    } catch (err: any) {
      console.error('[JgPredict] fetch error:', err);
      setError(err.message || 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (puuid || riotId) {
      fetchPrediction();
    }
  }, [puuid, riotId]);

  if (!puuid && !riotId) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-zinc-900/40 to-zinc-900/60 p-4 shadow-xl backdrop-blur-md">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Trees className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-white tracking-wide">
                敵JG 行動予測スカウター (Jungle Radar)
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                実測直近{prediction?.sampleGames || 0}戦
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {championName ? `${championName} の` : ''}初手バフ・初ガンク時刻・初オブジェクト傾向
            </p>
          </div>
        </div>

        <button
          onClick={fetchPrediction}
          disabled={loading}
          className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/40"
          title="再取得"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* ローディング・エラー */}
      {loading && (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-emerald-400 font-mono">
          <RefreshCw className="w-4 h-4 animate-spin" />
          タイムライン実測から敵JGの初動ルートを逆算中...
        </div>
      )}

      {error && !loading && (
        <div className="py-4 text-center text-xs text-rose-400 bg-rose-950/20 rounded-lg my-2 border border-rose-900/40">
          ⚠️ {error}
        </div>
      )}

      {/* 予測内容 */}
      {!loading && !error && prediction && (
        <div className="mt-3 space-y-3">
          {/* 3行スカウター弾丸サマリー (ピル) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {prediction.bulletPoints.map((point, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs font-bold text-emerald-200"
              >
                <span>{point}</span>
              </div>
            ))}
          </div>

          {/* 3大指標詳細カード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* 1. 初手バフ傾向 */}
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400 font-bold">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  初動バフ
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-300">
                  {prediction.firstBuff.dominantBuff === 'RED'
                    ? `赤 ${Math.round(prediction.firstBuff.redStartRate * 100)}%`
                    : prediction.firstBuff.dominantBuff === 'BLUE'
                    ? `青 ${Math.round(prediction.firstBuff.blueStartRate * 100)}%`
                    : '柔軟展開'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {prediction.firstBuff.advice}
              </p>
            </div>

            {/* 2. 初ガンク傾向 */}
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400 font-bold">
                  <Footprints className="w-3.5 h-3.5 text-amber-400" />
                  初ガンク
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-300">
                  {prediction.firstGank.averageTimeFormatted || 'なし'}
                  {prediction.firstGank.dominantLane !== 'LOW_ACTIVITY' && ` (${prediction.firstGank.dominantLane})`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {prediction.firstGank.advice}
              </p>
            </div>

            {/* 3. 初オブジェクト傾向 */}
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400 font-bold">
                  <Bug className="w-3.5 h-3.5 text-cyan-400" />
                  初オブジェクト
                </span>
                <span className="text-[11px] font-mono font-bold text-cyan-300">
                  {prediction.firstObjective.dominantType === 'VOIDGRUB'
                    ? '幼虫優先'
                    : prediction.firstObjective.dominantType === 'DRAGON'
                    ? 'ドラゴン優先'
                    : '臨機応変'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {prediction.firstObjective.advice}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
