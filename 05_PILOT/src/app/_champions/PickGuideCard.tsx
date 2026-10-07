"use client";

import { Target } from "lucide-react";
import { getDynamicPickGuide } from "@/lib/pickGuideDynamic";

// 🎯 ピック判断ガイド
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function PickGuideCard({ dynamicPickGuide }: {
  dynamicPickGuide: NonNullable<ReturnType<typeof getDynamicPickGuide>>;
}) {
  return (
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-amber-400" />
                    <span className="text-xs sm:text-sm font-black text-zinc-100">
                      🎯 ピック判断ガイド（先出し・後出し・構成マッチング）
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">SOLOQ PICK STRATEGY</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* 1. 先出しおすすめ度 */}
                  <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-zinc-300 flex items-center gap-1.5">
                          🛡️ 先出し適性
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                          dynamicPickGuide.blindPick?.rating === "S"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : dynamicPickGuide.blindPick?.rating === "A"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        }`}>
                          ランク {dynamicPickGuide.blindPick?.rating || "A"} : {dynamicPickGuide.blindPick?.label || "先出し安定"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {dynamicPickGuide.blindPick?.reason}
                      </p>
                    </div>
                  </div>

                  {/* 2. 後出し刺さり条件 */}
                  <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-zinc-300 flex items-center gap-1.5">
                          ⚔️ 後出しカウンター
                        </span>
                        <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                          刺さる相手
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                        {dynamicPickGuide.counterPick?.situation}
                      </p>
                    </div>
                    {dynamicPickGuide.counterPick?.targets && dynamicPickGuide.counterPick.targets.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-zinc-900">
                        <span className="text-[10px] text-zinc-500">有利:</span>
                        {dynamicPickGuide.counterPick.targets.map((tgt, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-purple-300 font-bold">
                            {tgt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. こういう時にピックおすすめ */}
                  <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-zinc-300 flex items-center gap-1.5">
                          💡 こういう時に出す
                        </span>
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          味方構成トリガー
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-medium leading-relaxed mb-1.5">
                        {dynamicPickGuide.whenToPick?.teamSynergy}
                      </p>
                    </div>
                    {dynamicPickGuide.whenToPick?.winCondition && (
                      <div className="text-[10px] text-zinc-500 bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-900">
                        🎯 勝ち筋: <span className="text-zinc-300">{dynamicPickGuide.whenToPick.winCondition}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
  );
}
