'use client';

import React from 'react';
import { Video, AlertCircle, CheckCircle2, Clock, Lightbulb, PlayCircle } from 'lucide-react';
import type { VodReviewPoint } from '@/lib/postgameJgMetrics';

interface VodReviewPointsCardProps {
  points: VodReviewPoint[];
}

export default function VodReviewPointsCard({ points }: VodReviewPointsCardProps) {
  if (points.length === 0) {
    return (
      <section className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-black text-stone-100 uppercase tracking-wider">
            VODピンポイント検証リスト（セルフコーチング）
          </h4>
        </div>
        <p className="text-xs text-stone-400 p-3 rounded-xl bg-stone-950 border border-stone-800">
          オブジェクト直前デスや連続デスなどの深刻なテンポ崩壊イベントは検出されませんでした。安定した立ち回りが維持されています。
        </p>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4">
      {/* ヘッダー */}
      <div className="space-y-1 border-b border-stone-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-black text-stone-100 uppercase tracking-wider">
            VODピンポイント検証リスト（raaaaaq × small_turnsモデル）
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            {points.length}件の抽出ポイント
          </span>
        </div>
        <p className="text-[11px] text-stone-400">
          30分の動画を漫然と眺めるのではなく、タイムラインから自動検出された特定時刻（ミリ秒単位）のプレイを録画で集中的にチェックします。
        </p>
      </div>

      {/* ポイント一覧 */}
      <div className="space-y-3">
        {points.map((p) => {
          const isGood = p.importance === 'GOOD';
          const isHigh = p.importance === 'HIGH';

          return (
            <div
              key={p.id}
              className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                isGood
                  ? 'bg-emerald-950/20 border-emerald-900/50 hover:border-emerald-700/60'
                  : isHigh
                  ? 'bg-rose-950/25 border-rose-900/50 hover:border-rose-700/60'
                  : 'bg-amber-950/20 border-amber-900/50 hover:border-amber-700/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* タイムスタンプ */}
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-stone-950 border border-stone-800 text-stone-100">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {p.timeStr}
                  </span>

                  {/* ステータスバッジ */}
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isGood
                        ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                        : isHigh
                        ? 'bg-rose-900/40 text-rose-300 border-rose-700'
                        : 'bg-amber-900/40 text-amber-300 border-amber-700'
                    }`}
                  >
                    {isGood ? '好テンポ' : isHigh ? '要重点検証' : '注意'}
                  </span>

                  <h5 className="text-xs font-bold text-stone-100">{p.title}</h5>
                </div>
              </div>

              {/* 説明文 */}
              <p className="text-xs text-stone-300 leading-relaxed pl-1">{p.description}</p>

              {/* VOD確認ヒント */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-stone-950/80 border border-stone-800/80 text-[11px] text-stone-300">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-amber-300">VOD検証ポイント: </strong>
                  {p.vodTip}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
