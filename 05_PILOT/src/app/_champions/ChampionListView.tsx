"use client";

import React from "react";
import Link from "next/link";
import { getChampIcon } from "@/lib/ddragonClient";
import { Search, Star, X, Target, Wrench } from "lucide-react";
import type { ChampionSummary, ChampSort } from "./types";

// 👑 チャンピオン一覧（検索・フィルター・カードグリッド）
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function ChampionListView({ search, setSearch, roleFilter, setRoleFilter, showFavoritesOnly, setShowFavoritesOnly, favorites, champSort, setChampSort, showMatchupPicker, setShowMatchupPicker, setIsLaneModalOpen, setFocusedLaneChampId, opggMeta, setIsToolModalOpen, toggleFavorite, filteredChampions, selectChampion }: {
  search: string;
  setSearch: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (v: boolean) => void;
  favorites: string[];
  champSort: ChampSort;
  setChampSort: (v: ChampSort) => void;
  showMatchupPicker: boolean;
  setShowMatchupPicker: (v: boolean) => void;
  setIsLaneModalOpen: (v: boolean) => void;
  setFocusedLaneChampId: (v: string | undefined) => void;
  opggMeta: any;
  setIsToolModalOpen: (v: boolean) => void;
  toggleFavorite: (champId: string, e?: React.MouseEvent) => void;
  filteredChampions: ChampionSummary[];
  selectChampion: (id: string) => void;
}) {
  return (
          <div className="space-y-3">
            {/* 検索 ＆ フィルターバー */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm relative">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <div className="relative w-full sm:w-80">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="チャンピオン検索 (日本語 / 英語 / 略称: tf, mf, ww...)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* お気に入りのみトグル */}
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                    showFavoritesOnly
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                  title="お気に入りのみ表示"
                >
                  <Star size={13} fill={showFavoritesOnly ? "currentColor" : "none"} className={showFavoritesOnly ? "text-amber-400" : ""} />
                  <span className="hidden sm:inline">お気に入り</span>
                  {favorites.length > 0 && (
                    <span className="text-[10px] px-1 rounded bg-zinc-800 font-mono text-zinc-300">
                      {favorites.length}
                    </span>
                  )}
                </button>

                {/* 🎯 対面相性チェッカートグル */}
                <button
                  onClick={() => setShowMatchupPicker(!showMatchupPicker)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 shadow-sm ${
                    showMatchupPicker
                      ? "bg-rose-500 text-white border-rose-400 shadow-rose-500/20"
                      : "bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/50"
                  }`}
                  title="相手JGを選択して最適ピックを逆引き"
                >
                  <Target size={14} />
                  <span>🎯 対面チェッカー</span>
                </button>

                {/* ⚙️ ツール・管理メニュー起動ボタン（一覧側） */}
                <button
                  type="button"
                  onClick={() => setIsToolModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer shrink-0 shadow-sm"
                  title="知見取込・レーン設定・アイテム辞書・管理メニュー"
                >
                  <Wrench size={13} className="text-amber-400" />
                  <span>ツール</span>
                </button>
              </div>

              {/* ロールタブ ＆ ソートセレクター */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                  {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        roleFilter === r
                          ? "bg-amber-500 text-zinc-950 shadow-sm font-black scale-102"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0">
                  <span className="text-[11px] font-bold text-zinc-400 pl-1.5 hidden sm:inline">⇅ 並び替え:</span>
                  <select
                    value={champSort}
                    onChange={(e) => setChampSort(e.target.value as any)}
                    className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="tier">👑 ティア順 (OP.GG)</option>
                    <option value="name_ja">🔤 名前順 (五十音)</option>
                    <option value="name_en">🔤 英語名 (A-Z)</option>
                    <option value="win_rate">📈 勝率順</option>
                    <option value="knowledge">📚 ナレッジ数順</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 一覧カウンター */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>全 <strong className="text-zinc-200">{filteredChampions.length}</strong> 体</span>
              <span>通称エイリアス・お気に入り・レーン所属カスタム対応</span>
            </div>

            {/* コンパクトなチャンピオンカードグリッド */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredChampions.map((c) => {
                const isFav = favorites.includes(c.id);
                const cardRole = roleFilter !== "ALL" ? (roleFilter === "BOT" ? "ADC" : roleFilter) : (c.roles[0] === "BOT" ? "ADC" : c.roles[0] || "TOP");
                let cardMeta = opggMeta?.lanes?.[cardRole]?.[c.id];
                if (!cardMeta && roleFilter === "ALL") {
                  for (const lane of ["TOP", "JG", "MID", "ADC", "SUP"]) {
                    if (opggMeta?.lanes?.[lane]?.[c.id]) {
                      cardMeta = opggMeta.lanes[lane][c.id];
                      break;
                    }
                  }
                }

                return (
                  <div
                    key={c.id}
                    onClick={() => selectChampion(c.id)}
                    className="group relative rounded-xl bg-zinc-900 border border-zinc-800/80 hover:border-amber-500/50 p-2 flex items-center gap-2.5 transition cursor-pointer hover:shadow-md hover:bg-zinc-850"
                  >
                    {/* コンパクトなアイコン画像 (w-9 h-9) */}
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-zinc-700/80 shrink-0">
                      <img
                        src={getChampIcon(c.id)}
                        alt={c.jpName}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                        loading="lazy"
                      />
                      {c.hasBible && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-zinc-950" title="バイブルあり" />
                      )}
                    </div>

                    {/* チャンピオン情報 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-zinc-100 truncate group-hover:text-amber-400 transition">
                          {c.jpName}
                        </span>
                        {/* お気に入り星ボタン */}
                        <button
                          onClick={(e) => toggleFavorite(c.id, e)}
                          aria-label={isFav ? "お気に入りを解除" : "お気に入りに追加"}
                          className={`p-1 rounded hover:scale-110 transition shrink-0 cursor-pointer ${
                            isFav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Star size={13} fill={isFav ? "currentColor" : "none"} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] text-zinc-500 font-mono truncate">
                          {c.id}
                        </span>
                        {/* レーンバッジ（クリックでクイックメンテ可能） */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusedLaneChampId(c.id);
                            setIsLaneModalOpen(true);
                          }}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-amber-500/50 hover:text-amber-400 transition shrink-0 cursor-pointer flex items-center gap-0.5 font-bold"
                          title={`${c.jpName}のレーン所属を編集`}
                        >
                          <span>{c.roles[0] || "TOP"}</span>
                          {c.roles.length > 1 && (
                            <span className="text-[8px] text-zinc-500">+{c.roles.length - 1}</span>
                          )}
                        </button>
                      </div>

                      {/* OP.GGメタ指標 ＆ サブロール ＆ AIコーチ */}
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-800/40 text-[9px] gap-1">
                        {cardMeta ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`px-1 py-0.2 rounded font-black text-[9px] ${
                                cardMeta.tierNum === 0 || cardMeta.tierNum === 1
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : cardMeta.tierNum === 2
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                              }`}
                            >
                              {cardMeta.tier === "OP" ? "OP" : `T${cardMeta.tierNum}`}
                            </span>
                            <span className="text-[9px] text-zinc-400 font-medium">
                              {cardMeta.winRate}%
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 overflow-hidden">
                            {c.roles.slice(1).map((r) => (
                              <span key={r} className="text-[8px] px-1 rounded bg-zinc-800/80 text-zinc-400 font-mono">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                        <Link
                          href={`/coach?my=${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-1.5 py-0.2 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 font-sans font-bold hover:scale-105 transition text-[10px] ml-auto flex items-center gap-0.5 shrink-0"
                          title={`${c.jpName}のAI戦術コーチを開く`}
                        >
                          <span>🤖</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
  );
}
