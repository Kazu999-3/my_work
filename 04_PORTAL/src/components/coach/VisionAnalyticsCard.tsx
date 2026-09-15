'use client';

import React, { useState } from 'react';
import {
  Eye,
  ShieldCheck,
  MapPin,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Compass,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { KAZURIN_VISION_METRICS, KAZURIN_STYLE_PROFILE } from '../../lib/playerStyleProfile';

export default function VisionAnalyticsCard() {
  const vision = KAZURIN_VISION_METRICS;
  const p = KAZURIN_STYLE_PROFILE;
  const [selectedSpot, setSelectedSpot] = useState<number>(0);

  const DEEP_WARD_SPOTS = [
    {
      id: 'enemy_raptors',
      title: '① 敵ラプター裏ブッシュ (最重要)',
      timing: '3:30〜4:00 (1周目フルクリア直後)',
      target: '敵JGの赤バフ側周回・MID/BOTガンクの事前察知',
      benefit: '敵JGがラプターを触る瞬間が映るため、味方MIDとBOTが100%ガンクを回避可能。',
    },
    {
      id: 'enemy_blue_cross',
      title: '② 敵青バフ横・トライ交差点',
      timing: '4:30〜5:30 (ヴォイドグラブ前)',
      target: '敵JGの青サイド侵入・TOPガンク事前察知',
      benefit: 'グラブ湧き前の敵位置を確定させ、安全にヴォイドグラブを触れる。',
    },
    {
      id: 'dragon_deep_entry',
      title: '③ 敵赤バフ裏・リバー連絡通路',
      timing: 'ドラゴン湧き1分前 (4:00/9:00)',
      target: 'ドラゴンへの敵JG・BOTの寄りライン察知',
      benefit: 'ドラゴンファイト時の挟撃を未然に防ぎ、イニシエート権を奪取。',
    },
  ];

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-5 md:p-6 shadow-xs space-y-5">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl text-indigo-600 shadow-2xs shrink-0">
            👁️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-stone-900">
                視界・マップコントロール客観解析
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-full">
                上位 {vision.visionRankPercentile}% (エメラルド級)
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              your.gg ＆ Riot API 客観スタッツから導く視界診断とディープ配置戦略
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-black text-indigo-700">
            分間視界スコア {vision.visionScorePerMin} <span className="text-[10px] font-normal text-stone-400">/分</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold">
            同帯平均 (1.18) 対比 +37%
          </div>
        </div>
      </div>

      {/* 4大メトリクスグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 分間視界スコア */}
        <div className="p-3 bg-stone-50/80 rounded-2xl border border-stone-200/70 space-y-1">
          <div className="text-[10px] font-bold text-stone-500 flex items-center justify-between">
            <span>分間視界 (VS/m)</span>
            <span className="text-indigo-600 font-bold">上位18%</span>
          </div>
          <div className="text-base font-black text-stone-900">
            {vision.visionScorePerMin}
          </div>
          <div className="text-[10px] text-stone-500">
            エメラルド帯上位水準
          </div>
        </div>

        {/* コントロールワード */}
        <div className="p-3 bg-stone-50/80 rounded-2xl border border-stone-200/70 space-y-1">
          <div className="text-[10px] font-bold text-stone-500 flex items-center justify-between">
            <span>ピンクワード</span>
            <span className="text-emerald-600 font-bold">平均の2倍</span>
          </div>
          <div className="text-base font-black text-stone-900">
            {vision.controlWardsPerGame} <span className="text-xs font-normal text-stone-400">本/戦</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold">
            平均生存: {vision.controlWardAvgLifetimeSec}秒
          </div>
        </div>

        {/* ワード設置 */}
        <div className="p-3 bg-stone-50/80 rounded-2xl border border-stone-200/70 space-y-1">
          <div className="text-[10px] font-bold text-stone-500">
            分間ワード設置
          </div>
          <div className="text-base font-black text-stone-900">
            {vision.wardsPlacedPerMin} <span className="text-xs font-normal text-stone-400">個/分</span>
          </div>
          <div className="text-[10px] text-stone-500">
            1戦 20〜25個
          </div>
        </div>

        {/* ワード破壊 */}
        <div className="p-3 bg-stone-50/80 rounded-2xl border border-stone-200/70 space-y-1">
          <div className="text-[10px] font-bold text-stone-500">
            分間ワード破壊
          </div>
          <div className="text-base font-black text-stone-900">
            {vision.wardsClearedPerMin} <span className="text-xs font-normal text-stone-400">個/分</span>
          </div>
          <div className="text-[10px] text-stone-500">
            レンズ＆植物クリア
          </div>
        </div>
      </div>

      {/* 視界配置バランス（自陣防衛 76% vs 敵陣ディープ 24%） */}
      <div className="p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between text-xs font-black text-stone-800">
          <span className="flex items-center gap-1.5">
            <Compass size={14} className="text-amber-600" />
            <span>視界配置バランス ＆ 侵入深度の客観データ</span>
          </span>
          <span className="text-[10px] text-stone-500">
            防衛 {vision.defensiveWardRatioPercent}% / 敵陣攻め {vision.deepWardRatioPercent}%
          </span>
        </div>

        {/* スプリットバー */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded-full bg-stone-200 flex overflow-hidden shadow-inner">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${vision.defensiveWardRatioPercent}%` }}
              title={`自陣・リバー防衛視界: ${vision.defensiveWardRatioPercent}%`}
            />
            <div
              className="h-full bg-amber-500"
              style={{ width: `${vision.deepWardRatioPercent}%` }}
              title={`敵陣ディープ視界: ${vision.deepWardRatioPercent}%`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-emerald-700 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              🛡️ 自陣・リバー防衛視界 ({vision.defensiveWardRatioPercent}%)
            </span>
            <span className="text-amber-700 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              ⚡ 敵陣ディープ視界 ({vision.deepWardRatioPercent}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs pt-1">
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-stone-700 space-y-1">
            <span className="font-bold text-emerald-950 flex items-center gap-1">
              <span>✅</span> 驚異的な生存率（被デス 3.46）の源泉
            </span>
            <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
              自陣侵入経路とオブジェクト前の防衛視界が鉄壁なため、敵JGのインベードや事故死を未然に防げています。
            </p>
          </div>

          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-stone-700 space-y-1">
            <span className="font-bold text-amber-950 flex items-center gap-1">
              <span>⚠️</span> 15分キル関与（KP@15 35%）向上の急所
            </span>
            <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
              敵陣深部へのワードが24%に留まるため、敵JGの初動察知がレーン到達直前になりがちです。敵陣視界を増やすことで味方の被ガンクを劇的に減らせます。
            </p>
          </div>
        </div>
      </div>

      {/* 🎯 3:30 黄金のディープワードスポット3選 */}
      <div className="space-y-2.5">
        <div className="text-xs font-black text-stone-800 flex items-center gap-1.5">
          <MapPin size={14} className="text-indigo-600" />
          <span>🎯 勝率を跳ね上げる「黄金のディープワードスポット 3選」</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEEP_WARD_SPOTS.map((spot, idx) => {
            const isSelected = selectedSpot === idx;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => setSelectedSpot(idx)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-400/30'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="text-xs font-black text-stone-900 truncate">
                  {spot.title}
                </div>
                <div className="text-[10px] font-bold text-indigo-700">
                  ⏰ {spot.timing}
                </div>
                <div className="text-[10px] text-stone-500 line-clamp-2">
                  {spot.target}
                </div>
              </button>
            );
          })}
        </div>

        {/* 選択スポットの詳細解説カード */}
        <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 space-y-1.5 animate-in fade-in">
          <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-indigo-600" />
            <span>{DEEP_WARD_SPOTS[selectedSpot].title} の戦術メリット:</span>
          </div>
          <p className="text-xs text-stone-800 font-medium leading-relaxed">
            {DEEP_WARD_SPOTS[selectedSpot].benefit}
          </p>
        </div>
      </div>
    </div>
  );
}
