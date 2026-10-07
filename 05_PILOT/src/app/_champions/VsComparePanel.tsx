"use client";

import Link from "next/link";
import championsSummary from "@/data/champions_summary.json";
import { getChampIcon } from "@/lib/ddragonClient";
import { type ChampionArchetype } from "@/lib/archetype";
import { Swords, ArrowRight, Sparkles, Bot } from "lucide-react";
import type { ChampionSummary, ChampionDetail, MatchupItem } from "./types";

// ⚔️ 対面VS直接比較パネル (Split View)
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function VsComparePanel({ vsEnemyId, setVsEnemyId, selectedDetail, vsEnemyDetail, archetype, vsEnemyArchetype, matchedVsNote }: {
  vsEnemyId: string;
  setVsEnemyId: (v: string) => void;
  selectedDetail: ChampionDetail;
  vsEnemyDetail: ChampionDetail | null;
  archetype: ChampionArchetype;
  vsEnemyArchetype: ChampionArchetype;
  matchedVsNote: MatchupItem | null | undefined;
}) {
  return (
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-rose-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Swords size={18} className="text-rose-400" />
                    <h2 className="text-sm sm:text-base font-black text-zinc-100">⚔️ 対面VS直接比較 (Split View)</h2>
                    <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
                      リアルタイム攻略
                    </span>
                  </div>

                  {/* 敵チャンピオン選択セレクター */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-bold text-zinc-400 shrink-0">対戦相手:</span>
                    <select
                      value={vsEnemyId}
                      onChange={(e) => setVsEnemyId(e.target.value)}
                      className="bg-zinc-950 text-zinc-100 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-rose-500 w-full sm:w-60"
                    >
                      <option value="">-- 敵チャンピオンを選択 --</option>
                      {(championsSummary as ChampionSummary[])
                        .filter((c) => c.id !== selectedDetail.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.jpName} ({c.id})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {!vsEnemyId && (
                  <div className="py-6 text-center text-zinc-400 space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-zinc-200">対戦相手のチャンピオンを選択してください</p>
                    <p className="text-[11px] text-zinc-500">自チャンプの立ち回り・強みと、敵チャンプの弱み・パワースパイクを左右に並べて一目で有利不利を比較できます。</p>
                  </div>
                )}

                {vsEnemyId && vsEnemyDetail && (
                  <div className="space-y-4">
                    {/* 🤖 AI戦術コーチへのワンクリック直結バナー */}
                    <Link
                      href={`/coach?my=${selectedDetail.id}&enemy=${vsEnemyDetail.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border border-indigo-500/60 hover:border-indigo-400 text-white transition-all shadow-md group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow">
                          <Bot size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-white group-hover:text-indigo-200 transition">
                            🤖 この対面で「AI戦術コーチ（試合前設計図）」を開く
                          </span>
                          <p className="text-[10px] text-indigo-300">
                            Lv6即死境界キルライン ＋ 3段階手順書 ＋ 敵JG初動ルート（スカトル争奪）を即時計算
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0" />
                    </Link>

                    {/* 🎯 この対面専用の特化攻略メモ（存在する場合に最優先表示） */}
                    {matchedVsNote && (
                      <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-black text-amber-400 flex items-center gap-1.5">
                            <Sparkles size={14} /> 🎯 この対面の特化攻略メモ (Matchup Sentinel)
                          </span>
                          {matchedVsNote.result && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-bold">
                              {matchedVsNote.result}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-200 leading-relaxed text-[11px]">
                          {matchedVsNote.note}
                        </p>
                        {matchedVsNote.trap && (
                          <div className="mt-1.5 text-[11px] text-rose-300 bg-rose-950/30 p-1.5 rounded border border-rose-500/30">
                            ⚠️ 罠: {matchedVsNote.trap}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 左右直接比較グリッド */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 左カラム：自分 (YOU) */}
                      <div className="bg-zinc-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
                          <img
                            src={getChampIcon(selectedDetail.id)}
                            alt={selectedDetail.jpName}
                            className="w-10 h-10 rounded-lg object-cover border border-emerald-500/50"
                          />
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">自分 (YOU)</span>
                            <h3 className="text-sm font-black text-zinc-100">{selectedDetail.jpName}</h3>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">💥 自分の即死キルライン・強み</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {selectedDetail.bible?.killCombo || selectedDetail.facts?.strengths?.[0] || (
                                archetype.includes("assassin") ? "Lv6からのフルバーストで孤立ターゲットを確殺。" :
                                archetype === "marksman" ? "サポのCCに合わせて長射程から連続AAでキルライン到達。" :
                                archetype === "tank" ? "CCチェインからのタワーダイブまたは味方の追従でキル獲得。" :
                                "Lv6ウルト解禁からのスキルコンボで圧倒的有利を獲得。"
                              )}
                            </p>
                          </div>

                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">⚡ 自分のパワースパイク</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {selectedDetail.facts?.powerSpikes ? selectedDetail.facts.powerSpikes.split('\n')[0] : (
                                archetype === "marksman" ? "2〜3コア完成時およびIE獲得時に最大DPSを発揮。" :
                                archetype.includes("assassin") ? "1st脅威コア完成およびLv6到達時に最大スパイク。" :
                                "1stコア完成およびLv6到達時に最大パワースパイク。"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 右カラム：相手 (ENEMY) */}
                      <div className="bg-zinc-950/80 border border-rose-500/30 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
                          <img
                            src={getChampIcon(vsEnemyDetail.id)}
                            alt={vsEnemyDetail.jpName}
                            className="w-10 h-10 rounded-lg object-cover border border-rose-500/50"
                          />
                          <div>
                            <span className="text-[10px] font-bold text-rose-400 uppercase">対戦相手 (ENEMY)</span>
                            <h3 className="text-sm font-black text-zinc-100">{vsEnemyDetail.jpName}</h3>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* 相手の弱み・突くべき隙 */}
                          <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/30">
                            <span className="text-[10px] font-bold text-rose-400 block mb-0.5">⚠️ 相手の弱み・突くべき隙</span>
                            <p className="text-zinc-200 text-[11px] leading-relaxed">
                              {vsEnemyDetail.facts?.weaknesses && vsEnemyDetail.facts.weaknesses.length > 0
                                ? vsEnemyDetail.facts.weaknesses.join(' / ')
                                : (
                                  vsEnemyArchetype.includes("assassin") ? "耐久が低いため、飛び込みに合わせてハードCCで即フォーカスして返り討ちにする。" :
                                  vsEnemyArchetype === "tank" ? "序盤の低火力・スキルCD中を狙い、割合ダメージで寄りを封じる。" :
                                  vsEnemyArchetype === "marksman" ? "単独行動中の接近戦に弱いため、死角からの急襲やエンゲージで即死を狙う。" :
                                  "スキル空振り後の長いCD中、および低マナ時の仕掛けが極めて有効。"
                                )}
                            </p>
                          </div>

                          {/* 相手のパワースパイク・警戒タイミング */}
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-amber-400 block mb-0.5">💥 相手のパワースパイク・警戒タイミング</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {vsEnemyDetail.facts?.powerSpikes ? vsEnemyDetail.facts.powerSpikes.split('\n')[0] : (
                                vsEnemyArchetype.includes("assassin") ? "Lv6到達時および脅威1コア完成時の急襲に警戒。" :
                                vsEnemyArchetype === "marksman" ? "2コア完成以降の集団戦長射程DPSに警戒。" :
                                "Lv6ウルト取得時および主要1コア完成時に警戒。"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
  );
}
