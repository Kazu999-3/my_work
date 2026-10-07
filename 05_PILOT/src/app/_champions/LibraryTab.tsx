"use client";

import Link from "next/link";
import { Search, BookOpen, Plus, ExternalLink } from "lucide-react";
import type { ChampionDetail } from "./types";

// タブ4: 📒 ライブラリ攻略知見
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function LibraryTab({ setIsIngestOpen, openKnowledgeModal, selectedDetail }: {
  setIsIngestOpen: (v: boolean) => void;
  openKnowledgeModal: (id: string | number) => void;
  selectedDetail: ChampionDetail;
}) {
  return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-zinc-100 flex items-center gap-2">
                        <span>📒 {selectedDetail.jpName} の実戦ナレッジ・攻略知見</span>
                        {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                            {selectedDetail.libraryKnowledge.length}件
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        ライブラリ（personal_knowledge）から自動抽出された、OTP極意・負け筋回避・立ち回りメモ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsIngestOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>知見を追加</span>
                    </button>
                    <Link
                      href={`/library?q=${encodeURIComponent(selectedDetail.jpName)}`}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink size={13} />
                      <span>ライブラリで全体検索</span>
                    </Link>
                  </div>
                </div>

                {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {selectedDetail.libraryKnowledge.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openKnowledgeModal(item.id)}
                        className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-amber-500/60 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3 transition group cursor-pointer"
                        title="クリックしてこの知見の全文・詳細を読む"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-black text-zinc-200 group-hover:text-amber-400 transition leading-snug">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-500 hover:text-amber-400 transition p-1.5 rounded-lg hover:bg-zinc-800"
                                  title="元動画・元ソースを開く"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <Link
                                href={`/library?id=${item.id}`}
                                className="text-zinc-500 hover:text-indigo-400 transition p-1.5 rounded-lg hover:bg-zinc-800"
                                title="ライブラリ専用ページで開く"
                              >
                                <BookOpen size={13} />
                              </Link>
                            </div>
                          </div>

                          {item.snippet && (
                            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-900 font-mono whitespace-pre-wrap group-hover:border-zinc-800 transition">
                              {item.snippet}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                          <div className="flex flex-wrap items-center gap-1">
                            {item.tags?.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openKnowledgeModal(item.id);
                            }}
                            className="text-[11px] font-bold text-amber-400 group-hover:text-amber-300 flex items-center gap-1 ml-auto hover:underline cursor-pointer"
                          >
                            <span>詳細を読む</span>
                            <span>→</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-500">
                      <BookOpen size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-300">
                        {selectedDetail.jpName} に関する直接紐づく知見はまだありません
                      </h4>
                      <p className="text-xs text-zinc-500 max-w-md mx-auto">
                        実戦動画やノートから得たOTPの立ち回り・負け筋メモを取込ボタンから追加すると、ここに即座に反映されます。
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setIsIngestOpen(true)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>{selectedDetail.jpName}の知見をインポート</span>
                      </button>
                      <Link
                        href={`/library?q=${encodeURIComponent(selectedDetail.jpName)}`}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition flex items-center gap-1.5"
                      >
                        <Search size={14} />
                        <span>ライブラリ全件から検索</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
  );
}
