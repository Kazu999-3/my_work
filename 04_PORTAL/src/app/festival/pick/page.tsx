"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  FESTIVAL_THEMES,
  FestivalTheme,
  FESTIVAL_THEME_CATEGORIES,
} from "../../../lib/championMetadata";
import { getChampIcon } from "../../../lib/ddragonClient";
import { ChampionIcon } from "../../../components/ChampionIcon";
import {
  Sparkles,
  RotateCcw,
  Search,
  Dice5,
  Dice6,
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
  Flame,
  Users,
  Dices,
  Shuffle,
  Trophy,
  UserCheck,
  Info,
  Share2,
  Link2,
  Shield,
  Save,
  FolderOpen,
} from "lucide-react";
import { toast } from "../../../components/Toaster";
import CustomSubNav from "../../../components/CustomSubNav";
import FestivalTournamentDraftModal from "./FestivalTournamentDraftModal";
import SundayThemeModal from "./SundayThemeModal";
import type { ViewMode, DraftPlayer } from "./_parts/types";
import ChampionCard from "./_parts/ChampionCard";
import DraftPlayerCard from "./_parts/DraftPlayerCard";
import CapturePreviewModal from "./_parts/CapturePreviewModal";
import { useFestivalGroups } from "./_parts/useFestivalGroups";
import { useFestivalDraft } from "./_parts/useFestivalDraft";
import { useFestivalStorage } from "./_parts/useFestivalStorage";

export type { DraftPlayer };

