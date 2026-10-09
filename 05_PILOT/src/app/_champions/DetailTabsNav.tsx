"use client";

import { ShieldAlert, Swords, BookOpen } from "lucide-react";
import type { ChampionDetail, DetailTab } from "./types";

// 🧭 4大タブナビゲーション
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function DetailTabsNav({ activeTab, setActiveTab, selectedDetail }: {
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  selectedDetail: ChampionDetail;
}) {
  return (
            <div id="champ-tabs-nav" className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 scroll-mt-4">
              <button
                onClick={() => setActiveTab("build")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "build"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <Swords size={14} /> ⚔️ 戦略・シチュエーション別ビルド
              </button>
              <button
                onClick={() => setActiveTab("matchup")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "matchup"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <ShieldAlert size={14} /> 🥊 対面相性 ＆ キルライン
                {(() => {
                  const memoCount = selectedDetail.matchups?.length || 0;
                  const articleCount = selectedDetail.libraryKnowledge?.filter(k => /vs|対面/i.test(k.title))?.length || 0;
                  const total = memoCount + articleCount;
                  return total > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-amber-300 text-[10px]">
                      {total}
                    </span>
                  ) : null;
                })()}
              </button>
              <button
                onClick={() => setActiveTab("bible")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "bible"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <BookOpen size={14} /> 🧠 プロの思考録・バイブル
                {selectedDetail.videoBibles && selectedDetail.videoBibles.length > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold">
                    動画{selectedDetail.videoBibles.length}本
                  </span>
                ) : selectedDetail.bible ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ) : null}
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "library"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <BookOpen size={14} /> 📒 ライブラリ攻略知見
                {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 ? (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    activeTab === "library" ? "bg-zinc-950 text-amber-400" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {selectedDetail.libraryKnowledge.length}件
                  </span>
                ) : null}
              </button>
            </div>
  );
}
