"use client";

import Link from "next/link";
import { BookOpen, Layers, X, Plus, ExternalLink, Wrench, History } from "lucide-react";
import type { ChampionDetail } from "./types";

// ⚙️ ツール・管理クイックパレット モーダル
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function ToolPaletteModal({ setIsLaneModalOpen, setFocusedLaneChampId, setIsItemDictModalOpen, setDictFocusKey, setDictFocusValue, setIsIngestOpen, setIsToolModalOpen, setIsRevisionModalOpen, selectedDetail }: {
  setIsLaneModalOpen: (v: boolean) => void;
  setFocusedLaneChampId: (v: string | undefined) => void;
  setIsItemDictModalOpen: (v: boolean) => void;
  setDictFocusKey: (v: string | undefined) => void;
  setDictFocusValue: (v: string | undefined) => void;
  setIsIngestOpen: (v: boolean) => void;
  setIsToolModalOpen: (v: boolean) => void;
  setIsRevisionModalOpen: (v: boolean) => void;
  selectedDetail: ChampionDetail | null;
}) {
  return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsToolModalOpen(false)}
        >
          <div
            className="bg-[#141418] border border-zinc-700/90 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <Wrench size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-zinc-100">
                      ツール ＆ 管理パレット
                    </h3>
                    {selectedDetail && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        {selectedDetail.jpName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    戦術取込・レーン設定・辞書・全体管理
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsToolModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* パレットアクション一覧 */}
            <div className="p-4 sm:p-5 space-y-2.5">
              {/* 1. 知見取込 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setIsIngestOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <Plus size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    {selectedDetail ? `📥 ${selectedDetail.jpName} の戦術知見を取込` : "📥 新規戦術の知見取込"}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    メモや動画URLからAIが戦術を自動分析・抽出
                  </p>
                </div>
              </button>

              {/* 2. 所属レーン編集 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setFocusedLaneChampId(selectedDetail ? selectedDetail.id : undefined);
                  setIsLaneModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <Wrench size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    {selectedDetail ? `🛠️ ${selectedDetail.jpName} の所属レーン編集` : "🛠️ 所属レーン編集"}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    TOP / JG / MID / ADC / SUP の所属設定を変更
                  </p>
                </div>
              </button>

              {/* 3. アイテム翻訳辞書 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setDictFocusKey(undefined);
                  setDictFocusValue(undefined);
                  setIsItemDictModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <BookOpen size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    📖 アイテム翻訳辞書
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    英語・略称 ➔ 日本語アイテム名の対応辞書を管理
                  </p>
                </div>
              </button>

              {/* 4. 編集・統合履歴 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setIsRevisionModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <History size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    {selectedDetail ? `📜 ${selectedDetail.jpName} の編集・統合履歴` : "📜 編集・統合履歴"}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    AI統合による強み・弱み・パワースパイク等の変更履歴
                  </p>
                </div>
              </button>

              <div className="border-t border-zinc-800/80 my-1" />

              {/* 5. 辞典メンテナンス管理 */}
              <Link
                href={selectedDetail ? `/admin/dict-maintenance?c=${encodeURIComponent(selectedDetail.id)}` : "/admin/dict-maintenance"}
                onClick={() => setIsToolModalOpen(false)}
                className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
                  <Layers size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <span>⚙️ 辞典メンテナンス管理</span>
                    <ExternalLink size={12} className="opacity-80" />
                  </div>
                  <p className="text-[11px] text-amber-400/80 mt-0.5 truncate">
                    チャンピオン事実・対面相性・本文の直接編集
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
  );
}
