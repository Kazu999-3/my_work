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
  FESTIVAL_THEMES,
  FestivalTheme,
  FESTIVAL_THEME_CATEGORIES,
} from "../../../lib/championMetadata";
import { getChampIcon } from "../../../lib/ddragonClient";
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
} from "lucide-react";
import { toast } from "../../../components/Toaster";
import CustomSubNav from "../../../components/CustomSubNav";

type ViewMode = "region" | "role" | "class" | "theme" | "all";

export interface DraftPlayer {
  playerNumber: number;
  champions: ChampionMeta[];
  selectedChampId?: string;
}

export default function FestivalPickPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("region");
  const [searchQuery, setSearchQuery] = useState("");
  // 除外されたチャンピオンIDのセット（❌が付いているもの）
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  // ルーレット選出結果モーダル用（旧来の単体・5体選出）
  const [rouletteResults, setRouletteResults] = useState<ChampionMeta[]>([]);
  const [isRouletteRolling, setIsRouletteRolling] = useState(false);
  const [copied, setCopied] = useState(false);

  // 👥 少人数・ドラフト機能用
  const [playerCount, setPlayerCount] = useState<number>(6); // 2〜10人（デフォルト3v3=6人）
  const [picksPerPlayer, setPicksPerPlayer] = useState<number>(3); // 1人あたりの候補数（1/2/3択）
  const [draftResults, setDraftResults] = useState<DraftPlayer[]>([]);
  const [isDraftRolling, setIsDraftRolling] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // 🎲 今日のテーマおまかせダイス
  const [isThemeRolling, setIsThemeRolling] = useState(false);
  const [activeTheme, setActiveTheme] = useState<FestivalTheme | null>(null);

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
    setActiveTheme(null);
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

  // 特定テーマのみ残して他を全除外（❌）
  const handleKeepOnlyTheme = useCallback((targetChampIds: string[], themeObj?: FestivalTheme) => {
    const keepSet = new Set(targetChampIds);
    const newExcluded = new Set<string>();
    ALL_METADATA_CHAMPIONS.forEach((c) => {
      if (!keepSet.has(c.id)) {
        newExcluded.add(c.id);
      }
    });
    setExcludedIds(newExcluded);
    if (themeObj) {
      setActiveTheme(themeObj);
    }
    toast.success(`このテーマの${targetChampIds.length}体のみを残して他を全除外（❌）しました！`);
  }, []);

  // 🎲 今日のテーマおまかせダイス
  const handleRandomThemeDice = useCallback(() => {
    if (FESTIVAL_THEMES.length === 0) return;
    setIsThemeRolling(true);
    let step = 0;
    const maxSteps = 12;
    const interval = setInterval(() => {
      step++;
      const randomTheme = FESTIVAL_THEMES[Math.floor(Math.random() * FESTIVAL_THEMES.length)];
      setActiveTheme(randomTheme);
      if (step >= maxSteps) {
        clearInterval(interval);
        setIsThemeRolling(false);
        handleKeepOnlyTheme(randomTheme.champIds, randomTheme);
        setViewMode("theme");
        toast.success(`🎲 今日のテーマ決定: 【${randomTheme.name}】！対象外を全除外しました`);
      }
    }, 60);
  }, [handleKeepOnlyTheme]);

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

  // 👥 ドラフト抽選（人数 × 候補数を重複なしで各プレイヤーに配布）
  const handleDraftRoulette = useCallback(() => {
    const available = filteredChamps.filter((c) => !excludedIds.has(c.id));
    const totalNeeded = playerCount * picksPerPlayer;
    if (available.length < totalNeeded) {
      toast.error(
        `候補チャンピオンが不足しています（必要: ${totalNeeded}体 / 残り: ${available.length}体）。除外を減らすか人数/候補数を調整してください`
      );
      return;
    }
    setIsDraftRolling(true);

    let step = 0;
    const maxSteps = 10;
    const interval = setInterval(() => {
      step++;
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const players: DraftPlayer[] = [];
      for (let i = 0; i < playerCount; i++) {
        players.push({
          playerNumber: i + 1,
          champions: shuffled.slice(i * picksPerPlayer, (i + 1) * picksPerPlayer),
        });
      }
      setDraftResults(players);
      if (step >= maxSteps) {
        clearInterval(interval);
        setIsDraftRolling(false);
        toast.success(
          `🎲 ${playerCount}名分（各${picksPerPlayer}択・計${totalNeeded}体）のドラフト候補を抽選しました！`
        );
      }
    }, 70);
  }, [filteredChamps, excludedIds, playerCount, picksPerPlayer]);

  // 特定プレイヤーのドラフト候補を1人だけリロール
  const handleRerollSinglePlayer = useCallback(
    (playerNum: number) => {
      const available = filteredChamps.filter((c) => !excludedIds.has(c.id));
      // 現在他のプレイヤーに割り振られているチャンプIDを収集
      const assignedIds = new Set<string>();
      draftResults.forEach((p) => {
        if (p.playerNumber !== playerNum) {
          p.champions.forEach((c) => assignedIds.add(c.id));
        }
      });
      // 未割り振りのプール
      const unassigned = available.filter((c) => !assignedIds.has(c.id));
      if (unassigned.length < picksPerPlayer) {
        toast.error("リロール可能な余りチャンピオンが不足しています");
        return;
      }
      const shuffled = [...unassigned].sort(() => Math.random() - 0.5);
      const newChamps = shuffled.slice(0, picksPerPlayer);

      setDraftResults((prev) =>
        prev.map((p) =>
          p.playerNumber === playerNum
            ? { ...p, champions: newChamps, selectedChampId: undefined }
            : p
        )
      );
      toast.success(`プレイヤー ${playerNum} の候補を再抽選しました！`);
    },
    [filteredChamps, excludedIds, draftResults, picksPerPlayer]
  );

  // プレイヤーが候補の中から1体を選んで確定
  const handleSelectDraftChamp = useCallback((playerNum: number, champId: string) => {
    setDraftResults((prev) =>
      prev.map((p) =>
        p.playerNumber === playerNum
          ? {
              ...p,
              selectedChampId: p.selectedChampId === champId ? undefined : champId,
            }
          : p
      )
    );
  }, []);

  // ドラフト結果をDiscord用フォーマットでコピー
  const handleCopyDraftResults = useCallback(() => {
    if (draftResults.length === 0) return;
    const totalNeeded = draftResults.length * picksPerPlayer;
    const themeNote = activeTheme ? `\n🎭 **テーマ**: ${activeTheme.name}` : "";

    const lines = draftResults.map((p) => {
      const champLines = p.champions
        .map((c) => {
          const isChosen = p.selectedChampId === c.id;
          const reg = REGIONS[c.region]?.name || c.region;
          return `    ${isChosen ? "👉 **" : "・ "}${c.name} (${reg})${
            isChosen ? "** (確定★)" : ""
          }`;
        })
        .join("\n");
      return `👤 **プレイヤー ${p.playerNumber}**:\n${champLines}`;
    });

    const text = `【🎪 KTM お祭りカスタム ドラフト候補】${themeNote}
👥 参加人数: ${draftResults.length}名（各${picksPerPlayer}択・計${totalNeeded}体）

${lines.join("\n\n")}

※ 各プレイヤーは自分の候補の中から1体選んでピックしてください！`;

    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    toast.success("ドラフト結果をDiscord用にコピーしました！");
    setTimeout(() => setCopiedDraft(false), 2000);
  }, [draftResults, picksPerPlayer, activeTheme]);

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
            <div className="md:col-span-6 flex flex-col gap-1.5">
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
                      onClick={() => setPlayerCount(preset.count)}
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
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5 text-amber-500" />
                1人あたりの候補:
              </span>
              <div className="flex items-center gap-1">
                {[
                  { count: 1, label: "1体 (即決)" },
                  { count: 2, label: "2択" },
                  { count: 3, label: "3択 (推奨)" },
                ].map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setPicksPerPlayer(item.count)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                      picksPerPlayer === item.count
                        ? "bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-xs"
                        : "bg-surface-subtle hover:bg-surface-hover text-muted-strong border border-border"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ③ ドラフト抽選実行ボタン & 必要体数インジケーター */}
            <div className="md:col-span-3 flex flex-col gap-1">
              <button
                type="button"
                onClick={handleDraftRoulette}
                disabled={isDraftRolling || activeCount < playerCount * picksPerPlayer}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary-600 via-rose-600 to-amber-600 hover:from-primary-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                <Dice6 className={`w-4 h-4 ${isDraftRolling ? "animate-spin" : ""}`} />
                <span>
                  {playerCount}名分ドラフト抽選 🎲
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
                    ? `残り ${activeCount}体 (抽選可能)`
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

            {/* プレイヤー別ドラフトカードグリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {draftResults.map((player) => (
                <div
                  key={player.playerNumber}
                  className={`bg-surface-subtle border rounded-2xl p-3 shadow-2xs transition-all ${
                    player.selectedChampId
                      ? "border-amber-500/60 ring-1 ring-amber-500/20 bg-amber-500/[0.02]"
                      : "border-border"
                  }`}
                >
                  {/* プレイヤーヘッダー */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        {player.playerNumber}
                      </span>
                      <span className="text-xs font-black text-foreground">
                        プレイヤー {player.playerNumber}
                      </span>
                      {player.selectedChampId && (
                        <span className="text-[10px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded-md shadow-2xs flex items-center gap-1">
                          <Check className="w-3 h-3" /> 確定
                        </span>
                      )}
                    </div>

                    {/* 個別リロールボタン */}
                    <button
                      type="button"
                      onClick={() => handleRerollSinglePlayer(player.playerNumber)}
                      className="text-[10px] text-muted-strong hover:text-primary-600 bg-surface hover:bg-surface-hover px-2 py-0.5 rounded-lg border border-border flex items-center gap-1 transition cursor-pointer"
                      title="このプレイヤーの候補だけを余りプールから再抽選"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>再抽選</span>
                    </button>
                  </div>

                  {/* 候補チャンピオン群 */}
                  <div className="grid grid-cols-3 gap-2">
                    {player.champions.map((champ) => {
                      const isSelected = player.selectedChampId === champ.id;
                      return (
                        <button
                          key={`${player.playerNumber}-${champ.id}`}
                          type="button"
                          onClick={() =>
                            handleSelectDraftChamp(player.playerNumber, champ.id)
                          }
                          className={`relative flex flex-col items-center p-2 rounded-xl border text-center transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-amber-500 shadow-xs"
                              : "bg-surface hover:bg-surface-hover border-border/80"
                          }`}
                        >
                          <div
                            className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-transform ${
                              isSelected
                                ? "border-amber-500 scale-105 shadow-sm"
                                : "border-border"
                            }`}
                          >
                            <img
                              src={getChampIcon(champ.id)}
                              alt={champ.name}
                              className="w-full h-full object-cover"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                <span className="bg-amber-500 text-white p-0.5 rounded-full shadow-xs">
                                  <Check className="w-3 h-3" />
                                </span>
                              </div>
                            )}
                          </div>
                          <span
                            className={`mt-1.5 text-[11px] font-black truncate w-full px-0.5 leading-tight ${
                              isSelected
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                            }`}
                          >
                            {champ.name}
                          </span>
                          <span className="text-[9px] text-muted truncate max-w-full">
                            {REGIONS[champ.region]?.name || champ.region}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

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
  const [scaleMode, setScaleMode] = useState<"auto" | "compact" | "tiny">("auto");

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

  // 候補数に応じた自動スケール判定
  const effectiveSize = useMemo(() => {
    if (scaleMode !== "auto") return scaleMode;
    if (pool.length > 80) return "tiny";
    return "compact";
  }, [scaleMode, pool.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#0b0d13] text-[#f1f3f5] border-2 border-primary-500/60 rounded-2xl w-full max-w-[1400px] h-[96vh] shadow-2xl flex flex-col overflow-hidden">
        {/* モーダル上部操作バー（キャプチャ外コントロール） */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#141822] border-b border-stone-800 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-black flex items-center gap-1.5 text-primary-400">
              <Camera className="w-4 h-4" /> 1枚キャプチャ用プレビュー
            </span>
            <span className="text-[11px] text-stone-400 hidden sm:inline">
              （スクロール不要で1画面に全収まるように縮小配置しています）
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 切り替えボタングループ */}
            <div className="flex items-center gap-1 bg-stone-900/80 p-0.5 rounded-lg border border-stone-800">
              <button
                type="button"
                onClick={() => setCaptureGroupBy("region")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  captureGroupBy === "region"
                    ? "bg-primary-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🌸 地域別
              </button>
              <button
                type="button"
                onClick={() => setCaptureGroupBy("role")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  captureGroupBy === "role"
                    ? "bg-primary-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                ⚔️ ロール別
              </button>
              <button
                type="button"
                onClick={() => setCaptureGroupBy("flat")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  captureGroupBy === "flat"
                    ? "bg-primary-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🔤 コンパクト全一覧
              </button>
            </div>

            {/* サイズ調整 */}
            <div className="flex items-center gap-1 bg-stone-900/80 p-0.5 rounded-lg border border-stone-800 text-[11px]">
              <span className="text-stone-500 pl-1 text-[10px]">サイズ:</span>
              <button
                type="button"
                onClick={() => setScaleMode("auto")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  scaleMode === "auto" ? "bg-stone-700 text-white" : "text-stone-400"
                }`}
              >
                自動
              </button>
              <button
                type="button"
                onClick={() => setScaleMode("compact")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  scaleMode === "compact" ? "bg-stone-700 text-white" : "text-stone-400"
                }`}
              >
                中
              </button>
              <button
                type="button"
                onClick={() => setScaleMode("tiny")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  scaleMode === "tiny" ? "bg-stone-700 text-white" : "text-stone-400"
                }`}
              >
                極小
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyTextPool}
              className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] font-bold border border-stone-700 flex items-center gap-1 text-stone-200 cursor-pointer"
            >
              {copiedPool ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>コピー</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white text-sm cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── 📸 キャプチャ対象エリア（はみ出さず1画面に完全収まる16:9比率風ボード） ── */}
        <div
          id="capture-board-area"
          className="flex-1 p-3 sm:p-4 bg-gradient-to-b from-[#0f121a] via-[#090b0f] to-[#06070a] flex flex-col justify-between overflow-hidden"
        >
          {/* ボードヘッダー */}
          <div className="flex items-center justify-between border-b border-primary-500/40 pb-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-gradient-to-br from-amber-500 to-rose-600 rounded-lg text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-wider text-white flex items-center gap-2">
                  KTM お祭りカスタム ピック可能チャンピオン
                </h2>
                <p className="text-[10px] text-stone-400">
                  ※ 赤い❌で除外されたチャンピオンを除いた【有効ピック候補】です
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#141824] border border-primary-500/40 px-3 py-1 rounded-xl shadow-inner">
              <span className="text-[11px] text-stone-400 font-bold">候補プール:</span>
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 leading-none">
                {pool.length}
              </span>
              <span className="text-[10px] text-stone-400">体</span>
            </div>
          </div>

          {/* ピック可能プールが0体の場合 */}
          {pool.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
              ピック可能なチャンピオンがいません（すべてのチャンピオンが除外されています）
            </div>
          )}

          {/* ── メイン配置コンテナ（flex-1 で余白に合わせて等分配置・縦スクロールなし） ── */}
          {pool.length > 0 && (
            <div className="flex-1 my-2 overflow-hidden flex flex-col justify-center">
              {/* ① 地域別グループ表示 */}
              {captureGroupBy === "region" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-1.5 h-full content-start overflow-hidden">
                  {poolByRegion.map(([regKey, champs]) => (
                    <div
                      key={regKey}
                      className="bg-[#121622]/90 border border-stone-800/90 rounded-lg p-1.5 flex flex-col gap-1 shadow-2xs overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-stone-800 pb-0.5 text-[10px]">
                        <span className="font-bold flex items-center gap-1 text-stone-200 truncate">
                          <span className="text-xs">{REGIONS[regKey]?.icon}</span>
                          <span className="truncate">{REGIONS[regKey]?.name || regKey}</span>
                        </span>
                        <span className="font-mono text-[9px] text-stone-400 bg-stone-900 px-1 rounded shrink-0">
                          {champs.length}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 content-start overflow-hidden">
                        {champs.map((c) => (
                          <CompactCaptureIcon key={c.id} meta={c} size={effectiveSize} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ② ロール別グループ表示 */}
              {captureGroupBy === "role" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 h-full content-start overflow-hidden">
                  {poolByRole.map(([role, champs]) => (
                    <div
                      key={role}
                      className="bg-[#121622]/90 border border-stone-800/90 rounded-lg p-2 flex flex-col gap-1.5 shadow-2xs overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-stone-800 pb-1 text-xs">
                        <span className="font-bold flex items-center gap-1.5 text-stone-200">
                          <span>{roleLabelMap[role]?.icon}</span>
                          <span>{roleLabelMap[role]?.label || role}</span>
                        </span>
                        <span className="font-mono text-[10px] text-stone-400 bg-stone-900 px-1.5 py-0.2 rounded border border-stone-800">
                          {champs.length}体
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 content-start overflow-hidden">
                        {champs.map((c) => (
                          <CompactCaptureIcon key={`${role}-${c.id}`} meta={c} size={effectiveSize} showName />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ③ コンパクト全一覧（名簿形式・画面にギッシリ整列） */}
              {captureGroupBy === "flat" && (
                <div className="bg-[#121622]/90 border border-stone-800/90 rounded-xl p-2.5 flex flex-wrap gap-1 sm:gap-1.5 content-start overflow-hidden h-full">
                  {pool.map((c) => (
                    <CompactCaptureIcon key={c.id} meta={c} size={effectiveSize} showName />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* フッター情報（キャプチャ用クレジット） */}
          <div className="flex items-center justify-between text-[9px] text-stone-500 border-t border-stone-800/80 pt-1 px-1 shrink-0">
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
  size = "compact",
  showName = false,
}: {
  meta: ChampionMeta;
  size?: "compact" | "tiny";
  showName?: boolean;
}) {
  const isTiny = size === "tiny";

  return (
    <div
      className={`flex items-center gap-1 bg-[#181d2a] border border-stone-700/60 rounded-md p-0.5 px-1 shadow-2xs shrink-0 select-none ${
        showName ? (isTiny ? "min-w-[55px]" : "min-w-[68px]") : ""
      }`}
      title={`${meta.name} (${REGIONS[meta.region]?.name || meta.region})`}
    >
      <div
        className={`${
          isTiny ? "w-5 h-5 rounded" : "w-6 h-6 rounded-md"
        } overflow-hidden border border-stone-600/80 shrink-0`}
      >
        <img
          src={getChampIcon(meta.id)}
          alt={meta.name}
          className="w-full h-full object-cover"
        />
      </div>
      <span
        className={`${
          isTiny ? "text-[8.5px] max-w-[45px]" : "text-[9.5px] max-w-[58px]"
        } font-bold text-stone-200 truncate leading-none px-0.5`}
      >
        {meta.name}
      </span>
    </div>
  );
}


