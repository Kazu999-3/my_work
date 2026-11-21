'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Flame, Dices, Sparkles } from 'lucide-react';
import ChampionCard from './ChampionCard';
import {
  REGIONS,
  ROLES_LIST,
  CLASSES,
  FESTIVAL_THEMES,
  FESTIVAL_THEME_CATEGORIES,
  CHAMPION_METADATA,
  type RegionKey,
  type ChampionRole,
  type ChampionClass,
  type ChampionMeta,
  type FestivalTheme,
} from '../../../../lib/championMetadata';

interface ChampionPoolViewProps {
  viewMode: 'region' | 'role' | 'class' | 'theme' | 'all';
  searchQuery: string;
  excludedIds: Set<string>;
  collapsedRegions: Set<string>;
  toggleAllRegions: (collapse: boolean) => void;
  toggleCollapseRegion: (regKey: RegionKey) => void;
  handleExcludeGroup: (champIds: string[]) => void;
  handleClearGroup: (champIds: string[]) => void;
  toggleExclude: (id: string) => void;
  handleRandomThemeDice: () => void;
  handleKeepOnlyTheme: (champIds: string[], theme: FestivalTheme) => void;
  regionGroups: Record<string, ChampionMeta[]>;
  roleGroups: Record<string, ChampionMeta[]>;
  classGroups: Record<string, ChampionMeta[]>;
  filteredChamps: ChampionMeta[];
  activeTheme: FestivalTheme | null;
  roleBreakdowns: Record<ChampionRole, { standard: ChampionMeta[]; offmeta: ChampionMeta[]; all: ChampionMeta[] }>;
  isThemeRolling: boolean;
}

