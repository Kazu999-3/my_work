"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getChampIcon } from "@/lib/ddragonClient";
import FreshnessBadge from "./FreshnessBadge";
import type { ArticleItem } from "./types";

// 記事カード（パッチ鮮度・チャンネル・文字数・辞典/レーンガイドへのリンク）
// 2026-10-07: app/library/page.tsx（796行）から分割。表示内容・動作は分割前と同じ。
export default function ArticleCard({ article: a, onOpen }: { article: ArticleItem; onOpen: () => void }) {
  const champs = a.champion ? a.champion.split(",").map(c => c.trim()).filter(Boolean) : [];
  return (
                  <div
                    onClick={onOpen}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer flex flex-col justify-between gap-3 shadow-xs hover:bg-zinc-850"
                  >
                    <div className="space-y-2">
                      {/* 🏷️ パッチ ＆ 鮮度バッジ */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {a.patch && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono text-[10px] font-bold border border-zinc-700">
                            🏷️ Patch {a.patch}
                          </span>
                        )}
                        <FreshnessBadge isOldPatch={a.is_old_patch} daysAgo={a.days_ago} freshness={a.freshness} showUnknownAsModerate />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-xs text-zinc-100 line-clamp-2 leading-snug hover:text-amber-300 transition">
                          {a.title}
                        </h3>
                        {champs.length > 0 && (
                          <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                            <img
                              src={getChampIcon(champs[0])}
                              alt={champs[0]}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* 📺 チャンネル ＆ 文字数バッジ */}
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5 flex-wrap">
                        {a.channel && a.channel !== "その他・一般" && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-bold border border-zinc-700/60 truncate max-w-40">
                            📺 {a.channel}
                          </span>
                        )}
                        {a.char_count && a.char_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-zinc-950 text-amber-400/90 font-mono border border-zinc-800 font-bold">
                            約{a.char_count.toLocaleString()}字
                          </span>
                        )}
                      </div>

                      {/* 🎯 紐付き先ジャンプ（チャンピオン辞典 または レーンガイド） */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
                        {champs.filter(c => c !== "Unknown").map((c) => (
                          <Link
                            key={c}
                            href={`/?c=${encodeURIComponent(c)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition font-black"
                            title={`${c} のチャンピオン辞典・ビルドへジャンプ`}
                          >
                            <img
                              src={getChampIcon(c)}
                              alt={c}
                              className="w-4 h-4 rounded-full object-cover border border-amber-400/40"
                              onError={(ev) => { (ev.target as HTMLElement).style.display = 'none'; }}
                            />
                            <span>{c} 辞典 ↗</span>
                          </Link>
                        ))}

                        {(!a.champion || a.champion === "Unknown" || champs.length === 0) && (
                          <Link
                            href="/lane-guides"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 transition font-black"
                            title="全JG共通の普遍的マクロ（レーンガイド）へジャンプ"
                          >
                            <span>📚 レーンガイド(JG) ↗</span>
                          </Link>
                        )}

                        {a.tags && Array.isArray(a.tags) && a.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 text-[10px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2">
                      <div className="flex items-center gap-2">
                        {a.published_at ? (
                          <span className="text-zinc-400 font-mono" title={`YouTube公開日: ${a.published_at}`}>
                            📺 公開: {a.published_at}
                          </span>
                        ) : (
                          <span title="取込日">📅 取込: {a.created_at ? a.created_at.split("T")[0] : "-"}</span>
                        )}
                      </div>
                      <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                        詳細を読む <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
  );
}
