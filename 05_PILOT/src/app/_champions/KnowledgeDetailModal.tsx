"use client";

import Link from "next/link";
import { BookOpen, X, Check, ExternalLink, Copy } from "lucide-react";
import type { KnowledgeDetail } from "./types";

// 📒 攻略知見詳細ポップアップモーダル
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function KnowledgeDetailModal({ selectedKnowledgeId, setSelectedKnowledgeId, knowledgeDetail, knowledgeLoading, knowledgeCopied, setKnowledgeCopied }: {
  selectedKnowledgeId: string | number | null;
  setSelectedKnowledgeId: (v: string | number | null) => void;
  knowledgeDetail: KnowledgeDetail | null;
  knowledgeLoading: boolean;
  knowledgeCopied: boolean;
  setKnowledgeCopied: (v: boolean) => void;
}) {
  return (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedKnowledgeId(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <BookOpen size={18} />
                </div>
                <h3 className="text-sm sm:text-base font-black text-zinc-100 truncate">
                  {knowledgeDetail?.title || "攻略知見の詳細"}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href={`/library?id=${selectedKnowledgeId}`}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition flex items-center gap-1"
                  title="ライブラリ専用ページで開く"
                >
                  <ExternalLink size={12} />
                  <span className="hidden sm:inline">ライブラリで開く</span>
                </Link>
                <button
                  onClick={() => setSelectedKnowledgeId(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* モーダル本文 */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {knowledgeLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-amber-400">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-zinc-400 font-bold">知見を読み込み中...</span>
                </div>
              ) : knowledgeDetail ? (
                <>
                  {/* メタ情報バー */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {knowledgeDetail.tags?.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    {knowledgeDetail.source_url && (
                      <a
                        href={knowledgeDetail.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
                      >
                        <span>元ソース・動画を見る</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  {/* 本文コピーボタン */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const body = knowledgeDetail.content || knowledgeDetail.raw_content || "";
                        navigator.clipboard.writeText(`# ${knowledgeDetail.title}\n\n${body}`).then(() => {
                          setKnowledgeCopied(true);
                          setTimeout(() => setKnowledgeCopied(false), 2000);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                    >
                      {knowledgeCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{knowledgeCopied ? "コピー完了！" : "本文をコピー"}</span>
                    </button>
                  </div>

                  {/* 本文 */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap text-xs sm:text-sm">
                    {knowledgeDetail.content || knowledgeDetail.raw_content || "本文がありません"}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-zinc-500">知見の取得に失敗しました。</div>
              )}
            </div>
          </div>
        </div>
  );
}
