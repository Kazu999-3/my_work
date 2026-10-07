"use client";

import { ShieldAlert, Swords, Skull, CheckCircle2 } from "lucide-react";
import type { ChampionDetail } from "./types";

// タブ2: 対面相性 ＆ キルライン
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function MatchupTab({ selectedDetail }: {
  selectedDetail: ChampionDetail;
}) {
  return (
              <div className="space-y-4">
                {/* 即死キルライン・コンボ */}
                {selectedDetail.bible?.killCombo && (
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-rose-300 mb-1 flex items-center gap-2">
                      <Skull size={16} className="text-rose-400" /> 即死キルライン ＆ コンボ手順
                    </h3>
                    <p className="text-xs text-zinc-200 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800 mt-2 font-mono">
                      {selectedDetail.bible.killCombo}
                    </p>
                  </div>
                )}

                {/* カモ vs 天敵 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* カモ（有利な展開・強み） */}
                  <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <h3 className="text-sm font-black text-emerald-300">
                          🟢 有利な展開 ＆ 活かすべき強み
                        </h3>
                      </div>
                      {selectedDetail.facts?.strengths && selectedDetail.facts.strengths.length > 0 ? (
                        <div className="space-y-2 text-xs">
                          {selectedDetail.facts.strengths.map((s, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 text-zinc-300 leading-relaxed">
                              <span className="text-emerald-400 font-black mt-0.5">✓</span>
                              <span className="leading-relaxed">{s}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">強み・カモ情報登録なし</p>
                      )}
                    </div>
                  </div>

                  {/* 天敵（不利・カウンター・マストBAN） */}
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert size={16} className="text-rose-400" />
                        <h3 className="text-sm font-black text-rose-300">
                          🔴 不利・天敵 ＆ マストBAN推奨
                        </h3>
                      </div>

                      {/* マストBAN */}
                      {selectedDetail.facts?.mustBan && selectedDetail.facts.mustBan.length > 0 && (
                        <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/50 text-rose-200">
                          <span className="font-black block text-[10px] text-rose-400 uppercase mb-0.5">🚨 マストBAN推奨</span>
                          <span className="font-bold leading-relaxed">{selectedDetail.facts.mustBan.join(" / ")}</span>
                        </div>
                      )}

                      {/* 警戒すべきカウンタータイプ */}
                      {selectedDetail.facts?.counters && selectedDetail.facts.counters.length > 0 && (
                        <div className="space-y-1.5">
                          {selectedDetail.facts.counters.map((c, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-xl border border-rose-500/20 text-zinc-300 leading-relaxed">
                              <span className="text-rose-400 font-black mt-0.5">✕</span>
                              <span className="leading-relaxed">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 弱点・脆さ */}
                      {selectedDetail.facts?.weaknesses && selectedDetail.facts.weaknesses.length > 0 && (
                        <div className="mt-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80 text-zinc-400 text-[11px] leading-relaxed">
                          <span className="text-amber-400 font-bold block mb-0.5">⚠️ 立ち回りの注意点・弱点</span>
                          {selectedDetail.facts.weaknesses.join(" ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Matchup Sentinel 657件 対面相性メモ一覧 */}
                {selectedDetail.matchups && selectedDetail.matchups.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                        <Swords size={16} className="text-amber-400" />
                        個別対面相性メモ ({selectedDetail.matchups.length}件)
                      </h3>
                      <span className="text-[10px] text-zinc-500">チャレンジャー実戦ログ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {selectedDetail.matchups.map((m) => (
                        <div key={m.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-black text-amber-400 text-xs">vs {m.enemy}</span>
                            {m.result && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-bold">
                                {m.result}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {m.note}
                          </p>
                          {m.trap && (
                            <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/20 p-1.5 rounded border border-rose-500/20">
                              ⚠️ 罠: {m.trap}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
  );
}
