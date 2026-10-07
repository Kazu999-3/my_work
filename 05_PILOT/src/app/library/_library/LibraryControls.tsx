"use client";

import type React from "react";
import { Search, Sparkles } from "lucide-react";
import { enqueueYoutubeFromClipboard } from "./enqueueYoutube";
import type { LibraryCategory, LibrarySort } from "./types";

// カテゴリ切り替え（LoL戦術 / 一般ナレッジ）・検索・URL投函・チャンネル絞り込み・並び替え
// 2026-10-07: app/library/page.tsx（796行）から分割。表示内容・動作は分割前と同じ。
export default function LibraryControls({ activeCategory, counts, search, setSearch, totalCount, channels, selectedChannel, selectedSort, onCategoryChange, onSearchSubmit, onChannelChange, onSortChange }: {
  activeCategory: LibraryCategory;
  counts: { lol: number; general: number; all: number };
  search: string;
  setSearch: (v: string) => void;
  totalCount: number;
  channels: { name: string; count: number }[];
  selectedChannel: string;
  selectedSort: LibrarySort;
  onCategoryChange: (c: LibraryCategory) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onChannelChange: (c: string) => void;
  onSortChange: (s: LibrarySort) => void;
}) {
  return (
    <>
        {/* 🧭 カテゴリ切り替えタブ (LoL戦術 vs 一般・AIナレッジ) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-fit">
            <button
              onClick={() => onCategoryChange('lol')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                activeCategory === 'lol'
                  ? 'bg-amber-500 text-zinc-950 shadow-md scale-102'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <span>🎮 LoL戦術アーカイブ</span>
              {counts.lol > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeCategory === 'lol' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-amber-300'
                }`}>
                  {counts.lol}
                </span>
              )}
            </button>

            <button
              onClick={() => onCategoryChange('general')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                activeCategory === 'general'
                  ? 'bg-indigo-600 text-white shadow-md scale-102'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <span>💡 AI・一般ナレッジ</span>
              {counts.general > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeCategory === 'general' ? 'bg-indigo-950 text-indigo-200' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {counts.general}
                </span>
              )}
            </button>
          </div>

          <div className="text-xs text-zinc-400 font-bold px-1">
            {activeCategory === 'lol' ? (
              <span className="text-emerald-400 flex items-center gap-1">
                ✓ 全てチャンピオン辞典またはレーンガイドに直結済み
              </span>
            ) : (
              <span className="text-indigo-300">
                過去のAI開発・ChatGPT・note制作メモ（独立退避エリア）
              </span>
            )}
          </div>
        </div>

        {/* 検索バー ＆ カウンター */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm">
          <form onSubmit={onSearchSubmit} className="relative w-full sm:w-96 flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="戦術記事・知見検索（タイトル、本文、チャンピオン）..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition cursor-pointer"
            >
              検索
            </button>
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={enqueueYoutubeFromClipboard}
              className="px-3 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="コピーしたYouTubeのURLを解析キューに即追加"
            >
              <Sparkles size={13} className="text-indigo-400" />
              <span>📋 URL投函</span>
            </button>
            <div className="text-xs text-zinc-400 font-bold px-1">
              全 <strong className="text-amber-400">{totalCount}</strong> 件の戦術アーカイブ
            </div>
          </div>
        </div>

        {/* 📺 チャンネル絞り込み ＆ ⇅ ソートバー */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800/80 shadow-xs">
          {/* 📺 チャンネルセレクター */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-zinc-400 shrink-0 flex items-center gap-1">
              <span>📺</span>
              <span>チャンネル:</span>
            </span>
            <select
              value={selectedChannel}
              onChange={(e) => onChannelChange(e.target.value)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500/80 max-w-64 cursor-pointer"
            >
              <option value="">全チャンネル ({totalCount}件)</option>
              {channels.map((ch) => (
                <option key={ch.name} value={ch.name}>
                  {ch.name} ({ch.count}件)
                </option>
              ))}
            </select>
            {selectedChannel && (
              <button
                onClick={() => onChannelChange("")}
                className="text-[11px] text-zinc-400 hover:text-rose-400 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 transition cursor-pointer"
                title="チャンネル絞り込み解除"
              >
                ✕ 解除
              </button>
            )}
          </div>

          {/* ⇅ ソートセレクター */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
              <span>⇅</span>
              <span>並び替え:</span>
            </span>
            <select
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value as LibrarySort)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500/80 cursor-pointer"
            >
              <option value="date_desc">📅 取り込み順 (最新)</option>
              <option value="published_desc">📺 動画公開順 (最新)</option>
              <option value="volume_desc">📚 ボリューム順 (文字数)</option>
              <option value="date_asc">⏳ 古い順 (時系列)</option>
              <option value="title_asc">🔤 タイトル順 (五十音)</option>
            </select>
          </div>
        </div>
    </>
  );
}