export default function FestivalPickPage() {
  const [searchQuery, setSearchQuery] = useState("");
  // 除外されたチャンピオンIDのセット（❌が付いているもの）
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // 📸 キャプチャ用1枚プレビューモーダル
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [captureGroupBy, setCaptureGroupBy] = useState<"region" | "role" | "flat">("region");
  const [copiedPool, setCopiedPool] = useState(false);

  // ⚔️ 大会式 5v5 ドラフトピックモーダル
  const [showTournamentDraftModal, setShowTournamentDraftModal] = useState(false);

  // 🎪 日曜お祭りお題モーダル
  const [showSundayThemeModal, setShowSundayThemeModal] = useState(false);

  // 🎲 今日のテーマおまかせダイス演出中フラグ
  const [isThemeRolling, setIsThemeRolling] = useState(false);

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

  // 1. グループ・フィルタ計算フック
  const groups = useFestivalGroups(searchQuery, excludedIds);

  // 2. ドラフト結果状態（先に宣言してストレージと循環参照を解消）
  const [draftResults, setDraftResults] = useState<DraftPlayer[]>([]);

  // 3. ストレージ・永続化フック
  const storage = useFestivalStorage({
    excludedIds,
    setExcludedIds,
    draftResults,
    setDraftResults,
  });

  // 全リセット
  const handleResetAll = useCallback(() => {
    setExcludedIds(new Set());
    storage.setActiveTheme(null);
    toast.success("すべての除外（❌）をリセットしました");
  }, [storage]);

  // 4. ドラフト・ルーレット実行フック
  const draft = useFestivalDraft({
    filteredChamps: groups.filteredChamps,
    excludedIds,
    playerCount: storage.playerCount,
    picksPerPlayer: storage.picksPerPlayer,
    teamMode: storage.teamMode,
    activeTheme: storage.activeTheme,
  });

  // draftResultsの同期（draftフック内の結果を外へ反映）
  useEffect(() => {
    setDraftResults(draft.draftResults);
  }, [draft.draftResults]);

  // 🎲 今日のテーマおまかせダイス
  const handleRandomThemeDice = useCallback(() => {
    if (FESTIVAL_THEMES.length === 0) return;
    setIsThemeRolling(true);
    let step = 0;
    const maxSteps = 12;
    const interval = setInterval(() => {
      step++;
      const randomTheme = FESTIVAL_THEMES[Math.floor(Math.random() * FESTIVAL_THEMES.length)];
      storage.setActiveTheme(randomTheme);
      if (step >= maxSteps) {
        clearInterval(interval);
        setIsThemeRolling(false);
        storage.handleKeepOnlyTheme(randomTheme.champIds, randomTheme);
        storage.setViewMode("theme");
        toast.success(`🎲 今日のテーマ決定: 【${randomTheme.name}】！対象外を全除外しました`);
      }
    }, 60);
  }, [storage]);

  // 各種変数のエイリアス（JSXとの100%互換維持）
  const {
    viewMode,
    setViewMode,
    playerCount,
    setPlayerCount,
    picksPerPlayer,
    setPicksPerPlayer,
    teamMode,
    setTeamMode,
    activeTheme,
    setActiveTheme,
    copiedShareUrl,
    hasSavedData,
    savedTimeLabel,
    sundayTheme,
    setSundayTheme,
    handleCopyShareLink,
    handleSaveState,
    handleRestoreState,
    handleKeepOnlyTheme,
  } = storage;

  const {
    filteredChamps,
    activeCount,
    regionGroups,
    roleBreakdowns,
    roleGroups,
    classGroups,
  } = groups;

  const {
    isDraftRolling,
    copiedDraft,
    rouletteResults,
    setRouletteResults,
    isRouletteRolling,
    copied,
    handleDraftRoulette,
    handleRerollSinglePlayer,
    handleSelectDraftChamp,
    handleCopyDraftResults,
    handleRoulette,
    handleCopyResults,
  } = draft;

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-6 pb-28">
      {/* ── ヘッダー ── */}
      <div className="max-w-7xl mx-auto flex flex-col gap-4 mb-6">
        <CustomSubNav />
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

            {/* 🎪 日曜お祭りお題設定ボタン */}
            <button
              type="button"
              onClick={() => setShowSundayThemeModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
              title="日曜お祭りカスタムの今週のお題を設定・確認します（Discordリマインドに自動連動）"
            >
              <span className="text-sm">🎪</span>
              <span className="truncate max-w-[180px]">
                今週: {sundayTheme?.title?.replace(/^[^\w\s\u3000-\u30FF\u4E00-\u9FA5]+/, "").trim() || "未定"}
              </span>
            </button>

            {/* 🎲 今日のテーマおまかせダイス */}
            <button
              type="button"
              onClick={handleRandomThemeDice}
              disabled={isThemeRolling}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer animate-pulse hover:animate-none"
              title="全19テーマの中から今日の縛りをランダム選出して即座にプール絞り込み！"
            >
              <Dices className={`w-3.5 h-3.5 ${isThemeRolling ? "animate-spin" : ""}`} />
              <span>🎲 テーマおまかせダイス</span>
            </button>

            {/* ⚔️ 大会式 5v5 ドラフトピックボタン */}
            <button
              type="button"
              onClick={() => setShowTournamentDraftModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 hover:from-blue-500 hover:to-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
              title="プロ大会形式（B1 ➔ R1,R2 ➔ B2,B3...）で5v5のチャンピオンピックをシミュレート"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>⚔️ 大会式ドラフト (5v5)</span>
            </button>

            {/* 📸 キャプチャ用1枚プレビューボタン */}
            <button
              type="button"
              onClick={() => setShowCaptureModal(true)}
              disabled={activeCount === 0}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
              title="最終的にピック可能なチャンピオンを1画面にまとめてキャプチャ用表示"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📸 1枚プレビュー</span>
            </button>

            {/* 🔗 設定URL共有ボタン */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="px-3.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="現在のテーマ・人数・設定をURLとしてコピーし、Discordやメンバーに共有できます"
            >
              {copiedShareUrl ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Share2 className="w-3.5 h-3.5 text-primary-500" />}
              <span>{copiedShareUrl ? "コピー完了！" : "🔗 設定共有"}</span>
            </button>

            {/* 💾 一時保存ボタン */}
            <button
              type="button"
              onClick={handleSaveState}
              className="px-3.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="除外設定やドラフト結果をブラウザに一時保存します"
            >
              <Save className="w-3.5 h-3.5 text-blue-500" />
              <span>💾 一時保存</span>
            </button>

            {/* 📂 復元ボタン */}
            {hasSavedData && (
              <button
                type="button"
                onClick={handleRestoreState}
                className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer animate-fade-in"
                title={`前回保存した状態を復元します${savedTimeLabel ? ` (${savedTimeLabel} 保存)` : ""}`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>📂 復元 {savedTimeLabel && <span className="text-[10px] opacity-75 font-mono">({savedTimeLabel})</span>}</span>
              </button>
            )}

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

        {/* ── 👥 少人数（10人以下）対応ドラフトルーレット パネル ── */}
        <div className="bg-gradient-to-br from-surface via-surface to-primary-950/20 border-2 border-primary-500/30 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-primary-600 text-white rounded-xl shadow-xs">
                <Users className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
                  少人数（10人以下）対応 ドラフト抽選
                  <span className="text-[10px] bg-primary-500/10 text-primary-600 font-bold px-2 py-0.5 rounded-full border border-primary-500/20">
                    2〜10人対応
                  </span>
                </h3>
                <p className="text-[11px] text-muted">
                  参加人数に合わせて1人1〜3択のピック候補を重複なしで自動配布します。
                </p>
              </div>
            </div>

            {/* 現在適用中のテーマ表示 */}
            {activeTheme && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl self-start sm:self-auto">
                <span className="text-sm">{activeTheme.icon}</span>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                  {activeTheme.name}
                </span>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="ml-1 text-[10px] text-muted hover:text-danger-500 cursor-pointer"
                  title="テーマ解除"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* ① 人数選択 (スライダー & プリセット) */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary-500" />
                  参加人数:
                  <span className="font-black text-primary-600 font-mono text-sm">
                    {playerCount}名
                  </span>
                </span>
                {/* クイックプリセット */}
                <div className="flex items-center gap-1">
                  {[
                    { label: "1v1", count: 2 },
                    { label: "2v2", count: 4 },
                    { label: "3v3", count: 6 },
                    { label: "4v4", count: 8 },
                    { label: "5v5", count: 10 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setPlayerCount(preset.count);
                        setTeamMode(true);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        playerCount === preset.count
                          ? "bg-primary-600 text-white shadow-xs"
                          : "bg-surface-subtle hover:bg-surface-hover text-muted-strong border border-border"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full accent-primary-600 cursor-pointer h-1.5 bg-surface-subtle rounded-lg"
              />
            </div>

            {/* ② 1人あたりの候補数選択 */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-amber-500" />
                候補数:
              </span>
              <div className="flex items-center gap-1">
                {[
                  { count: 1, label: "1体" },
                  { count: 2, label: "2択" },
                  { count: 3, label: "3択★" },
                ].map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setPicksPerPlayer(item.count)}
                    className={`flex-1 py-1 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                      picksPerPlayer === item.count
                        ? "bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-xs font-black"
                        : "bg-surface-subtle hover:bg-surface-hover text-muted-strong border border-border"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ③ 形式（チーム対抗 vs 個人戦） */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-rose-500" />
                対戦形式:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTeamMode(true)}
                  disabled={playerCount % 2 !== 0}
                  className={`flex-1 py-1 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1 disabled:opacity-40 ${
                    teamMode && playerCount % 2 === 0
                      ? "bg-gradient-to-r from-blue-600 to-rose-600 text-white shadow-xs font-black"
                      : "bg-surface-subtle hover:bg-surface-hover text-muted-strong border border-border"
                  }`}
                  title={playerCount % 2 !== 0 ? "偶数人数のみ対応" : "BLUEチーム vs REDチームの対抗戦"}
                >
                  <span>⚔️ チーム</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamMode(false)}
                  className={`flex-1 py-1 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                    !teamMode || playerCount % 2 !== 0
                      ? "bg-primary-600 text-white shadow-xs font-black"
                      : "bg-surface-subtle hover:bg-surface-hover text-muted-strong border border-border"
                  }`}
                >
                  <span>👤 個人</span>
                </button>
              </div>
            </div>

            {/* ④ ドラフト抽選実行ボタン & 必要体数インジケーター */}
            <div className="md:col-span-3 flex flex-col gap-1">
              <button
                type="button"
                onClick={handleDraftRoulette}
                disabled={isDraftRolling || activeCount < playerCount * picksPerPlayer}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary-600 via-rose-600 to-amber-600 hover:from-primary-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                <Dice6 className={`w-4 h-4 ${isDraftRolling ? "animate-spin" : ""}`} />
                <span>
                  {teamMode && playerCount % 2 === 0
                    ? `${playerCount / 2}v${playerCount / 2} チーム対抗抽選 🎲`
                    : `${playerCount}名 ドラフト抽選 🎲`}
                </span>
              </button>
              <div className="flex items-center justify-between text-[10px] px-1 text-muted">
                <span>必要: {playerCount * picksPerPlayer}体</span>
                <span
                  className={
                    activeCount >= playerCount * picksPerPlayer
                      ? "text-success-600 font-bold"
                      : "text-danger-500 font-bold"
                  }
                >
                  {activeCount >= playerCount * picksPerPlayer
                    ? `残り ${activeCount}体 (OK)`
                    : `残り ${activeCount}体 (不足)`}
                </span>
              </div>
            </div>
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
              onClick={() => setViewMode("theme")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                viewMode === "theme"
                  ? "bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-sm"
                  : "bg-surface-subtle hover:bg-surface-hover text-foreground-soft border border-border"
              }`}
            >
              🎭 特殊テーマ（縛り）
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
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition disabled:opacity-50 cursor-pointer"
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

        {/* ② ロール別モード（Lolalytics過去30日実測統計準拠: 通常 vs オフメタ枠） */}
        {viewMode === "role" && (
          <div className="space-y-6">
            {ROLES_LIST.map((role) => {
              const breakdown = roleBreakdowns[role];
              const standardChamps = breakdown.standard;
              const offmetaChamps = breakdown.offmeta;
              const allChamps = breakdown.all;
              if (allChamps.length === 0) return null;

              const allIds = allChamps.map((c) => c.id);
              const standardIds = standardChamps.map((c) => c.id);
              const offmetaIds = offmetaChamps.map((c) => c.id);
              const excludedCount = allIds.filter((id) => excludedIds.has(id)).length;

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
                        {standardChamps.map((champ) => (
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
                        {offmetaChamps.map((champ) => (
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
      </div>

      {/* ── ルーレット抽選結果モーダル ── */}
      {rouletteResults.length > 0 && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border-2 border-primary-500/50 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col items-center text-center">
            {/* 上部背景デコレーション */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600" />

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
                    <ChampionIcon
                      champId={c.id}
                      champName={c.name}
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

      {/* ── 👥 少人数・ドラフト抽選結果モーダル ── */}
      {draftResults.length > 0 && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border-2 border-primary-500/50 rounded-3xl p-4 sm:p-6 max-w-4xl w-full shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col">
            {/* 上部背景デコレーション */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary-500 via-rose-500 to-amber-500" />

            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between w-full mb-3 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 bg-gradient-to-br from-primary-500 to-rose-600 rounded-xl text-white shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                    お祭りドラフト抽選結果！
                    <span className="text-xs bg-primary-500/10 text-primary-600 font-bold px-2 py-0.5 rounded-full border border-primary-500/20">
                      {draftResults.length}名 / 各{picksPerPlayer}択
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted">
                    各プレイヤーは提示された候補の中から1体を選んでください（クリックで確定マーク★が付きます）
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDraftResults([])}
                className="p-1.5 rounded-full hover:bg-surface-hover text-muted hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* テーマ情報 */}
            {activeTheme && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                <span className="text-lg">{activeTheme.icon}</span>
                <div>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    テーマ: {activeTheme.name}
                  </span>
                  <span className="text-muted ml-2 text-[11px]">
                    — {activeTheme.description}
                  </span>
                </div>
              </div>
            )}

            {/* プレイヤー別ドラフトカード（チーム対抗表示または個人一覧表示） */}
            {draftResults.some((p) => p.team) ? (
              /* ⚔️ チーム対戦（BLUE vs RED）2カラム表示 */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                {/* 🔵 BLUE チーム */}
                <div className="bg-blue-950/20 border-2 border-blue-500/40 rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 shadow-xs animate-pulse" />
                      <h4 className="text-sm font-black text-blue-400 tracking-wider">
                        BLUE チーム
                      </h4>
                    </div>
                    <span className="text-[11px] text-blue-300 font-bold bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-500/30 font-mono">
                      確定: {draftResults.filter((p) => p.team === "BLUE" && p.selectedChampId).length} / {draftResults.filter((p) => p.team === "BLUE").length}名
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {draftResults
                      .filter((p) => p.team === "BLUE")
                      .map((player) => (
                        <DraftPlayerCard
                          key={player.playerNumber}
                          player={player}
                          onReroll={() => handleRerollSinglePlayer(player.playerNumber)}
                          onSelect={(champId) => handleSelectDraftChamp(player.playerNumber, champId)}
                        />
                      ))}
                  </div>
                </div>

                {/* 🔴 RED チーム */}
                <div className="bg-rose-950/20 border-2 border-rose-500/40 rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shadow-xs animate-pulse" />
                      <h4 className="text-sm font-black text-rose-400 tracking-wider">
                        RED チーム
                      </h4>
                    </div>
                    <span className="text-[11px] text-rose-300 font-bold bg-rose-900/40 px-2 py-0.5 rounded-full border border-rose-500/30 font-mono">
                      確定: {draftResults.filter((p) => p.team === "RED" && p.selectedChampId).length} / {draftResults.filter((p) => p.team === "RED").length}名
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {draftResults
                      .filter((p) => p.team === "RED")
                      .map((player) => (
                        <DraftPlayerCard
                          key={player.playerNumber}
                          player={player}
                          onReroll={() => handleRerollSinglePlayer(player.playerNumber)}
                          onSelect={(champId) => handleSelectDraftChamp(player.playerNumber, champId)}
                        />
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              /* 👤 個人戦グリッド表示 */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                {draftResults.map((player) => (
                  <DraftPlayerCard
                    key={player.playerNumber}
                    player={player}
                    onReroll={() => handleRerollSinglePlayer(player.playerNumber)}
                    onSelect={(champId) => handleSelectDraftChamp(player.playerNumber, champId)}
                  />
                ))}
              </div>
            )}

            {/* フッター操作ボタン群 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/80 pt-3">
              <span className="text-xs text-muted font-bold">
                確定済み:{" "}
                <span className="text-amber-600 font-mono font-black">
                  {draftResults.filter((p) => p.selectedChampId).length}
                </span>{" "}
                / {draftResults.length}名
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveState}
                  className="px-3.5 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="現在のピック確定状況・ドラフト結果を一時保存します"
                >
                  <Save className="w-4 h-4 text-blue-500" />
                  <span>💾 一時保存</span>
                </button>
                <button
                  type="button"
                  onClick={handleDraftRoulette}
                  disabled={isDraftRolling}
                  className="px-3.5 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Dice6 className={`w-4 h-4 ${isDraftRolling ? "animate-spin" : ""}`} />
                  <span>もう一度全員抽選 🎲</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyDraftResults}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-rose-600 hover:from-primary-500 hover:to-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  {copiedDraft ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>📋 Discord用に結果コピー</span>
                </button>
              </div>
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

      {/* ── ⚔️ 大会式 5v5 ドラフトピックモーダル ── */}
      <FestivalTournamentDraftModal
        isOpen={showTournamentDraftModal}
        onClose={() => setShowTournamentDraftModal(false)}
        excludedIds={excludedIds}
        allChamps={ALL_METADATA_CHAMPIONS}
        activeTheme={activeTheme}
      />

      {/* ── 🎪 今週の日曜お祭りお題設定モーダル ── */}
      <SundayThemeModal
        isOpen={showSundayThemeModal}
        onClose={() => setShowSundayThemeModal(false)}
        onThemeSaved={(t) => setSundayTheme(t)}
      />
    </div>
  );
}