export default function ChampionPoolView({
  viewMode,
  searchQuery,
  excludedIds,
  collapsedRegions,
  toggleAllRegions,
  toggleCollapseRegion,
  handleExcludeGroup,
  handleClearGroup,
  toggleExclude,
  handleRandomThemeDice,
  handleKeepOnlyTheme,
  regionGroups,
  roleGroups,
  classGroups,
  filteredChamps,
  activeTheme,
  roleBreakdowns,
  isThemeRolling,
}: ChampionPoolViewProps) {
  return (
    <>
        {/* ① 出身地別モード */}
        {viewMode === "region" && (
          <div className="space-y-4">
            {/* 地域一括開閉コントロールバー */}
            <div className="flex items-center justify-between text-xs bg-surface p-3 rounded-2xl border border-border shadow-xs">
              <span className="font-bold text-muted-strong flex items-center gap-1.5">
                <span>🗺️</span> 出身地域一覧 ({Object.keys(REGIONS).length}地域)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllRegions(false)}
                  className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground-subtle border border-border font-bold text-xs cursor-pointer"
                >
                  すべて開く
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllRegions(true)}
                  className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground-subtle border border-border font-bold text-xs cursor-pointer"
                >
                  すべて畳む
                </button>
              </div>
            </div>

            {(Object.keys(REGIONS) as RegionKey[]).map((regKey) => {
              const regMeta = REGIONS[regKey];
              const champs = regionGroups[regKey] || [];
              if (champs.length === 0) return null;
              const champIds = champs.map((c) => c.id);
              const allExcluded = champIds.every((id) => excludedIds.has(id));
              const excludedCount = champIds.filter((id) => excludedIds.has(id)).length;
              const isCollapsed = collapsedRegions.has(regKey);

              return (
                <div
                  key={regKey}
                  className="bg-surface rounded-2xl border border-border p-4 shadow-xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
                    <button
                      type="button"
                      onClick={() => toggleCollapseRegion(regKey)}
                      className="flex items-center gap-2 text-left cursor-pointer group flex-1"
                    >
                      <span className="text-xl">{regMeta.icon}</span>
                      <h2 className="text-base font-black text-foreground group-hover:text-primary-600 transition">
                        {regMeta.name}
                      </h2>
                      <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border font-mono">
                        {champs.length - excludedCount} / {champs.length} 体
                      </span>
                      <span className="text-xs text-muted hidden md:inline">
                        — {regMeta.description}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted transition-transform ml-auto sm:ml-2 ${
                          isCollapsed ? "" : "rotate-180"
                        }`}
                      />
                    </button>

                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleExcludeGroup(champIds)}
                        className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-danger-500/10 text-danger-600 hover:text-danger-700 text-[11px] font-bold border border-border transition cursor-pointer"
                      >
                        地域一括 ❌
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearGroup(champIds)}
                        className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-success-500/10 text-success-600 hover:text-success-700 text-[11px] font-bold border border-border transition cursor-pointer"
                      >
                        一括解除
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5 animate-fade-in">
                      {champs.map((champ) => (
                        <ChampionCard
                          key={champ.id}
                          meta={champ}
                          isExcluded={excludedIds.has(champ.id)}
                          onClick={() => toggleExclude(champ.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ② ロール別モード（Lolalytics過去30日実測統計準拠: 通常 vs オフメタ枠） */}
        {viewMode === "role" && (
          <div className="space-y-6">
            {ROLES_LIST.map((role: ChampionRole) => {
              const breakdown = roleBreakdowns[role];
              const standardChamps = breakdown.standard;
              const offmetaChamps = breakdown.offmeta;
              const allChamps = breakdown.all;
              if (allChamps.length === 0) return null;

              const allIds = allChamps.map((c: ChampionMeta) => c.id);
              const standardIds = standardChamps.map((c: ChampionMeta) => c.id);
              const offmetaIds = offmetaChamps.map((c: ChampionMeta) => c.id);
              const excludedCount = allIds.filter((id: string) => excludedIds.has(id)).length;

              const roleLabelMap: Record<ChampionRole, { label: string; icon: string }> = {
                TOP: { label: "トップ (TOP)", icon: "🛡️" },
                JG: { label: "ジャングル (JG)", icon: "🌲" },
                MID: { label: "ミッド (MID)", icon: "⚡" },
                ADC: { label: "ボット / ADC", icon: "🏹" },
                SUP: { label: "サポート (SUP)", icon: "✨" },
              };

              return (
                <div
                  key={role}
                  className="bg-surface rounded-2xl border border-border p-4 shadow-xs space-y-4"
                >
                  {/* ロール見出し ＆ 一括操作バー */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">{roleLabelMap[role].icon}</span>
                      <h2 className="text-base font-black text-foreground">
                        {roleLabelMap[role].label}
                      </h2>
                      <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border">
                        {allChamps.length - excludedCount} / {allChamps.length} 体
                      </span>
                      <span className="text-[10px] text-muted-strong font-mono">
                        (通常 {standardChamps.length} / 🎭オフメタ {offmetaChamps.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                      {offmetaIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleExcludeGroup(offmetaIds)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-black border border-amber-500/30 transition cursor-pointer"
                          title="Lolalytics過去30日でピック率0.5%未満のオフメタ・トロール枠を一括で除外します"
                        >
                          🎭 オフメタ一括 ❌
                        </button>
                      )}
                      {standardIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleExcludeGroup(standardIds)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-[11px] font-black border border-purple-500/30 transition cursor-pointer"
                          title="通常ピックを一括除外し、全員オフメタ縛りで遊ぶ時に使用します"
                        >
                          🌟 通常一括 ❌
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExcludeGroup(allIds)}
                        className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-danger-500/10 text-danger-600 hover:text-danger-700 text-[11px] font-bold border border-border transition cursor-pointer"
                      >
                        全除外 ❌
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearGroup(allIds)}
                        className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-success-500/10 text-success-600 hover:text-success-700 text-[11px] font-bold border border-border transition cursor-pointer"
                      >
                        全解除
                      </button>
                    </div>
                  </div>

                  {/* 🌟 通常ピックセクション */}
                  {standardChamps.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-foreground">
                        <span className="p-1 rounded bg-primary-500/10 text-primary-500">🌟</span>
                        <span>通常ピック</span>
                        <span className="text-[10px] text-muted-strong font-normal font-mono">
                          (Lolalytics過去30日: ピック率 ≧ 0.5% ｜ {standardChamps.length}体)
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                        {standardChamps.map((champ: ChampionMeta) => (
                          <ChampionCard
                            key={`${role}-std-${champ.id}`}
                            meta={champ}
                            isExcluded={excludedIds.has(champ.id)}
                            onClick={() => toggleExclude(champ.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🎭 オフメタ枠セクション */}
                  {offmetaChamps.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                        <span className="p-1 rounded bg-amber-500/10 text-amber-500">🎭</span>
                        <span>オフメタ枠</span>
                        <span className="text-[10px] text-muted-strong font-normal font-mono">
                          (Lolalytics過去30日: ピック率 &lt; 0.5% ｜ {offmetaChamps.length}体)
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                        {offmetaChamps.map((champ: ChampionMeta) => (
                          <ChampionCard
                            key={`${role}-off-${champ.id}`}
                            meta={champ}
                            isExcluded={excludedIds.has(champ.id)}
                            onClick={() => toggleExclude(champ.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ③ クラス別モード */}
        {viewMode === "class" && (
          <div className="space-y-6">
            {(Object.keys(CLASSES) as ChampionClass[]).map((clsKey) => {
              const clsMeta = CLASSES[clsKey];
              const champs = classGroups[clsKey] || [];
              if (champs.length === 0) return null;
              const champIds = champs.map((c) => c.id);
              const excludedCount = champIds.filter((id) => excludedIds.has(id)).length;

              return (
                <div
                  key={clsKey}
                  className="bg-surface rounded-2xl border border-border p-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{clsMeta.icon}</span>
                      <h2 className="text-base font-black text-foreground">
                        {clsMeta.name} ({clsKey})
                      </h2>
                      <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border">
                        {champs.length - excludedCount} / {champs.length} 体
                      </span>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleExcludeGroup(champIds)}
                        className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-danger-500/10 text-danger-600 hover:text-danger-700 text-[11px] font-bold border border-border transition cursor-pointer"
                      >
                        クラス一括 ❌
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearGroup(champIds)}
                        className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-success-500/10 text-success-600 hover:text-success-700 text-[11px] font-bold border border-border transition cursor-pointer"
                      >
                        一括解除
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                    {champs.map((champ) => (
                      <ChampionCard
                        key={`${clsKey}-${champ.id}`}
                        meta={champ}
                        isExcluded={excludedIds.has(champ.id)}
                        onClick={() => toggleExclude(champ.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ④ 🎭 特殊テーマ（縛り）モード */}
        {viewMode === "theme" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  お祭りカスタム 特殊縛りテーマ一覧 (全{FESTIVAL_THEMES.length}種)
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  「このテーマのみ残す」を押すと、対象チャンピオン以外が一発で全除外（❌）され、即座にお祭りピックプールが完成します！
                </p>
              </div>

              <button
                type="button"
                onClick={handleRandomThemeDice}
                disabled={isThemeRolling}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white text-xs font-black flex items-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Dices className={`w-4 h-4 ${isThemeRolling ? "animate-spin" : ""}`} />
                <span>🎲 ランダムにテーマを決める</span>
              </button>
            </div>

            {/* カテゴリ別に整理して描画 */}
            {(
              [
                "rivalry",
                "mechanics",
                "theme",
                "ktm",
              ] as (keyof typeof FESTIVAL_THEME_CATEGORIES)[]
            ).map((catKey) => {
              const catInfo = FESTIVAL_THEME_CATEGORIES[catKey];
              const themesInCat = FESTIVAL_THEMES.filter((t) => t.category === catKey);
              if (themesInCat.length === 0) return null;

              return (
                <div key={catKey} className="space-y-4">
                  {/* カテゴリ見出し */}
                  <div className="flex items-center gap-2 border-b-2 border-primary-500/30 pb-2">
                    <span className="text-xl">{catInfo.icon}</span>
                    <h3 className="text-base sm:text-lg font-black text-foreground">
                      {catInfo.label}
                    </h3>
                    <span className="text-xs text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border font-bold">
                      {themesInCat.length} テーマ
                    </span>
                  </div>

                  <div className="space-y-5">
                    {themesInCat.map((theme) => {
                      // テーマに属するチャンピオンのうち、現在の検索クエリに合致するもの
                      const themeChamps = theme.champIds
                        .map((id) => CHAMPION_METADATA[id])
                        .filter(Boolean)
                        .filter((c) => {
                          const q = searchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.ruby.toLowerCase().includes(q) ||
                            c.id.toLowerCase().includes(q)
                          );
                        });

                      if (themeChamps.length === 0) return null;
                      const champIds = themeChamps.map((c) => c.id);
                      const excludedCount = champIds.filter((id) => excludedIds.has(id)).length;
                      const activeThemeCount = champIds.length - excludedCount;
                      const isCurrentTheme = activeTheme?.id === theme.id;

                      return (
                        <div
                          key={theme.id}
                          className={`bg-surface rounded-2xl border p-4 shadow-xs transition-all ${
                            isCurrentTheme
                              ? "border-amber-500/80 ring-2 ring-amber-500/20 bg-amber-500/[0.02]"
                              : "border-border"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-2xl">{theme.icon}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-black text-foreground">
                                    {theme.name}
                                  </h4>
                                  {isCurrentTheme && (
                                    <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full shadow-xs">
                                      適用中 ★
                                    </span>
                                  )}
                                  <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border font-mono">
                                    {activeThemeCount} / {themeChamps.length} 体
                                  </span>
                                </div>
                                <p className="text-xs text-muted">{theme.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleKeepOnlyTheme(theme.champIds, theme)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1 ${
                                  isCurrentTheme
                                    ? "bg-amber-600 text-white"
                                    : "bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white"
                                }`}
                                title="このテーマのチャンピオンだけを残して他をすべて❌除外します"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>このテーマのみ残す 🎯</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExcludeGroup(champIds)}
                                className="px-2.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-danger-500/10 text-danger-600 hover:text-danger-700 text-xs font-bold border border-border transition cursor-pointer"
                              >
                                一括 ❌
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearGroup(champIds)}
                                className="px-2.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-success-500/10 text-success-600 hover:text-success-700 text-xs font-bold border border-border transition cursor-pointer"
                              >
                                一括解除
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                            {themeChamps.map((champ) => (
                              <ChampionCard
                                key={`${theme.id}-${champ.id}`}
                                meta={champ}
                                isExcluded={excludedIds.has(champ.id)}
                                onClick={() => toggleExclude(champ.id)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ⑤ 五十音順（全種一覧）モード */}
        {viewMode === "all" && (
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔤</span>
                <h2 className="text-base font-black text-foreground">
                  全チャンピオン一覧（五十音順）
                </h2>
                <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border">
                  {filteredChamps.length - excludedIds.size} / {filteredChamps.length} 体
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
              {filteredChamps.map((champ) => (
                <ChampionCard
                  key={champ.id}
                  meta={champ}
                  isExcluded={excludedIds.has(champ.id)}
                  onClick={() => toggleExclude(champ.id)}
                />
              ))}
            </div>
          </div>
        )}

    </>
  );
}
