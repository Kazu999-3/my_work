"use client";

import React from "react";
import Link from "next/link";
import { getChampIcon, getChampSplash } from "@/lib/ddragonClient";
import { Swords, BookOpen, ChevronDown, ChevronUp, Timer, Star, Bot, ExternalLink, Wrench, History } from "lucide-react";
import type { ChampionDetail, DetailTab } from "./types";

// ヒーローバナー＆基本情報＋アクションボタン群＋CD早見表
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function ChampionHeroBanner({ favorites, activeTab, setActiveTab, showCdTable, setShowCdTable, vsMode, setVsMode, vsEnemyId, setIsToolModalOpen, setIsRevisionModalOpen, toggleFavorite, selectedDetail, availableRoles, currentRole, setCurrentRole, currentLaneMeta }: {
  favorites: string[];
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  showCdTable: boolean;
  setShowCdTable: (v: boolean) => void;
  vsMode: boolean;
  setVsMode: (v: boolean) => void;
  vsEnemyId: string;
  setIsToolModalOpen: (v: boolean) => void;
  setIsRevisionModalOpen: (v: boolean) => void;
  toggleFavorite: (champId: string, e?: React.MouseEvent) => void;
  selectedDetail: ChampionDetail;
  availableRoles: string[];
  currentRole: string;
  setCurrentRole: (v: string) => void;
  currentLaneMeta: any;
}) {
  return (
            <div className="relative rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
              {/* 背景スプラッシュ（角丸クリップ） */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-xs"
                  style={{ backgroundImage: `url(${getChampSplash(selectedDetail.id)})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
              </div>

              <div className="relative p-4 sm:p-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-amber-500/60 shadow-lg shrink-0">
                    <img
                      src={getChampIcon(selectedDetail.id)}
                      alt={selectedDetail.jpName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-xl font-black text-zinc-100">
                        {selectedDetail.jpName}
                      </h1>
                      <span className="text-xs font-bold text-zinc-400">
                        ({selectedDetail.id})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
                        {selectedDetail.title}
                      </span>
                      {/* お気に入り星ボタン */}
                      <button
                        onClick={(e) => toggleFavorite(selectedDetail.id, e)}
                        className={`p-1 rounded-lg border transition cursor-pointer ${
                          favorites.includes(selectedDetail.id)
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                        }`}
                        title="お気に入り登録"
                      >
                        <Star size={15} fill={favorites.includes(selectedDetail.id) ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedDetail.tags?.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                          {t}
                        </span>
                      ))}
                      {/* 📊 OP.GG 公式メタデータ（選択中レーン連動） */}
                      {currentLaneMeta ? (
                        <>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-black border ${
                              currentLaneMeta.tierNum === 0 || currentLaneMeta.tierNum === 1
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs"
                                : currentLaneMeta.tierNum === 2
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : currentLaneMeta.tierNum === 3
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {currentLaneMeta.tier}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-200 font-bold border border-zinc-700/80">
                            {currentRole} {currentLaneMeta.rank}位
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                              currentLaneMeta.winRate >= 52
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : currentLaneMeta.winRate >= 50
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            勝率: {currentLaneMeta.winRate}%
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
                            BAN: {currentLaneMeta.banRate}%
                          </span>
                          <a
                            href={`https://www.op.gg/champions/${selectedDetail.id.toLowerCase()}/build/${(currentRole === "BOT" ? "adc" : currentRole).toLowerCase()}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1 transition"
                            title={`OP.GG公式の${selectedDetail.jpName} (${currentRole}) ビルド・スタッツを開く`}
                          >
                            <span>出典: OP.GG</span>
                            <ExternalLink size={9} />
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400 border border-zinc-700/60 font-medium">
                          {currentRole}統計: 圏外 / データ僅少
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* アクションボタン群（VS直接比較 / CD表 / AIコーチ / ライブラリ / レーン切替） */}
                <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                  {/* ⚔️ VS直接比較モード トグルボタン */}
                  <button
                    onClick={() => setVsMode(!vsMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer shadow-sm ${
                      vsMode
                        ? "bg-rose-600 text-white border-rose-500 shadow-rose-950/50 scale-102"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                    }`}
                  >
                    <Swords size={14} className={vsMode ? "text-white" : "text-rose-400"} />
                    <span>{vsMode ? "VS比較を閉じる" : "⚔️ 対面VS直接比較"}</span>
                  </button>

                  {/* 🤖 AIコーチ設計図へジャンプ */}
                  <Link
                    href={`/coach?my=${selectedDetail.id}${vsEnemyId ? `&enemy=${vsEnemyId}` : ''}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs font-bold transition shadow-sm"
                    title="このチャンピオンの即死キルライン・初動JGルート・3段階手順を開く"
                  >
                    <Bot size={14} className="text-indigo-400" />
                    <span>🤖 AIコーチ設計図</span>
                  </Link>

                  {/* 📒 攻略ライブラリ記事・知見タブを開く */}
                  <button
                    onClick={() => {
                      setActiveTab("library");
                      setTimeout(() => {
                        const el = document.getElementById("champ-tabs-nav");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }, 50);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      activeTab === "library"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                    }`}
                    title="このチャンピオンのプロ解説・ライブラリ知見を表示"
                  >
                    <BookOpen size={14} className="text-amber-400" />
                    <span>📒 攻略知見</span>
                    {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-mono">
                        {selectedDetail.libraryKnowledge.length}
                      </span>
                    )}
                  </button>

                  {/* CD早見表トグル */}
                  <button
                    onClick={() => setShowCdTable(!showCdTable)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      showCdTable
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                    }`}
                    title="全スキルのCD秒数早見表を開閉"
                  >
                    <Timer size={14} className="text-amber-400" />
                    <span>{showCdTable ? "CD表を閉じる" : "CD表"}</span>
                    {showCdTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {/* レーンセレクター（対象チャンピオンの所属レーンのみ表示） */}
                  <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 font-bold px-1.5">レーン:</span>
                    {availableRoles.length === 1 ? (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {availableRoles[0]}
                      </span>
                    ) : (
                      availableRoles.map((r) => (
                        <button
                          key={r}
                          onClick={() => setCurrentRole(r)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ${
                            currentRole === r
                              ? "bg-amber-500 text-zinc-950 shadow-sm"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          }`}
                        >
                          {r}
                        </button>
                      ))
                    )}
                  </div>

                  {/* 📜 編集履歴確認ボタン */}
                  <button
                    type="button"
                    onClick={() => setIsRevisionModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/50 transition cursor-pointer shadow-sm"
                    title="各項目のAI統合・編集履歴を確認"
                  >
                    <History size={13} className="text-amber-400" />
                    <span className="hidden sm:inline">履歴</span>
                  </button>

                  {/* ⚙️ ツール・管理メニュー起動ボタン */}
                  <button
                    type="button"
                    onClick={() => setIsToolModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/50 transition cursor-pointer shadow-sm"
                    title="知見取込・レーン設定・アイテム辞書・管理メニュー"
                  >
                    <Wrench size={13} className="text-amber-400" />
                    <span>ツール</span>
                  </button>
                </div>
              </div>

              {/* 全スキルCD早見表（トグル表示） */}
              {showCdTable && (
                <div className="border-t border-zinc-800 p-3 bg-zinc-950/90 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-zinc-400 border-b border-zinc-800 text-[11px]">
                      <tr>
                        <th className="py-1.5 px-3">枠</th>
                        <th className="py-1.5 px-3">スキル名</th>
                        <th className="py-1.5 px-3">Lv1</th>
                        <th className="py-1.5 px-3">Lv2</th>
                        <th className="py-1.5 px-3">Lv3</th>
                        <th className="py-1.5 px-3">Lv4</th>
                        <th className="py-1.5 px-3">Lv5</th>
                        <th className="py-1.5 px-3">概要</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {selectedDetail.spells?.map((spell, idx) => {
                        const key = ["Q", "W", "E", "R"][idx];
                        const cds = spell.cooldown || [];
                        return (
                          <tr key={spell.id || idx} className="hover:bg-zinc-900/50">
                            <td className="py-1.5 px-3 font-black text-amber-400">{key}</td>
                            <td className="py-1.5 px-3 font-bold text-zinc-200">{spell.name}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[0] != null ? `${cds[0]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[1] != null ? `${cds[1]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[2] != null ? `${cds[2]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[3] != null ? `${cds[3]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[4] != null ? `${cds[4]}s` : "-"}</td>
                            <td className="py-1.5 px-3 text-zinc-400 text-[11px] max-w-xs truncate">{spell.description}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
  );
}
