"use client";

import Link from "next/link";
import { BookOpen, X, ExternalLink, Copy, Check, Trash2 } from "lucide-react";
import { getChampIcon } from "@/lib/ddragonClient";
import FreshnessBadge from "./FreshnessBadge";
import type { ArticleDetail } from "./types";

// 記事詳細モーダル（旧パッチ警告・辞典/コーチ/レーンガイドへの導線・元ソース・本文、コピー/削除）
// 2026-10-07: app/library/page.tsx（796行）から分割。表示内容・動作は分割前と同じ。
export default function ArticleDetailModal({ detailArticle, detailLoading, copied, deleting, onCopy, onDelete, onClose }: {
  detailArticle: ArticleDetail | null;
  detailLoading: boolean;
  copied: boolean;
  deleting: boolean;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">
                    ARTICLE DETAIL
                  </span>
                  {detailArticle?.patch && (
                    <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono text-[10px] font-bold border border-zinc-700">
                      🏷️ Patch {detailArticle.patch}
                    </span>
                  )}
                  <FreshnessBadge isOldPatch={detailArticle?.is_old_patch} daysAgo={detailArticle?.days_ago} freshness={detailArticle?.freshness} />
                  {detailArticle?.published_at && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      📺 {detailArticle.published_at} 公開
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-black text-zinc-100 truncate">
                  {detailArticle?.title || "記事読み込み中..."}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onCopy}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="本文をコピー"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? "コピー完了" : "コピー"}</span>
                </button>
                <button
                  onClick={onDelete}
                  disabled={!detailArticle || deleting}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/60 text-rose-400 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="この記事をライブラリから削除"
                >
                  <Trash2 size={13} />
                  <span>{deleting ? "削除中..." : "削除"}</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
              {detailLoading ? (
                <div className="py-20 text-center text-zinc-500">記事データを取得中...</div>
              ) : detailArticle ? (
                <>
                  {/* ⚠️ 旧パッチ警告バナー */}
                  {detailArticle.is_old_patch && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                      <span className="text-base shrink-0">⚠️</span>
                      <div className="space-y-0.5">
                        <div className="font-bold text-rose-300">
                          旧パッチ・過去環境のアーカイブです (推定 Patch {detailArticle.patch} / 公開: {detailArticle.published_at || '不明'})
                        </div>
                        <p className="text-[11px] text-rose-300/80 leading-snug">
                          アイテム・ルーンの数値仕様やジャングルペットの仕様など、現在の最新シーズン仕様と乖離している可能性があります。普遍的なマクロや判断原則を中心に参考にしてください。
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 双方向連携バナー */}
                  {detailArticle.champion && detailArticle.champion !== "Unknown" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={getChampIcon(detailArticle.champion)}
                          alt={detailArticle.champion}
                          className="w-6 h-6 rounded-md object-cover border border-indigo-400"
                        />
                        <span className="font-bold text-indigo-200">
                          対象チャンピオン: {detailArticle.champion}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/?c=${encodeURIComponent(detailArticle.champion)}`}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition flex items-center gap-1"
                        >
                          👑 辞典でビルド・思考録を見る
                        </Link>
                        <Link
                          href={`/coach?my=${encodeURIComponent(detailArticle.champion)}`}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          🤖 AIコーチで設計図を見る
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-emerald-400" />
                        <span className="font-bold text-emerald-200">
                          分類: 全JG共通の普遍的マクロ知見
                        </span>
                      </div>
                      <Link
                        href="/lane-guides"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition flex items-center gap-1"
                      >
                        📚 レーンガイド（JG章）で読む ↗
                      </Link>
                    </div>
                  )}

                  {detailArticle.source_url && (
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] flex items-center justify-between gap-2">
                      <span className="text-zinc-400 truncate">元ソース: {detailArticle.source_url}</span>
                      <a
                        href={detailArticle.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:text-amber-300 font-bold shrink-0 flex items-center gap-0.5"
                      >
                        開く <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {detailArticle.content || detailArticle.raw_content || "本文がありません"}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-zinc-500">記事の取得に失敗しました。</div>
              )}
            </div>
          </div>
        </div>
  );
}
