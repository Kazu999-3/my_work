'use client';

import { BookOpen } from 'lucide-react';
import type { PreviewResult } from './types';

// プレビュー: チャンピオン教本（matchup_sentinel）への追記文面
// 2026-10-07: app/admin/review/page.tsx（1,691行）から分割。表示内容・動作は分割前と同じ。
export default function StrategyPreviewTab({ previewData }: { previewData: PreviewResult | null }) {
  return (
                      <div className="space-y-3">
                        <div className="text-[11px] text-zinc-400">
                          マスター教本（`matchup_sentinel`）の末尾に、以下の節見出しとともに追記されます。
                        </div>
                        {previewData?.championPreviews && previewData.championPreviews.length > 0 ? (
                          previewData.championPreviews.map((cp) => (
                            <div key={cp.id} className="p-4 rounded-xl bg-zinc-950 border border-blue-900/50 space-y-2">
                              <div className="flex items-center justify-between text-xs text-blue-300 font-bold border-b border-zinc-800 pb-2">
                                <span className="flex items-center gap-1.5">
                                  <BookOpen size={14} />
                                  <span>対象: {cp.name}（ID: {cp.id}）</span>
                                </span>
                                <span className="font-mono text-[10px] text-zinc-500">{cp.matchupId}</span>
                              </div>
                              <div className="p-3 bg-[#111115] rounded-lg border border-zinc-800/80 max-h-72 overflow-y-auto font-sans leading-relaxed text-zinc-200 text-xs whitespace-pre-wrap select-text">
                                {cp.sectionText}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
                            対象チャンピオンが指定されていないため、チャンピオン教本への追記は行われません（ライブラリに残ります）。
                          </p>
                        )}
                      </div>
  );
}
