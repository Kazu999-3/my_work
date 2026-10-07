"use client";

import Link from "next/link";
import { Search, Zap, BookOpen, AlertTriangle, Layers, ChevronDown, Check, Sparkles, ExternalLink, Video, Eye, Waves, Compass, Edit3, Copy, Crown } from "lucide-react";
import { getStageTactics } from "@/lib/tempoMetrics";
import type { ChampionDetail } from "./types";

// タブ3: 実戦バイブル ＆ 統合マスター戦術書
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function BibleTab({ isGlobalGuideExpanded, setIsGlobalGuideExpanded, globalGuideCopied, setGlobalGuideCopied, openKnowledgeModal, selectedDetail, stageTactics }: {
  isGlobalGuideExpanded: boolean;
  setIsGlobalGuideExpanded: (v: boolean) => void;
  globalGuideCopied: boolean;
  setGlobalGuideCopied: (v: boolean) => void;
  openKnowledgeModal: (id: string | number) => void;
  selectedDetail: ChampionDetail;
  stageTactics: ReturnType<typeof getStageTactics> | null;
}) {
  return (
              <div className="space-y-5">
                {/* 👑 統合戦術マスター教本 (enemy=GLOBAL 由来の原本全文) */}
                {selectedDetail.globalGuide && selectedDetail.globalGuide.strategy && (
                  <div className="bg-gradient-to-b from-amber-950/20 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          <Crown size={20} className="text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              👑 統合戦術マスター教本
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              約{selectedDetail.globalGuide.strategy.length.toLocaleString()}文字
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-black text-zinc-100 mt-1">
                            {selectedDetail.globalGuide.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <button
                          onClick={() => {
                            if (!selectedDetail.globalGuide?.strategy) return;
                            navigator.clipboard.writeText(selectedDetail.globalGuide.strategy);
                            setGlobalGuideCopied(true);
                            setTimeout(() => setGlobalGuideCopied(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                          title="教本全文をクリップボードにコピー"
                        >
                          {globalGuideCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          <span>{globalGuideCopied ? "コピー完了" : "教本をコピー"}</span>
                        </button>

                        <Link
                          href={`/admin/dict-maintenance?c=${encodeURIComponent(selectedDetail.id)}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 transition shadow-sm"
                          title="この教本を編集・節管理"
                        >
                          <Edit3 size={13} />
                          <span className="hidden sm:inline">メンテ編集 ↗</span>
                        </Link>
                      </div>
                    </div>

                    {/* 教本本文（折りたたみ・展開） */}
                    <div className="mt-4 relative">
                      <div
                        className={`text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap transition-all duration-300 ${
                          !isGlobalGuideExpanded ? "max-h-56 overflow-hidden mask-bottom" : ""
                        }`}
                      >
                        {selectedDetail.globalGuide.strategy}
                      </div>

                      {!isGlobalGuideExpanded && (
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent flex items-end justify-center pb-2 pointer-events-none">
                          <button
                            onClick={() => setIsGlobalGuideExpanded(true)}
                            className="pointer-events-auto px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg hover:shadow-amber-500/20 transition cursor-pointer flex items-center gap-2"
                          >
                            <span>📖 統合マスター教本を全文展開（約{selectedDetail.globalGuide.strategy.length.toLocaleString()}文字）</span>
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      )}

                      {isGlobalGuideExpanded && (
                        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex justify-center">
                          <button
                            onClick={() => setIsGlobalGuideExpanded(false)}
                            className="px-4 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-xs border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <span>▲ 教本を折りたたむ</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 🎬 最新再蒸留：実戦動画 プロの思考録 (Video Bibles) */}
                {selectedDetail.videoBibles && selectedDetail.videoBibles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video size={18} className="text-rose-400" />
                        <h3 className="text-sm sm:text-base font-black text-zinc-100">
                          🎬 実戦動画 プロの思考録・生々しいWhy ({selectedDetail.videoBibles.length}本収録)
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/library?q=${encodeURIComponent(selectedDetail.id)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition shadow-sm"
                          title="ライブラリ全952件からこのチャンピオンの記事・動画を検索"
                        >
                          <BookOpen size={13} />
                          <span>📚 ライブラリで全件検索 ↗</span>
                        </Link>
                        <span className="hidden sm:inline-block text-[11px] text-zinc-400 font-bold bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                          YouTube高レート実戦から蒸留
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedDetail.videoBibles.map((vb, idx) => (
                        <div
                          key={vb.id || idx}
                          className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 relative overflow-hidden"
                        >
                          {/* 動画タイトル ＆ リンク */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-black">
                                #{idx + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-black text-zinc-200">
                                {vb.videoTitle || vb.title}
                              </h4>
                            </div>
                            {vb.videoUrl && (
                              <a
                                href={vb.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 hover:text-rose-300 border border-zinc-700 text-xs font-bold transition w-fit"
                              >
                                <span>YouTubeで動画を見る</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          {/* 📌 キラーエピソード（特大名言カード） */}
                          {vb.killerQuote && (
                            <div className="bg-gradient-to-r from-amber-950/30 via-zinc-950/60 to-zinc-950/30 border-l-4 border-amber-500 p-3.5 rounded-r-xl space-y-1">
                              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                                📌 実戦で使えるプロのキラー思考（Whyの言語化）
                              </span>
                              <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed italic">
                                {vb.killerQuote}
                              </p>
                            </div>
                          )}

                          {/* 5大極意グリッド（言及がある項目のみ表示） */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {vb.keyTactics.cameraWork && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-sky-400 flex items-center gap-1 uppercase">
                                  <Eye size={12} /> モンスター狩り中のカメラワーク
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.cameraWork}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.waveRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase">
                                  <Waves size={12} /> ガンク後のウェーブ介入ルール
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.waveRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.smiteRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-amber-400 flex items-center gap-1 uppercase">
                                  <Zap size={12} /> スマイト50/50回避の鉄則
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.smiteRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.comebackRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-purple-400 flex items-center gap-1 uppercase">
                                  <Sparkles size={12} /> 劣勢・崩壊時の逆転シナリオ
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.comebackRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.shadowRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-indigo-400 flex items-center gap-1 uppercase">
                                  <Compass size={12} /> 14分以降の中盤シャドウ（迷子防止）
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.shadowRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.muteRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-rose-400 flex items-center gap-1 uppercase">
                                  🤫 冷徹なオペレーターメンタル（ミュート基準）
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.muteRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.pingsRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-teal-400 flex items-center gap-1 uppercase">
                                  📢 味方を動かすピン誘導術
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.pingsRule}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* 思考トリガー */}
                          {vb.thoughtTrigger && (
                            <div className="bg-zinc-950/50 border border-zinc-800/60 p-2.5 rounded-xl text-[11px] text-zinc-400 flex items-center gap-2">
                              <span className="text-amber-400 font-black shrink-0">💡 思考トリガー:</span>
                              <span className="text-zinc-300 italic">{vb.thoughtTrigger}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 📒 プロ・チャレンジャー実戦思考録（最新ナレッジ連携） */}
                {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-amber-400" />
                        <h3 className="text-sm sm:text-base font-black text-zinc-100">
                          🧠 プロ・チャレンジャー実戦思考録（最新ナレッジ: {selectedDetail.libraryKnowledge.length}件）
                        </h3>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-bold bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                        個人ナレッジ連動
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedDetail.libraryKnowledge.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => openKnowledgeModal(item.id)}
                          className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer group flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-black text-zinc-200 group-hover:text-amber-400 transition leading-snug">
                                {item.title}
                              </h4>
                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-zinc-500 hover:text-amber-400 shrink-0 p-1 rounded hover:bg-zinc-800"
                                  title="元ソースを開く"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>

                            {/* 📺 チャンネル ＆ 文字数バッジ */}
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 flex-wrap">
                              {item.channel && item.channel !== "その他・一般" && (
                                <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 font-bold border border-zinc-800">
                                  📺 {item.channel}
                                </span>
                              )}
                              {item.charCount && item.charCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-zinc-900 text-amber-400 font-mono border border-zinc-800 font-bold">
                                  約{item.charCount.toLocaleString()}字
                                </span>
                              )}
                            </div>

                            {item.snippet && (
                              <p className="text-[11px] text-zinc-400 leading-relaxed font-mono line-clamp-3">
                                {item.snippet}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-900 text-[10px]">
                            <span className="text-zinc-500">{item.tags?.slice(0, 3).map(t => `#${t}`).join(' ')}</span>
                            <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition">詳細を読む →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (!selectedDetail.videoBibles || selectedDetail.videoBibles.length === 0) ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <BookOpen size={16} className="text-zinc-400" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-zinc-200">
                          ライブラリから {selectedDetail.jpName} の過去記事・動画を探す
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          全952件のナレッジアーカイブから関連戦術を逆引き検索できます
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/library?q=${encodeURIComponent(selectedDetail.id)}`}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                    >
                      <Search size={13} />
                      <span>ライブラリで検索 ↗</span>
                    </Link>
                  </div>
                ) : null}

                {/* ⚠️ 絶対地雷行動（トラップ） */}
                {selectedDetail.bible?.traps && selectedDetail.bible.traps.length > 0 && (
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-rose-400 mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} /> ⚠️ やってはいけない絶対地雷行動（即負けトラップ）
                    </h3>
                    <ul className="space-y-2 text-xs">
                      {selectedDetail.bible.traps.map((t, idx) => (
                        <li key={idx} className="bg-rose-950/20 border border-rose-500/30 p-2.5 rounded-xl text-rose-200 flex items-start gap-2">
                          <span className="text-rose-400 font-black">【地雷】</span>
                          <span className="leading-relaxed">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3段階手順（序盤・中盤・終盤） */}
                {(selectedDetail.bible?.stages || stageTactics) && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-zinc-100 mb-3 flex items-center gap-2">
                      <Layers size={16} className="text-amber-400" /> ゲーム展開 3段階手順書
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-amber-400 block mb-1">【序盤・レーン戦】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible?.stages?.early || stageTactics?.early || "Lv2/3先行で有利トレード。"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-emerald-400 block mb-1">【中盤・オブジェクト】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible?.stages?.mid || stageTactics?.mid || "1コア完成でドラゴン・ヘラルド主導。"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-cyan-400 block mb-1">【終盤・集団戦】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible?.stages?.late || stageTactics?.late || "側面・後方からキャリーにCC合わせ。"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Markdown戦術バイブル全文 */}
                {selectedDetail.bible?.rawMarkdown && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-zinc-100 mb-2 flex items-center gap-2">
                      <BookOpen size={16} className="text-amber-400" /> 実戦バイブル原本全文
                    </h3>
                    <div className="p-4 rounded-xl bg-zinc-950 text-xs text-zinc-300 leading-relaxed border border-zinc-800 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {selectedDetail.bible.rawMarkdown}
                    </div>
                  </div>
                )}
              </div>
  );
}
