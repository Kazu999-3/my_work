"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ALL_METADATA_CHAMPIONS,
  REGIONS,
  CLASSES,
  ROLES_LIST,
  CHAMPION_METADATA,
  RegionKey,
  ChampionRole,
  ChampionClass,
  ChampionMeta,
} from "../../../lib/championMetadata";
import { getChampIcon } from "../../../lib/ddragonClient";
import {
  Sparkles,
  RotateCcw,
  Search,
  Dice5,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Filter,
  Swords,
  Layers,
  ArrowLeft,
  Copy,
  Check,
  Camera,
  Maximize2,
} from "lucide-react";
import { toast } from "../../../components/Toaster";

type ViewMode = "region" | "role" | "class" | "all";

export default function FestivalPickPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("region");
  const [searchQuery, setSearchQuery] = useState("");
  // 除外されたチャンピオンIDのセット（❌が付いているもの）
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  // ルーレット選出結果モーダル用
  const [rouletteResults, setRouletteResults] = useState<ChampionMeta[]>([]);
  const [isRouletteRolling, setIsRouletteRolling] = useState(false);
  const [copied, setCopied] = useState(false);

  // 📸 キャプチャ用1枚プレビューモーダル
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [captureGroupBy, setCaptureGroupBy] = useState<"region" | "role" | "flat">("region");
  const [copiedPool, setCopiedPool] = useState(false);

  // チャンピオンクリックで ❌ のトグル
  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 全リセット
  const handleResetAll = useCallback(() => {
    setExcludedIds(new Set());
    toast.success("すべての除外（❌）をリセットしました");
  }, []);

  // グループ内を一括❌
  const handleExcludeGroup = useCallback((champIds: string[]) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      champIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // グループ内を一括解除
  const handleClearGroup = useCallback((champIds: string[]) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      champIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // 検索フィルタ済みの全チャンピオン
  const filteredChamps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_METADATA_CHAMPIONS.filter((meta) => {
      if (!q) return true;
      return (
        meta.name.toLowerCase().includes(q) ||
        meta.ruby.toLowerCase().includes(q) ||
        meta.id.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  // 残り有効チャンピオン数
  const activeCount = useMemo(() => {
    return filteredChamps.filter((c) => !excludedIds.has(c.id)).length;
  }, [filteredChamps, excludedIds]);

  // ルーレット抽選（未除外から count 体をランダム選出）
  const handleRoulette = useCallback(
    (count: number) => {
      const available = filteredChamps.filter((c) => !excludedIds.has(c.id));
      if (available.length === 0) {
        toast.error("ピック可能なチャンピオンがいません（すべて除外されています）");
        return;
      }
      setIsRouletteRolling(true);

      // ルーレット演出
      let steps = 0;
      const maxSteps = 10;
      const interval = setInterval(() => {
        steps++;
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        setRouletteResults(shuffled.slice(0, Math.min(count, available.length)));
        if (steps >= maxSteps) {
          clearInterval(interval);
          setIsRouletteRolling(false);
          toast.success(`🎲 ${Math.min(count, available.length)}体のチャンピオンを抽選しました！`);
        }
      }, 70);
    },
    [filteredChamps, excludedIds]
  );

  // 選出結果をクリップボードにコピー
  const handleCopyResults = useCallback(() => {
    if (rouletteResults.length === 0) return;
    const text = rouletteResults
      .map((c, i) => `${i + 1}. ${c.name} (${c.region})`)
      .join("\n");
    navigator.clipboard.writeText(`【KTM お祭りカスタム選出】\n${text}`);
    setCopied(true);
    toast.success("結果をコピーしました！");
    setTimeout(() => setCopied(false), 2000);
  }, [rouletteResults]);

  // 地域別グループ
  const regionGroups = useMemo(() => {
    const map: Record<RegionKey, ChampionMeta[]> = {
      Ionia: [],
      Demacia: [],
      Noxus: [],
      Piltover: [],
      Zaun: [],
      Freljord: [],
      Shurima: [],
      Targon: [],
      Bilgewater: [],
      ShadowIsles: [],
      Ixtal: [],
      Void: [],
      BandleCity: [],
      Runeterra: [],
    };
    filteredChamps.forEach((c) => {
      if (map[c.region]) map[c.region].push(c);
      else map.Runeterra.push(c);
    });
    return map;
  }, [filteredChamps]);

  // ロール別グループ
  const roleGroups = useMemo(() => {
    const map: Record<ChampionRole, ChampionMeta[]> = {
      TOP: [],
      JG: [],
      MID: [],
      ADC: [],
      SUP: [],
    };
    filteredChamps.forEach((c) => {
      c.roles.forEach((r) => {
        if (map[r]) map[r].push(c);
      });
    });
    return map;
  }, [filteredChamps]);

  // クラス別グループ
  const classGroups = useMemo(() => {
    const map: Record<ChampionClass, ChampionMeta[]> = {
      Fighter: [],
      Mage: [],
      Assassin: [],
      Marksman: [],
      Tank: [],
      Support: [],
    };
    filteredChamps.forEach((c) => {
      if (map[c.class]) map[c.class].push(c);
      else map.Fighter.push(c);
    });
    return map;
  }, [filteredChamps]);

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-6 pb-28">
      {/* ── ヘッダー ── */}
      <div className="max-w-7xl mx-auto flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/balancer"
                className="text-xs text-muted-strong hover:text-foreground flex items-center gap-1 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> バランサーへ戻る
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2.5">
              <span className="p-2 bg-gradient-to-br from-amber-500 to-rose-500 text-white rounded-2xl shadow-md">
                <Sparkles className="w-6 h-6" />
              </span>
              お祭りピックセレクター
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1">
              出身地・ロール・クラス別にアイコンを一覧表示。クリックでピック候補から除外（❌）し、ルーレットで抽選！
            </p>
          </div>

          {/* クイック統計 ＆ プレビュー ＆ リセット */}
          <div className="flex items-center gap-2 sm:self-end flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-surface border border-border text-xs flex items-center gap-2 font-bold shadow-xs">
              <span className="text-muted">残り候補:</span>
              <span className="text-success-600 font-black font-mono text-sm">
                {activeCount}
              </span>
              <span className="text-muted text-[10px]">/ {filteredChamps.length} 体</span>
              {excludedIds.size > 0 && (
                <span className="text-danger-500 text-[10px] bg-danger-500/10 px-1.5 py-0.5 rounded-md font-mono">
                  ({excludedIds.size}体 ❌)
                </span>
              )}
            </div>

            {/* 📸 キャプチャ用1枚プレビューボタン */}
            <button
              type="button"
              onClick={() => setShowCaptureModal(true)}
              disabled={activeCount === 0}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
              title="最終的にピック可能なチャンピオンを1画面にまとめてキャプチャ用表示"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📸 1枚プレビュー</span>
            </button>

            {excludedIds.size > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-active border border-border text-xs font-bold flex items-center gap-1.5 transition text-danger-600 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> ❌ 全リセット
              </button>
            )}
          </div>
        </div>

        {/* ── コントロールバー ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border shadow-xs">
          {/* 表示モードセレクト */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-muted-strong shrink-0 flex items-center gap-1 mr-1">
              <Layers className="w-3.5 h-3.5" /> 分類:
            </span>
            <button
              type="button"
              onClick={() => setViewMode("region")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                viewMode === "region"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-surface-subtle hover:bg-surface-hover text-foreground-soft border border-border"
              }`}
            >
              🌸 出身地別
            </button>
            <button
              type="button"
              onClick={() => setViewMode("role")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                viewMode === "role"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-surface-subtle hover:bg-surface-hover text-foreground-soft border border-border"
              }`}
            >
              ⚔️ ロール別
            </button>
            <button
              type="button"
              onClick={() => setViewMode("class")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                viewMode === "class"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-surface-subtle hover:bg-surface-hover text-foreground-soft border border-border"
              }`}
            >
              🛡️ クラス別
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                viewMode === "all"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-surface-subtle hover:bg-surface-hover text-foreground-soft border border-border"
              }`}
            >
              🔤 五十音順（全種）
            </button>
          </div>

          {/* 検索入力 & 🎲 ルーレットボタン */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="名前・読みで絞り込み..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-subtle border border-border rounded-xl focus:outline-none focus:border-primary-500 text-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* ルーレット起動ボタン */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleRoulette(1)}
                disabled={isRouletteRolling || activeCount === 0}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition disabled:opacity-50 cursor-pointer"
                title="残り候補から1体をランダム選出"
              >
                <Dice5 className={`w-3.5 h-3.5 ${isRouletteRolling ? "animate-spin" : ""}`} />
                <span>1体抽選</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoulette(5)}
                disabled={isRouletteRolling || activeCount === 0}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition disabled:opacity-50 cursor-pointer"
                title="残り候補から5体（1チーム分）をランダム選出"
              >
                <Dice5 className={`w-3.5 h-3.5 ${isRouletteRolling ? "animate-spin" : ""}`} />
                <span>5体抽選</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── メイングリッド描画 ── */}
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* ① 出身地別モード */}
        {viewMode === "region" && (
          <div className="space-y-6">
            {(Object.keys(REGIONS) as RegionKey[]).map((regKey) => {
              const regMeta = REGIONS[regKey];
              const champs = regionGroups[regKey] || [];
              if (champs.length === 0) return null;
              const champIds = champs.map((c) => c.id);
              const allExcluded = champIds.every((id) => excludedIds.has(id));
              const excludedCount = champIds.filter((id) => excludedIds.has(id)).length;

              return (
                <div
                  key={regKey}
                  className="bg-surface rounded-2xl border border-border p-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{regMeta.icon}</span>
                      <h2 className="text-base font-black text-foreground">
                        {regMeta.name}
                      </h2>
                      <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border">
                        {champs.length - excludedCount} / {champs.length} 体
                      </span>
                      <span className="text-xs text-muted hidden md:inline">
                        — {regMeta.description}
                      </span>
                    </div>

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

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                    {champs.map((champ) => (
                      <ChampionCard
                        key={champ.id}
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

        {/* ② ロール別モード */}
        {viewMode === "role" && (
          <div className="space-y-6">
            {ROLES_LIST.map((role) => {
              const champs = roleGroups[role] || [];
              if (champs.length === 0) return null;
              const champIds = champs.map((c) => c.id);
              const excludedCount = champIds.filter((id) => excludedIds.has(id)).length;

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
                  className="bg-surface rounded-2xl border border-border p-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{roleLabelMap[role].icon}</span>
                      <h2 className="text-base font-black text-foreground">
                        {roleLabelMap[role].label}
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
                        ロール一括 ❌
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
                        key={`${role}-${champ.id}`}
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

        {/* ④ 五十音順（全種一覧）モード */}
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
      </div>

      {/* ── ルーレット抽選結果モーダル ── */}
      {rouletteResults.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border-2 border-primary-500/50 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
            {/* 上部背景デコレーション */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600" />

            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎲</span>
                <h3 className="text-lg sm:text-xl font-black text-foreground">
                  お祭り抽選結果！
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRouletteResults([])}
                className="p-1.5 rounded-full hover:bg-surface-hover text-muted hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted mb-6">
              未除外の候補プールからランダムに選ばれました
            </p>

            {/* 結果チャンピオンカード */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 w-full mb-6">
              {rouletteResults.map((c, i) => (
                <div
                  key={`${c.id}-${i}`}
                  className="bg-surface-subtle border border-border rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm"
                >
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary-500/60 shadow-md">
                    <img
                      src={getChampIcon(c.id)}
                      alt={c.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-black text-foreground truncate max-w-[100px]">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-muted truncate max-w-[100px]">
                      {REGIONS[c.region]?.name || c.region}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 操作ボタン */}
            <div className="flex items-center gap-2 w-full justify-center">
              <button
                type="button"
                onClick={() => handleRoulette(rouletteResults.length)}
                disabled={isRouletteRolling}
                className="px-4 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Dice5 className={`w-4 h-4 ${isRouletteRolling ? "animate-spin" : ""}`} />
                <span>もう一度振る 🎲</span>
              </button>
              <button
                type="button"
                onClick={handleCopyResults}
                className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>結果をコピー</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 📸 キャプチャ用1枚プレビューモーダル ── */}
      {showCaptureModal && (
        <CapturePreviewModal
          filteredChamps={filteredChamps}
          excludedIds={excludedIds}
          activeCount={activeCount}
          captureGroupBy={captureGroupBy}
          setCaptureGroupBy={setCaptureGroupBy}
          onClose={() => setShowCaptureModal(false)}
        />
      )}
    </div>
  );
}

// ── チャンピオンアイコンカードコンポーネント ──
function ChampionCard({
  meta,
  isExcluded,
  onClick,
}: {
  meta: ChampionMeta;
  isExcluded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center p-1.5 rounded-xl border transition-all text-center cursor-pointer select-none ${
        isExcluded
          ? "bg-danger-500/5 border-danger-500/30 opacity-40 hover:opacity-75"
          : "bg-surface-subtle hover:bg-surface-hover border-border/80 hover:border-primary-500/50 shadow-2xs hover:shadow-sm"
      }`}
      title={`${meta.name} (${REGIONS[meta.region]?.name || meta.region})\nクリックで${isExcluded ? "解除" : "❌除外"}`}
    >
      {/* アイコン枠 */}
      <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-border/80 group-hover:scale-105 transition-transform">
        <img
          src={getChampIcon(meta.id)}
          alt={meta.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        {/* ❌ 除外オーバーレイ */}
        {isExcluded && (
          <div className="absolute inset-0 bg-danger-950/70 flex items-center justify-center animate-fade-in">
            <span className="text-danger-400 font-black text-2xl drop-shadow-md">✕</span>
          </div>
        )}
      </div>

      {/* 名前 */}
      <span
        className={`mt-1 text-[11px] font-bold leading-tight truncate w-full px-0.5 ${
          isExcluded ? "line-through text-faint" : "text-foreground-soft group-hover:text-foreground"
        }`}
      >
        {meta.name}
      </span>
    </button>
  );
}

// ── 📸 キャプチャ用1枚プレビューモーダル ──
function CapturePreviewModal({
  filteredChamps,
  excludedIds,
  activeCount,
  captureGroupBy,
  setCaptureGroupBy,
  onClose,
}: {
  filteredChamps: ChampionMeta[];
  excludedIds: Set<string>;
  activeCount: number;
  captureGroupBy: "region" | "role" | "flat";
  setCaptureGroupBy: React.Dispatch<React.SetStateAction<"region" | "role" | "flat">>;
  onClose: () => void;
}) {
  const [copiedPool, setCopiedPool] = useState(false);

  // ピック可能なチャンピオンのみを抽出
  const pool = useMemo(() => {
    return filteredChamps.filter((c) => !excludedIds.has(c.id));
  }, [filteredChamps, excludedIds]);

  // 出身地別グループ（有効なもののみ）
  const poolByRegion = useMemo(() => {
    const map = new Map<RegionKey, ChampionMeta[]>();
    (Object.keys(REGIONS) as RegionKey[]).forEach((k) => map.set(k, []));
    pool.forEach((c) => {
      const list = map.get(c.region) || [];
      list.push(c);
      map.set(c.region, list);
    });
    // チャンピオンが1体以上いる地域だけ抽出
    return Array.from(map.entries()).filter(([_, list]) => list.length > 0);
  }, [pool]);

  // ロール別グループ（有効なもののみ）
  const poolByRole = useMemo(() => {
    const map = new Map<ChampionRole, ChampionMeta[]>();
    ROLES_LIST.forEach((r) => map.set(r, []));
    pool.forEach((c) => {
      c.roles.forEach((r) => {
        const list = map.get(r) || [];
        list.push(c);
        map.set(r, list);
      });
    });
    return Array.from(map.entries()).filter(([_, list]) => list.length > 0);
  }, [pool]);

  const handleCopyTextPool = () => {
    const text = pool.map((c) => c.name).join("、");
    navigator.clipboard.writeText(`【KTM お祭りピック可能プール (${pool.length}体)】\n${text}`);
    setCopiedPool(true);
    toast.success("ピック可能チャンピオン一覧をコピーしました！");
    setTimeout(() => setCopiedPool(false), 2000);
  };

  const roleLabelMap: Record<ChampionRole, { label: string; icon: string }> = {
    TOP: { label: "TOP", icon: "🛡️" },
    JG: { label: "JG", icon: "🌲" },
    MID: { label: "MID", icon: "⚡" },
    ADC: { label: "ADC", icon: "🏹" },
    SUP: { label: "SUP", icon: "✨" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#0f1115] text-[#f1f3f5] border-2 border-primary-500/50 rounded-2xl max-w-6xl w-full shadow-2xl relative flex flex-col my-auto max-h-[96vh]">
        {/* モーダル上部操作バー（キャプチャ外） */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface/90 border-b border-border/80 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black flex items-center gap-1 text-primary-500">
              <Camera className="w-4 h-4" /> 1枚キャプチャ用プレビュー
            </span>
            <span className="text-[11px] text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-md border border-border">
              この画面全体をスクショ・クリップしてDiscord等に共有できます
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 切り替えボタングループ */}
            <div className="flex items-center gap-1 bg-surface-subtle p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setCaptureGroupBy("region")}
                className={`px-2 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                  captureGroupBy === "region"
                    ? "bg-primary-600 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                🌸 地域別
              </button>
              <button
                type="button"
                onClick={() => setCaptureGroupBy("role")}
                className={`px-2 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                  captureGroupBy === "role"
                    ? "bg-primary-600 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                ⚔️ ロール別
              </button>
              <button
                type="button"
                onClick={() => setCaptureGroupBy("flat")}
                className={`px-2 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                  captureGroupBy === "flat"
                    ? "bg-primary-600 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                🔤 コンパクト全一覧
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyTextPool}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-xs font-bold border border-border flex items-center gap-1 transition text-foreground-soft cursor-pointer"
            >
              {copiedPool ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>テキストコピー</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-sm cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── 📸 キャプチャ対象エリア（1枚に美しく収まるLoLボード） ── */}
        <div
          id="capture-board-area"
          className="p-4 sm:p-6 bg-gradient-to-b from-[#12151c] to-[#0a0c10] overflow-y-auto rounded-b-2xl flex flex-col gap-4"
        >
          {/* ボードヘッダー */}
          <div className="flex items-center justify-between border-b border-primary-500/30 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-rose-600 rounded-xl text-white shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black tracking-wider text-white flex items-center gap-2">
                  KTM お祭りカスタム ピック可能チャンピオン
                </h2>
                <p className="text-[11px] text-stone-400">
                  ※ 赤い❌で除外されたチャンピオンを除いた【有効ピック候補】です
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#1a1e27] border border-primary-500/40 px-3.5 py-1.5 rounded-xl shadow-inner">
              <span className="text-xs text-stone-400 font-bold">候補プール:</span>
              <span className="text-xl font-black font-mono text-emerald-400 leading-none">
                {pool.length}
              </span>
              <span className="text-[10px] text-stone-400">体</span>
            </div>
          </div>

          {/* ピック可能プールが0体の場合 */}
          {pool.length === 0 && (
            <div className="py-12 text-center text-stone-400 text-sm">
              ピック可能なチャンピオンがいません（すべてのチャンピオンが除外されています）
            </div>
          )}

          {/* ① 地域別グループ表示 */}
          {captureGroupBy === "region" && pool.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {poolByRegion.map(([regKey, champs]) => (
                <div
                  key={regKey}
                  className="bg-[#151922]/90 border border-stone-800/80 rounded-xl p-2.5 flex flex-col gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-stone-800 pb-1 text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-stone-200">
                      <span>{REGIONS[regKey]?.icon}</span>
                      <span>{REGIONS[regKey]?.name || regKey}</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-400 bg-stone-900/60 px-1.5 py-0.2 rounded border border-stone-800">
                      {champs.length}体
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {champs.map((c) => (
                      <CompactCaptureIcon key={c.id} meta={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ② ロール別グループ表示 */}
          {captureGroupBy === "role" && pool.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {poolByRole.map(([role, champs]) => (
                <div
                  key={role}
                  className="bg-[#151922]/90 border border-stone-800/80 rounded-xl p-2.5 flex flex-col gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-stone-800 pb-1 text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-stone-200">
                      <span>{roleLabelMap[role]?.icon}</span>
                      <span>{roleLabelMap[role]?.label || role}</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-400 bg-stone-900/60 px-1.5 py-0.2 rounded border border-stone-800">
                      {champs.length}体
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {champs.map((c) => (
                      <CompactCaptureIcon key={`${role}-${c.id}`} meta={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ③ コンパクト全一覧（名簿形式） */}
          {captureGroupBy === "flat" && pool.length > 0 && (
            <div className="bg-[#151922]/90 border border-stone-800/80 rounded-xl p-3 flex flex-wrap gap-1.5 sm:gap-2">
              {pool.map((c) => (
                <CompactCaptureIcon key={c.id} meta={c} showName />
              ))}
            </div>
          )}

          {/* フッターフッター情報 */}
          <div className="flex items-center justify-between text-[10px] text-stone-500 border-t border-stone-800/80 pt-2 px-1">
            <span>KTM Weekend Custom Official Portal</span>
            <span>https://ktm-portal.vercel.app/festival/pick</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── キャプチャ用コンパクトアイコン ──
function CompactCaptureIcon({
  meta,
  showName = false,
}: {
  meta: ChampionMeta;
  showName?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 bg-[#1a1f2c] border border-stone-700/60 rounded-lg p-0.5 px-1 shadow-2xs ${
        showName ? "min-w-[70px]" : ""
      }`}
      title={`${meta.name} (${REGIONS[meta.region]?.name || meta.region})`}
    >
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md overflow-hidden border border-stone-600/80 shrink-0">
        <img
          src={getChampIcon(meta.id)}
          alt={meta.name}
          className="w-full h-full object-cover"
        />
      </div>
      <span className="text-[10px] font-bold text-stone-200 truncate max-w-[65px] px-0.5">
        {meta.name}
      </span>
    </div>
  );
}

