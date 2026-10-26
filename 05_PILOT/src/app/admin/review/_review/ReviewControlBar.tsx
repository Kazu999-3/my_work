'use client';

import React, { useState } from 'react';
import { RefreshCw, Tv, Search, ArrowUpDown, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { LANE_OPTIONS, type LaneKey } from './types';

// 種別タブ・チャンネル・並び替え・検索・レーン絞り込み・件数
export default function ReviewControlBar({ type, setType, channel, setChannel, channels, totalAll, total, sort, setSort, searchQuery, setSearchQuery, lane, setLane, laneCounts, loading, onReload, quality, setQuality, qualityCounts }: {
  type: '' | 'video' | 'atomic';
  setType: (v: '' | 'video' | 'atomic') => void;
  channel: string;
  setChannel: (v: string) => void;
  channels: { name: string; count: number }[];
  totalAll: number;
  total: number;
  sort: string;
  setSort: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  lane: LaneKey | 'ALL';
  setLane: (v: LaneKey | 'ALL') => void;
  laneCounts: Record<string, number>;
  loading: boolean;
  onReload: () => void;
  quality: string;
  setQuality: (v: string) => void;
  qualityCounts: { thin?: number; reanalyzed?: number; multi?: number; determined?: number; unknown?: number; approve?: number; check?: number; skip?: number };
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvancedFilter = Boolean(type || quality === 'thin' || quality === 'reanalyzed');

  return (
    <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
      {/* 上段: メイン4大タブ ＆ チャンネル ＆ ソート ＆ 検索 ＆ 詳細トグル */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* 左側: メインタブ（目的直結の4択のみ常時表示） */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setQuality('')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
              quality === '' && !hasAdvancedFilter
                ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            すべて（{totalAll}）
          </button>

          <button
            onClick={() => setQuality(quality === 'determined' ? '' : 'determined')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
              quality === 'determined'
                ? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-200 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="チャンピオンが1体特定できており、教本へ即時統合できる記事"
          >
            🎯 チャンプ確定（{qualityCounts.determined ?? 0}）
          </button>

          <button
            onClick={() => setQuality(quality === 'multi' ? '' : 'multi')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
              quality === 'multi'
                ? 'bg-purple-500/20 border-purple-500/70 text-purple-200 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="複数のチャンピオンを扱っている記事（ナレッジ分解推奨）"
          >
            ✂️ 複数チャンプ（{qualityCounts.multi ?? 0}）
          </button>

          <button
            onClick={() => setQuality(quality === 'unknown' ? '' : 'unknown')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
              quality === 'unknown'
                ? 'bg-amber-500/20 border-amber-500/70 text-amber-200 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="特定チャンピオン未確定（レーン一般論やマクロ知見など）"
          >
            ❓ チャンプ未定（{qualityCounts.unknown ?? 0}）
          </button>
        </div>

        {/* 右側: チャンネル絞り込み ＆ ソート ＆ 検索 ＆ 詳細ボタン */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 📺 チャンネル */}
          <div className="relative flex items-center">
            <Tv className="w-3.5 h-3.5 text-red-400 absolute left-2.5 pointer-events-none" />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className={`pl-8 pr-3 py-1.5 rounded-lg text-xs font-bold border transition appearance-none cursor-pointer ${
                channel ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm' : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
              aria-label="チャンネル絞り込み"
            >
              <option value="">全チャンネル</option>
              {channels.map((ch) => (
                <option key={ch.name} value={ch.name}>
                  {ch.name} ({ch.count})
                </option>
              ))}
            </select>
          </div>

          {/* ⇅ ソート */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-medium hover:border-zinc-700 transition appearance-none cursor-pointer"
              aria-label="並び替え"
            >
              <option value="created_asc">⏳ 登録古い順</option>
              <option value="created_desc">📅 登録新しい順</option>
              <option value="channel_asc">📺 チャンネル順</option>
              <option value="volume_desc">📚 ボリューム順</option>
              <option value="title_asc">🔤 タイトル順</option>
            </select>
          </div>

          {/* 🔍 検索 */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 w-32 sm:w-40 transition"
            />
          </div>

          {/* ⚙️ 詳細フィルター開閉ボタン */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
              hasAdvancedFilter
                ? 'bg-amber-500/20 border-amber-500/70 text-amber-300'
                : showAdvanced
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="詳細フィルター（種別・薄い記事・再解析版）"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>詳細</span>
            {hasAdvancedFilter && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* 更新ボタン */}
          <button
            onClick={onReload}
            disabled={loading}
            title="最新に更新"
            className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white flex items-center cursor-pointer transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ⚙️ 格納された詳細フィルター（アコーディオン） */}
      {showAdvanced && (
        <div className="pt-2 pb-1 px-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* 種別 */}
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 font-bold mr-1">種別:</span>
              {([['', 'すべて'], ['video', '🎬 動画解析'], ['atomic', '✂️ 分割知見']] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                    type === k ? 'bg-amber-500/20 border-amber-500/60 text-amber-200' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <span className="w-px h-4 bg-zinc-800" />

            {/* 品質・状態 */}
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 font-bold mr-1">品質:</span>
              {([['thin', '⚠️ 薄い可能性', qualityCounts.thin], ['reanalyzed', '🔁 再解析版', qualityCounts.reanalyzed]] as const).map(([k, l, n]) => (
                <button
                  key={k}
                  onClick={() => setQuality(quality === k ? '' : k)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                    quality === k ? 'bg-amber-500/20 border-amber-500/60 text-amber-200' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {l}（{n ?? 0}）
                </button>
              ))}
            </div>
          </div>

          {hasAdvancedFilter && (
            <button
              onClick={() => {
                setType('');
                if (quality === 'thin' || quality === 'reanalyzed') setQuality('');
              }}
              className="text-zinc-400 hover:text-zinc-200 text-[11px] underline cursor-pointer"
            >
              詳細条件をリセット
            </button>
          )}
        </div>
      )}

      {/* 下段: レーン絞り込みタブ ＆ 件数サマリー */}
      <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setLane('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition ${
              lane === 'ALL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            全レーン ({laneCounts.ALL || 0})
          </button>
          {LANE_OPTIONS.map((opt) => {
            const count = laneCounts[opt.key] || 0;
            const isSelected = lane === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setLane(isSelected ? 'ALL' : opt.key)}
                className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label.replace(/^.+?\s/, '')}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* 件数サマリー & フィルターリセット */}
        <div className="flex items-center gap-2 text-xs">
          {(channel || lane !== 'ALL' || searchQuery || type || quality) && (
            <button
              onClick={() => {
                setChannel('');
                setLane('ALL');
                setSearchQuery('');
                setType('');
                setQuality('');
              }}
              className="text-amber-400/80 hover:text-amber-300 text-[11px] underline cursor-pointer"
            >
              すべて解除
            </button>
          )}
          <span className="text-zinc-400 text-xs">
            表示中: <b className="text-amber-300 font-mono">{total}</b>件 / 全体: <span className="font-mono">{totalAll}</span>件
          </span>
        </div>
      </div>
    </div>
  );
}
