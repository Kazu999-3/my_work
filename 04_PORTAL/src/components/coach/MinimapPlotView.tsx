'use client';

import React, { useState } from 'react';
import { SpatialEvent, posToPercent } from '../../lib/mapCoordinates';

interface Props {
  events: SpatialEvent[];
}

export default function MinimapPlotView({ events }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'DEATH' | 'KILL' | 'OBJECTIVE'>('ALL');
  const [hoveredEvent, setHoveredEvent] = useState<SpatialEvent | null>(null);

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    return ev.type === filter;
  });

  return (
    <div className="bg-stone-900 border border-stone-700 rounded-xl p-3.5 space-y-3 text-stone-100 shadow-xl">
      {/* ヘッダー & フィルタ */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <div>
            <h4 className="text-xs font-black tracking-wide text-amber-400 uppercase">
              サモナーズリフト 空間交戦マップ
            </h4>
            <p className="text-[10px] text-stone-400">
              キル・デス・オブジェクト発生地点の空間分布
            </p>
          </div>
        </div>

        {/* フィルタボタン */}
        <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-lg border border-stone-700 text-[10px] font-bold">
          {(['ALL', 'DEATH', 'KILL', 'OBJECTIVE'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={`px-2 py-0.5 rounded transition ${
                filter === mode
                  ? 'bg-amber-600 text-white font-extrabold shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {mode === 'ALL' && '全表示'}
              {mode === 'DEATH' && '💀 デス'}
              {mode === 'KILL' && '⚔️ キル'}
              {mode === 'OBJECTIVE' && '🐉 オブジェクト'}
            </button>
          ))}
        </div>
      </div>

      {/* ミニマップ本体 */}
      <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-lg overflow-hidden border-2 border-stone-700 shadow-inner bg-[#14231f]">
        {/* サモナーズリフト風の地形グリッドとリバー（SVG描画） */}
        <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" viewBox="0 0 100 100">
          {/* ベース背景 */}
          <rect width="100" height="100" fill="#0f1f1a" />
          {/* リバー（河川ライン: 左上から右下） */}
          <path
            d="M 20 0 Q 35 30, 65 70 T 100 80"
            fill="none"
            stroke="#1a4d6e"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* レーンライン */}
          {/* Top */}
          <path d="M 10 90 L 10 15 Q 10 10, 15 10 L 90 10" fill="none" stroke="#2c4c3b" strokeWidth="6" />
          {/* Mid */}
          <path d="M 10 90 L 90 10" fill="none" stroke="#2c4c3b" strokeWidth="6" />
          {/* Bot */}
          <path d="M 10 90 L 90 90 Q 95 90, 95 85 L 95 10" fill="none" stroke="#2c4c3b" strokeWidth="6" />
          {/* ピットマーカー */}
          {/* バロン/グラブピット (上) */}
          <circle cx="33" cy="31" r="5" fill="#3b2d54" stroke="#8b5cf6" strokeWidth="1" />
          {/* ドラゴンピット (下) */}
          <circle cx="65" cy="71" r="5" fill="#4a2e18" stroke="#f59e0b" strokeWidth="1" />
          {/* ネクサス */}
          <circle cx="10" cy="90" r="4" fill="#2563eb" />
          <circle cx="90" cy="10" r="4" fill="#dc2626" />
        </svg>

        {/* イベントピンのプロット */}
        {filteredEvents.map((ev, idx) => {
          const { left, top } = posToPercent(ev.position);
          const isDeath = ev.type === 'DEATH';
          const isKill = ev.type === 'KILL';
          const isObj = ev.type === 'OBJECTIVE';

          return (
            <div
              key={idx}
              style={{ left, top }}
              onMouseEnter={() => setHoveredEvent(ev)}
              onMouseLeave={() => setHoveredEvent(null)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 transition-transform hover:scale-150 hover:z-30 ${
                isDeath
                  ? 'text-red-400 bg-red-950/90 border-2 border-red-500 rounded-full p-1 shadow-lg shadow-red-500/50'
                  : isKill
                  ? 'text-emerald-300 bg-emerald-950/90 border-2 border-emerald-400 rounded-full p-1 shadow-lg shadow-emerald-500/50'
                  : 'text-amber-300 bg-amber-950/90 border-2 border-amber-400 rounded-full p-1 shadow-lg shadow-amber-500/50'
              }`}
            >
              <span className="text-[10px] block leading-none font-black">
                {isDeath ? '💀' : isKill ? '⚔️' : '👑'}
              </span>
            </div>
          );
        })}

        {/* 座標なしの場合のメッセージ */}
        {filteredEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-500 font-bold">
            該当する空間イベントはありません
          </div>
        )}
      </div>

      {/* ホバー中または最新のイベント詳細カード */}
      {hoveredEvent ? (
        <div className="bg-stone-800/90 border border-stone-600 rounded-lg p-2.5 text-xs space-y-1 animate-fadeIn">
          <div className="flex items-center justify-between font-black">
            <span className={hoveredEvent.type === 'DEATH' ? 'text-rose-400' : hoveredEvent.type === 'KILL' ? 'text-emerald-400' : 'text-amber-400'}>
              {hoveredEvent.type === 'DEATH' ? '💀 被キル (デス)' : hoveredEvent.type === 'KILL' ? '⚔️ キル獲得' : '👑 オブジェクト'} ({hoveredEvent.min}分{hoveredEvent.sec}秒)
            </span>
            <span className="text-[10px] text-stone-400 bg-stone-900 px-1.5 py-0.5 rounded">
              {hoveredEvent.areaName}
            </span>
          </div>

          <div className="text-[11px] text-stone-300">
            {hoveredEvent.summary}
          </div>

          {hoveredEvent.closestAllyDistance !== null && (
            <div className="text-[10px] text-stone-400 flex items-center gap-2 pt-0.5">
              <span>味方最寄り距離: <strong className="text-amber-300">{hoveredEvent.closestAllyDistance}</strong></span>
              <span>周囲状況: <strong className="text-stone-200">味方{hoveredEvent.alliesCountNearby}人 vs 敵{hoveredEvent.enemiesCountNearby}人</strong></span>
              {hoveredEvent.isolationLevel === 'ISOLATED' && (
                <span className="text-rose-400 font-extrabold bg-rose-950 px-1 rounded">⚠️ 孤立死</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-stone-400 text-center py-1 bg-stone-800/40 rounded-lg border border-stone-800">
          👆 マップ上のピンにカーソルを合わせると、交戦時の味方距離やエリア詳細を表示します
        </div>
      )}
    </div>
  );
}
