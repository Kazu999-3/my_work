"use client";

import { getPresetBuildDetails, type ChampionArchetype } from "@/lib/archetype";
import { Zap, BookOpen, Edit3 } from "lucide-react";
import { getStageTactics } from "@/lib/tempoMetrics";
import type { ChampionDetail, BuildPreset } from "./types";

// タブ1: 戦略・シチュエーション別ビルド
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function BuildTab({ buildPreset, setBuildPreset, setIsItemDictModalOpen, setDictFocusKey, setDictFocusValue, selectedDetail, archetype, currentBuild, stageTactics }: {
  buildPreset: BuildPreset;
  setBuildPreset: (v: BuildPreset) => void;
  setIsItemDictModalOpen: (v: boolean) => void;
  setDictFocusKey: (v: string | undefined) => void;
  setDictFocusValue: (v: string | undefined) => void;
  selectedDetail: ChampionDetail;
  archetype: ChampionArchetype;
  currentBuild: ReturnType<typeof getPresetBuildDetails>;
  stageTactics: ReturnType<typeof getStageTactics> | null;
}) {
  return (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-zinc-100">
                        シチュエーション別ビルド分岐
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {archetype === "ap_mage" ? "⚡ APメイジ" :
                         archetype === "ap_assassin" ? "🗡️ APアサシン" :
                         archetype === "ad_assassin" ? "🗡️ 脅威アサシン" :
                         archetype === "tank" ? "🛡️ 耐久タンク" :
                         archetype === "marksman" ? "🏹 マークスマン" :
                         archetype === "enchanter" ? "✨ サポート" : "⚔️ ADファイター"}
                      </span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                        敵構成に合わせて即時選択
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                      <button
                        onClick={() => setBuildPreset("standard")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          buildPreset === "standard"
                            ? "bg-amber-500 text-zinc-950 font-black shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        標準コア
                      </button>
                      <button
                        onClick={() => setBuildPreset("tank")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          buildPreset === "tank"
                            ? "bg-rose-500 text-white font-black shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        対タンク (貫通)
                      </button>
                      <button
                        onClick={() => setBuildPreset("burst")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          buildPreset === "burst"
                            ? "bg-cyan-500 text-zinc-950 font-black shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        対バースト (高耐久)
                      </button>
                    </div>

                    {/* 📖 アイテム辞書モーダル起動ボタン */}
                    <button
                      onClick={() => {
                        setDictFocusKey(undefined);
                        setDictFocusValue(undefined);
                        setIsItemDictModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer shadow-xs ml-auto sm:ml-0"
                      title="アイテム名の翻訳・辞書登録を開く"
                    >
                      <BookOpen size={13} className="text-amber-400" />
                      <span>アイテム辞書</span>
                    </button>
                  </div>

                  {/* ビルド詳細3カラムカード */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-amber-500/40 transition">
                      <span className="text-[10px] font-black text-amber-400 uppercase block mb-1">
                        1コア (ファースト完成)
                      </span>
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-zinc-100 text-sm truncate">
                          {currentBuild.firstCore}
                        </p>
                        <button
                          onClick={() => {
                            setDictFocusKey(currentBuild.firstCore);
                            setDictFocusValue(currentBuild.firstCore);
                            setIsItemDictModalOpen(true);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition cursor-pointer shrink-0"
                          title="このアイテム名を辞書登録・編集"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {currentBuild.firstCoreDesc}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-cyan-500/40 transition">
                      <span className="text-[10px] font-black text-cyan-400 uppercase block mb-1">
                        2〜3コア (集団戦スパイク)
                      </span>
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-zinc-100 text-sm truncate">
                          {currentBuild.coreSpike}
                        </p>
                        <button
                          onClick={() => {
                            setDictFocusKey(currentBuild.coreSpike);
                            setDictFocusValue(currentBuild.coreSpike);
                            setIsItemDictModalOpen(true);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition cursor-pointer shrink-0"
                          title="このアイテム名を辞書登録・編集"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {currentBuild.coreSpikeDesc}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-emerald-500/40 transition">
                      <span className="text-[10px] font-black text-emerald-400 uppercase block mb-1">
                        キーストーン推奨ルーン
                      </span>
                      <p className="font-bold text-zinc-100 text-sm">
                        {currentBuild.runes}
                      </p>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {currentBuild.runesDesc}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 時間帯別パワースパイク分析 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-black text-zinc-100 mb-2.5 flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" /> 時間帯別パワースパイク ＆ 立ち回り
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-amber-400 block mb-1">Lv1〜3 (序盤・初動)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {stageTactics?.early || (selectedDetail.facts?.powerSpikes ? selectedDetail.facts.powerSpikes.split('\n')[0] : 'スキルを当てて主導権を取り、Lv2先行でウェーブをフリーズ。')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-emerald-400 block mb-1">1コア〜Lv9 (中盤・主導権)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {stageTactics?.mid || '最も戦闘力が高いパワースパイク。ヘラルド・ドラゴン前にプッシュして視界制圧。'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-cyan-400 block mb-1">集団戦 (終盤・決戦)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {stageTactics?.late || '正面から突っ込まず、側道から敵キャリーにCCを合わせ、耐久を活かして前線を維持。'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
  );
}
