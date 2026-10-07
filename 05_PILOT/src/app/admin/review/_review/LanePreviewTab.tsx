'use client';

import { Compass, Sparkles } from 'lucide-react';
import type { PreviewResult } from './types';

// プレビュー: レーンガイド第8章への追記（強調表示 / 統合前後の比較 / 文面の手直し）
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
export default function LanePreviewTab({ previewData, laneViewMode, setLaneViewMode, editedLaneSectionText, setEditedLaneSectionText }: {
  previewData: PreviewResult | null;
  laneViewMode: 'highlight' | 'split' | 'edit';
  setLaneViewMode: (v: 'highlight' | 'split' | 'edit') => void;
  editedLaneSectionText: string;
  setEditedLaneSectionText: (v: string) => void;
}) {
  return (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-zinc-800/80">
                          <div className="text-[11px] text-zinc-400">
                            AI（Gemini）が記事から抽出した本質的なマクロ知見です。攻略バイブル（`lane_guides`）の第8章に追記されます。
                          </div>
                          {previewData?.laneGuidePreview && (
                            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 shrink-0 self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => setLaneViewMode('highlight')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                  laneViewMode === 'highlight'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                ✨ 追記箇所を強調
                              </button>
                              <button
                                type="button"
                                onClick={() => setLaneViewMode('split')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                  laneViewMode === 'split'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                ⇄ 統合前・後を比較
                              </button>
                              <button
                                type="button"
                                onClick={() => setLaneViewMode('edit')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                  laneViewMode === 'edit'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                ✏️ 文面を手直し
                              </button>
                            </div>
                          )}
                        </div>

                        {previewData?.laneGuidePreview ? (
                          <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-900/50 space-y-3">
                            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold border-b border-zinc-800 pb-2">
                              <span className="flex items-center gap-1.5">
                                <Compass size={14} />
                                <span>統合先: {previewData.laneGuidePreview.laneLabel} 攻略バイブル</span>
                              </span>
                              <span className="text-[10px] text-zinc-400 font-normal">
                                （現在収録: <b className="text-emerald-300">{previewData.laneGuidePreview.sourceCount ?? 0}</b> 件の知見アーカイブ）
                              </span>
                            </div>

                            {previewData.laneGuidePreview.error && (
                              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-400">
                                <span className="font-bold">AIによる知見の抽出に失敗しました。記事の全文は統合しません。</span>
                                <span className="block text-rose-300/80 mt-0.5">理由: {previewData.laneGuidePreview.error}</span>
                                <span className="block text-zinc-400 mt-0.5">少し待ってプレビューを開き直すか、「✏️ 文面を手直し」タブで統合したい文面を書いてから承認してください。</span>
                              </div>
                            )}

                            {/* 表示コンテンツ */}
                            {(() => {
                              const displaySection = editedLaneSectionText || previewData.laneGuidePreview.sectionText || '';
                              const existingBody = previewData.laneGuidePreview.existingBody || '';
                              const chapterRegex = /##\s*(?:8\.\s*)?実戦動画・プロ解説からの最新マクロ知見/;
                              const chapterMatch = existingBody.search(chapterRegex);
                              const hasChapter8 = chapterMatch >= 0;
                              const existingChapter8Text = hasChapter8 ? existingBody.slice(chapterMatch).trim() : '';

                              // 1. 手直しエディタモード
                              if (laneViewMode === 'edit') {
                                return (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                                      <span>統合するマクロ知見（Markdown形式で直接編集可能）</span>
                                      <span className="text-emerald-400">※編集内容はリアルタイムにプレビュー・承認へ反映されます</span>
                                    </div>
                                    <textarea
                                      value={editedLaneSectionText}
                                      onChange={(e) => setEditedLaneSectionText(e.target.value)}
                                      rows={14}
                                      className="w-full p-3 bg-[#111115] rounded-lg border border-zinc-800 text-zinc-200 text-xs font-mono leading-relaxed focus:border-emerald-500 focus:outline-none resize-y"
                                      placeholder="レーンガイドに統合する知見文面..."
                                    />
                                  </div>
                                );
                              }

                              // 2. 比較モード（Before / After）
                              if (laneViewMode === 'split') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                                    {/* 左: 統合前（既存の第8章） */}
                                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 max-h-96 overflow-y-auto">
                                      <div className="text-[11px] font-bold text-zinc-400 border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                                        <span>統合前（現在の第8章アーカイブ）</span>
                                        <span className="text-[10px] text-zinc-500">{hasChapter8 ? '既存知見あり' : '未新設'}</span>
                                      </div>
                                      <div className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed font-sans">
                                        {hasChapter8 ? existingChapter8Text : '（まだ第8章アーカイブは存在しません。今回の承認で新設されます）'}
                                      </div>
                                    </div>

                                    {/* 右: 統合後（マージ後完全体） */}
                                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-emerald-900/50 space-y-2 max-h-96 overflow-y-auto">
                                      <div className="text-[11px] font-bold text-emerald-400 border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                                        <span>統合後（新セクションが末尾に追加）</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">+新知見マージ</span>
                                      </div>
                                      {hasChapter8 && (
                                        <div className="text-[11px] text-zinc-500 whitespace-pre-wrap leading-relaxed font-sans line-clamp-6 opacity-75">
                                          {existingChapter8Text}
                                        </div>
                                      )}
                                      {hasChapter8 && (
                                        <div className="text-center text-[10px] text-emerald-400 font-bold py-1 border-t border-b border-emerald-900/60 my-2">
                                          ⬇️ 以下のセクションが末尾に新規追記されます
                                        </div>
                                      )}
                                      <div className="p-3 bg-emerald-950/70 border-2 border-emerald-500/70 rounded-lg text-emerald-100 text-[11px] space-y-2 whitespace-pre-wrap leading-relaxed font-sans shadow-sm">
                                        {displaySection}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              // 3. ハイライト強調表示モード（デフォルト）
                              return (
                                <div className="space-y-3 font-sans">
                                  {/* 既存ガイド文脈 */}
                                  {hasChapter8 ? (
                                    <div className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold border-b border-zinc-800/80 pb-1">
                                        <span>📜 現在の第8章（実戦動画・プロ解説からの最新マクロ知見）</span>
                                        <span>この直後に追記マージされます</span>
                                      </div>
                                      <p className="line-clamp-3 text-zinc-500 italic">
                                        {existingChapter8Text.slice(0, 300)}...
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-900/50 text-[11px] text-blue-300 flex items-center gap-1.5">
                                      <span>🆕 このレーンガイドにはまだ第8章（マクロ知見アーカイブ）がありません。今回の承認で自動新設されます。</span>
                                    </div>
                                  )}

                                  {/* 🟢 今回新しく追記されるブロックの鮮烈ハイライト */}
                                  <div className="p-4 rounded-xl bg-emerald-950/70 border-2 border-emerald-400 shadow-md space-y-2.5">
                                    <div className="flex items-center justify-between pb-2 border-b border-emerald-800/70">
                                      <span className="text-[11px] font-black uppercase px-2 py-0.5 bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/50 flex items-center gap-1 shadow-sm">
                                        <Sparkles size={12} /> + 今回の新規追記セクション（レーンガイド第8章へ追加）
                                      </span>
                                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                                        📚 {displaySection.length.toLocaleString()}文字
                                      </span>
                                    </div>

                                    {/* 追記される知見本文（見出しや箇条書きを美しくフォーマット表示） */}
                                    <div className="text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto p-2.5 bg-black/40 rounded-lg border border-emerald-900/60 font-sans selection:bg-emerald-700">
                                      {displaySection}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
                            「レーンガイドへも統合」がオフのため、レーンガイドへの追記は行われません。
                          </p>
                        )}
                      </div>
  );
}
