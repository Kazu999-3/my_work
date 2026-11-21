"use client";

import React, { useState, useEffect } from "react";
import { X, Zap, ShieldAlert, Swords, Clock, BookOpen, Loader2 } from "lucide-react";
import type { SentinelRagResponse } from "../../api/tactics/sentinel-rag/route";

interface TacticsSentinelModalProps {
  isOpen: boolean;
  onClose: () => void;
  myChampion: string;
  enemyChampion?: string;
  myPlayerName: string;
  enemyPlayerName?: string;
  role: string;
}

export function TacticsSentinelModal({
  isOpen,
  onClose,
  myChampion,
  enemyChampion,
  myPlayerName,
  enemyPlayerName,
  role,
}: TacticsSentinelModalProps) {
  const [data, setData] = useState<SentinelRagResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !myChampion) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch("/api/tactics/sentinel-rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        myChampion,
        enemyChampion,
        role,
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (!mounted) return;
        if (resData.ok) {
          setData(resData);
        } else {
          setError(resData.error || "虎の巻の取得に失敗しました");
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "通信エラーが発生しました");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, myChampion, enemyChampion, role]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl text-white">
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-amber-300">試合前30秒 虎の巻 (Dynamic RAG)</h3>
              <p className="text-xs text-zinc-400">
                {role} | {myPlayerName} ({myChampion}) vs {enemyPlayerName || "対面"} ({enemyChampion || "未定"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-zinc-400">戦術バイブル149選と対面データを照合中...</p>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-3">
              {/* 虎の巻コードバッジ */}
              {data.recommendedTacticsCode && (
                <div className="flex items-center justify-between bg-amber-950/30 border border-amber-500/20 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        虎の巻 {data.recommendedTacticsCode}
                      </span>
                      <p className="text-xs text-zinc-300 mt-0.5">{data.tacticsAdvice}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3箇条 */}
              <div className="space-y-2.5 text-sm">
                {/* 1. Lv1-3立ち回り */}
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-1">
                    <Swords className="w-3.5 h-3.5" />
                    <span>① Lv1〜3 レーン戦立ち回り</span>
                  </div>
                  <p className="text-zinc-200 text-xs leading-relaxed">{data.threeRules.lv1to3}</p>
                </div>

                {/* 2. パワースパイク警戒 */}
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>② パワースパイク警戒時間</span>
                  </div>
                  <p className="text-zinc-200 text-xs leading-relaxed">{data.threeRules.powerSpikeTiming}</p>
                </div>

                {/* 3. キルチャンス */}
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>③ 仕掛け時・キルチャンス</span>
                  </div>
                  <p className="text-zinc-200 text-xs leading-relaxed">{data.threeRules.killOpportunity}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* フッター */}
        <div className="pt-2 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            閉じる (30秒確認完了)
          </button>
        </div>
      </div>
    </div>
  );
}
