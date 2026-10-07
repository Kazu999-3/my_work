'use client';

import { RefreshCw, Tv, Search, ArrowUpDown } from 'lucide-react';
import { LANE_OPTIONS, type LaneKey } from './types';

// 種別タブ・チャンネル・並び替え・検索・レーン絞り込み・件数
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
export default function ReviewControlBar({ type, setType, channel, setChannel, channels, totalAll, total, sort, setSort, searchQuery, setSearchQuery, lane, setLane, laneCounts, loading, onReload }: {
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
}) {
  return (
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          {/* 上段: 種別タブ ＆ チャンネル ＆ ソート ＆ 検索 */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* 左側: 種別タブ */}
            <div className="flex flex-wrap items-center gap-1.5">
              {([['', 'すべて'], ['video', '動画解析'], ['atomic', '分割知見']] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
                    type === k ? 'bg-amber-500/10 border-amber-500/60 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* 右側: チャンネル絞り込み ＆ ソート ＆ 検索 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 📺 チャンネル絞り込み */}
              <div className="relative flex items-center">
                <Tv className="w-3.5 h-3.5 text-red-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className={`pl-8 pr-3 py-1.5 rounded-lg text-xs font-bold border transition appearance-none cursor-pointer ${
                    channel ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                  aria-label="チャンネル絞り込み"
                >
                  <option value="">全チャンネル ({totalAll}件)</option>
                  {channels.map((ch) => (
                    <option key={ch.name} value={ch.name}>
                      {ch.name} ({ch.count}件)
                    </option>
                  ))}
                </select>
              </div>

              {/* ⇅ ソートセレクター */}
              <div className="relative flex items-center">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium hover:border-slate-700 transition appearance-none cursor-pointer"
                  aria-label="並び替え"
                >
                  <option value="created_asc">⏳ 登録古い順</option>
                  <option value="created_desc">📅 登録新しい順</option>
                  <option value="channel_asc">📺 チャンネル順</option>
                  <option value="volume_desc">📚 ボリューム順</option>
                  <option value="title_asc">🔤 タイトル順</option>
                </select>
              </div>

              {/* 🔍 検索ボックス */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="タイトル/本文/チャンプ検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 w-44 md:w-52 transition"
                />
              </div>

              {/* 更新ボタン */}
              <button
                onClick={onReload}
                disabled={loading}
                title="最新に更新"
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* 下段: レーン絞り込みタブ ＆ 件数サマリー */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setLane('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition ${
                  lane === 'ALL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-slate-950/40 text-slate-400 hover:text-slate-200'
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
                        : 'bg-slate-950/40 text-slate-400 hover:text-slate-200'
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
              {(channel || lane !== 'ALL' || searchQuery || type) && (
                <button
                  onClick={() => {
                    setChannel('');
                    setLane('ALL');
                    setSearchQuery('');
                    setType('');
                  }}
                  className="text-amber-400/80 hover:text-amber-300 text-[11px] underline cursor-pointer"
                >
                  フィルター解除
                </button>
              )}
              <span className="text-slate-400 text-xs">
                表示中: <b className="text-amber-300 font-mono">{total}</b>件 / 全体: <span className="font-mono">{totalAll}</span>件
              </span>
            </div>
          </div>
        </div>
  );
}
