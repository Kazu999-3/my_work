"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  X,
  RotateCcw,
  Undo2,
  Copy,
  Check,
  Search,
  Sparkles,
  Trophy,
  Filter,
  Swords,
  Layers,
  Save,
  FolderOpen,
} from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "../../../components/Toaster";
import { getChampIcon, getChampSplash } from "../../../lib/ddragonClient";
import {
  ChampionMeta,
  ChampionRole,
  FestivalTheme,
  ROLES_LIST,
  REGIONS,
} from "../../../lib/championMetadata";

export type DraftTurn = {
  step: number; // 0..9
  team: "BLUE" | "RED";
  slot: number; // 0..4
  label: string; // 'B1', 'R1', etc.
};

// 🏆 大会公式ドラフトシーケンス（BAN除外・ピックのみ10手）
export const TOURNAMENT_DRAFT_SEQUENCE: DraftTurn[] = [
  { step: 0, team: "BLUE", slot: 0, label: "B1" },
  { step: 1, team: "RED",  slot: 0, label: "R1" },
  { step: 2, team: "RED",  slot: 1, label: "R2" },
  { step: 3, team: "BLUE", slot: 1, label: "B2" },
  { step: 4, team: "BLUE", slot: 2, label: "B3" },
  { step: 5, team: "RED",  slot: 2, label: "R3" },
  { step: 6, team: "RED",  slot: 3, label: "R4" },
  { step: 7, team: "BLUE", slot: 3, label: "B4" },
  { step: 8, team: "BLUE", slot: 4, label: "B5" },
  { step: 9, team: "RED",  slot: 4, label: "R5" },
];

const STORAGE_KEY = "ktm_tournament_draft_saved_state";

interface TournamentDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  excludedIds: Set<string>;
  allChamps: ChampionMeta[];
  activeTheme?: FestivalTheme | null;
}

export default function FestivalTournamentDraftModal({
  isOpen,
  onClose,
  excludedIds,
  allChamps,
  activeTheme,
}: TournamentDraftModalProps) {
  // ピック状況（Blue 5枠, Red 5枠）
  const [bluePicks, setBluePicks] = useState<(ChampionMeta | null)[]>([null, null, null, null, null]);
  const [redPicks, setRedPicks] = useState<(ChampionMeta | null)[]>([null, null, null, null, null]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [history, setHistory] = useState<{ step: number; team: "BLUE" | "RED"; slot: number; champ: ChampionMeta }[]>([]);

  // フィルター＆設定
  const [linkPoolWithFestival, setLinkPoolWithFestival] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<ChampionRole | "ALL">("ALL");
  const [copied, setCopied] = useState(false);

  // ピック済みチャンピオンのID集合
  const pickedChampIds = useMemo(() => {
    const set = new Set<string>();
    bluePicks.forEach((c) => { if (c) set.add(c.id); });
    redPicks.forEach((c) => { if (c) set.add(c.id); });
    return set;
  }, [bluePicks, redPicks]);

  // ピック可能プール（連動ONなら除外リスト外、連動OFFなら全チャンピオン）
  const availablePool = useMemo(() => {
    let pool = allChamps;
    if (linkPoolWithFestival) {
      pool = pool.filter((c) => !excludedIds.has(c.id));
    }
    const q = searchQuery.trim().toLowerCase();
    return pool.filter((c) => {
      // ロール絞り込み
      if (selectedRole !== "ALL" && !c.roles.includes(selectedRole)) {
        return false;
      }
      // 検索クエリ
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.ruby && c.ruby.toLowerCase().includes(q))
      );
    });
  }, [allChamps, linkPoolWithFestival, excludedIds, selectedRole, searchQuery]);

  // 現在のターン情報
  const currentTurn: DraftTurn | null = currentStep < TOURNAMENT_DRAFT_SEQUENCE.length
    ? TOURNAMENT_DRAFT_SEQUENCE[currentStep]
    : null;

  const isCompleted = currentStep >= TOURNAMENT_DRAFT_SEQUENCE.length;

  // チャンピオン選択ハンドラー
  const handleSelectChamp = useCallback((champ: ChampionMeta) => {
    if (!currentTurn) return;
    if (pickedChampIds.has(champ.id)) {
      toast.info("このチャンピオンは既にピックされています");
      return;
    }

    const { team, slot, step } = currentTurn;

    if (team === "BLUE") {
      setBluePicks((prev) => {
        const next = [...prev];
        next[slot] = champ;
        return next;
      });
    } else {
      setRedPicks((prev) => {
        const next = [...prev];
        next[slot] = champ;
        return next;
      });
    }

    setHistory((prev) => [...prev, { step, team, slot, champ }]);
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (nextStep === TOURNAMENT_DRAFT_SEQUENCE.length) {
      // 10体ピック完了時のファンファーレ
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
      toast.success("🏆 ドラフト完了！ 両チームのピックが揃いました！");
    }
  }, [currentTurn, pickedChampIds, currentStep]);

  // 1手戻す（Undo）
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    if (last.team === "BLUE") {
      setBluePicks((prev) => {
        const next = [...prev];
        next[last.slot] = null;
        return next;
      });
    } else {
      setRedPicks((prev) => {
        const next = [...prev];
        next[last.slot] = null;
        return next;
      });
    }
    setHistory((prev) => prev.slice(0, -1));
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, [history]);

  // 最初からやり直す（リセット）
  const handleReset = useCallback(() => {
    setBluePicks([null, null, null, null, null]);
    setRedPicks([null, null, null, null, null]);
    setCurrentStep(0);
    setHistory([]);
    toast.info("ドラフトを最初からリセットしました");
  }, []);

  // 一時保存
  const handleSaveState = useCallback(() => {
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        bluePicks: bluePicks.map((c) => c?.id || null),
        redPicks: redPicks.map((c) => c?.id || null),
        currentStep,
        linkPoolWithFestival,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      toast.success("💾 大会ドラフトの進行状態を一時保存しました！");
    } catch {
      toast.error("一時保存に失敗しました");
    }
  }, [bluePicks, redPicks, currentStep, linkPoolWithFestival]);

  // 一時保存からの復元
  const handleRestoreState = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        toast.info("一時保存されたデータはありません");
        return;
      }
      const data = JSON.parse(raw);
      if (Array.isArray(data.bluePicks) && Array.isArray(data.redPicks)) {
        const b = data.bluePicks.map((id: string | null) => id ? allChamps.find((c) => c.id === id) || null : null);
        const r = data.redPicks.map((id: string | null) => id ? allChamps.find((c) => c.id === id) || null : null);
        setBluePicks(b);
        setRedPicks(r);
        setCurrentStep(Number(data.currentStep) || 0);
        if (typeof data.linkPoolWithFestival === "boolean") {
          setLinkPoolWithFestival(data.linkPoolWithFestival);
        }
        // history再構築
        const newHist: { step: number; team: "BLUE" | "RED"; slot: number; champ: ChampionMeta }[] = [];
        TOURNAMENT_DRAFT_SEQUENCE.forEach((seq) => {
          if (seq.step < (Number(data.currentStep) || 0)) {
            const champ = seq.team === "BLUE" ? b[seq.slot] : r[seq.slot];
            if (champ) {
              newHist.push({ step: seq.step, team: seq.team, slot: seq.slot, champ });
            }
          }
        });
        setHistory(newHist);
        toast.success("📂 一時保存されたドラフト状態を復元しました！");
      }
    } catch {
      toast.error("復元に失敗しました");
    }
  }, [allChamps]);

  // Discord共有テキストコピー
  const handleCopyDiscord = useCallback(() => {
    const blueList = bluePicks.map((c, i) => `  B${i + 1}: ${c ? `**${c.name}**` : "*(未選択)*"}`).join("\n");
    const redList = redPicks.map((c, i) => `  R${i + 1}: ${c ? `**${c.name}**` : "*(未選択)*"}`).join("\n");
    const themeNote = activeTheme ? `\n🎪 テーマ縛り: **${activeTheme.name}**` : "";

    const text = `🏆 **【KTM 大会式ドラフト結果 (5v5)】** 🏆${themeNote}\n\n🔵 **BLUE チーム**\n${blueList}\n\n🔴 **RED チーム**\n${redList}\n\n※ ピック順: B1 ➔ R1,R2 ➔ B2,B3 ➔ R3,R4 ➔ B4,B5 ➔ R5`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("📋 Discord用のドラフト結果をコピーしました！");
    setTimeout(() => setCopied(false), 2000);
  }, [bluePicks, redPicks, activeTheme]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#0b0e17] text-[#f1f3f5] border-2 border-primary-500/60 rounded-3xl w-full max-w-[1500px] h-[96vh] shadow-2xl flex flex-col overflow-hidden relative">
        {/* 背景のチームカラーグロー */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* ── 最上部コントロールバー ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#121622] border-b border-stone-800 shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-rose-600 rounded-xl text-white shadow-md">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wider text-white flex items-center gap-2">
                大会式 5v5 ドラフトピック
                <span className="text-[10px] bg-primary-500/20 text-primary-400 font-bold px-2 py-0.5 rounded-full border border-primary-500/30">
                  BANなし / チャンピオンピックのみ
                </span>
              </h2>
            </div>
          </div>

          {/* 中央・右側コントロール群 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 🎪 お祭りプール連動スイッチ */}
            <div className="flex items-center gap-2 bg-stone-900/90 border border-stone-700/80 px-2.5 py-1 rounded-xl shadow-xs">
              <span className="text-[11px] font-bold text-stone-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                お祭りプール連動:
              </span>
              <button
                type="button"
                onClick={() => setLinkPoolWithFestival((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  linkPoolWithFestival ? "bg-amber-500" : "bg-stone-700"
                }`}
                title={linkPoolWithFestival ? "お祭りで除外（❌）された残りのみからピック" : "全チャンピオンから自由にピック"}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    linkPoolWithFestival ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className={`text-[10px] font-black ${linkPoolWithFestival ? "text-amber-400" : "text-stone-400"}`}>
                {linkPoolWithFestival ? "ON (縛り)" : "OFF (全解放)"}
              </span>
            </div>

            {/* 1手戻す */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-40 text-xs font-bold border border-stone-700 flex items-center gap-1 cursor-pointer transition"
              title="直前のピックを1手取り消します"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1手戻す</span>
            </button>

            {/* リセット */}
            <button
              type="button"
              onClick={handleReset}
              disabled={history.length === 0}
              className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-40 text-xs font-bold border border-stone-700 flex items-center gap-1 cursor-pointer transition"
              title="ドラフトをリセットします"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">リセット</span>
            </button>

            {/* 一時保存・復元 */}
            <button
              type="button"
              onClick={handleSaveState}
              className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 flex items-center gap-1 cursor-pointer transition"
              title="現在のピック進行状態を一時保存します"
            >
              <Save className="w-3.5 h-3.5 text-blue-400" />
              <span>保存</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreState}
              className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 flex items-center gap-1 cursor-pointer transition"
              title="保存されていたドラフト状態を復元します"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>復元</span>
            </button>

            {/* Discordコピー */}
            <button
              type="button"
              onClick={handleCopyDiscord}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-primary-600 to-rose-600 hover:from-primary-500 hover:to-rose-500 text-white text-xs font-black flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>結果コピー</span>
            </button>

            {/* 閉じる */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── ターン進行案内バナー ── */}
        <div className="bg-[#151926] border-b border-stone-800/90 px-4 py-2 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-3">
            {isCompleted ? (
              <div className="flex items-center gap-2 text-emerald-400 font-black animate-pulse">
                <Trophy className="w-4 h-4" />
                <span>🎉 ドラフト完了！ 両チームの5体が確定しました。Discordに結果を共有しましょう！</span>
              </div>
            ) : currentTurn ? (
              <div className="flex items-center gap-2 font-bold">
                <span
                  className={`px-2.5 py-0.5 rounded-full font-black text-xs shadow-xs ${
                    currentTurn.team === "BLUE"
                      ? "bg-blue-600 text-white animate-pulse"
                      : "bg-rose-600 text-white animate-pulse"
                  }`}
                >
                  {currentTurn.label}
                </span>
                <span className="text-stone-300">
                  現在は{" "}
                  <strong className={currentTurn.team === "BLUE" ? "text-blue-400 text-sm" : "text-rose-400 text-sm"}>
                    {currentTurn.team === "BLUE" ? "BLUE チーム" : "RED チーム"}
                  </strong>{" "}
                  のピック手番です（中央の一覧から選択してください）
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-stone-400">
            <span>進行:</span>
            <span className="font-bold text-white">{currentStep}</span>
            <span>/ 10</span>
          </div>
        </div>

        {/* ── メイン対戦ドラフト画面（左BLUE 5枠 / 中央プール / 右RED 5枠） ── */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 🔵 左側: BLUE チーム (B1〜B5) */}
          <div className="w-64 sm:w-72 md:w-80 bg-blue-950/20 border-r border-blue-500/30 flex flex-col p-3 gap-2 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-blue-500/40 pb-2">
              <span className="text-sm font-black text-blue-400 tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-blue-500/50 shadow-md animate-pulse" />
                BLUE TEAM
              </span>
              <span className="text-[10px] text-blue-300 font-mono font-bold bg-blue-900/50 px-2 py-0.5 rounded border border-blue-500/40">
                確定: {bluePicks.filter(Boolean).length} / 5
              </span>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const champ = bluePicks[slotIdx];
                const label = `B${slotIdx + 1}`;
                const isActive = currentTurn?.team === "BLUE" && currentTurn.slot === slotIdx;

                return (
                  <DraftTeamSlotCard
                    key={label}
                    label={label}
                    team="BLUE"
                    champ={champ}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </div>

          {/* ⚔️ 中央: チャンピオン選択プール ＆ 検索 */}
          <div className="flex-1 flex flex-col bg-[#0f121c] p-3 sm:p-4 min-w-0 overflow-hidden">
            {/* 検索・ロールフィルターバー */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800 shrink-0">
              {/* 検索入力 */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="チャンピオン名で検索..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700/80 text-xs text-white placeholder-stone-500 focus:outline-hidden focus:border-primary-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* ロールフィルタータブ */}
              <div className="flex items-center gap-1 bg-stone-900/90 p-0.5 rounded-xl border border-stone-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedRole("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedRole === "ALL"
                      ? "bg-primary-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  ALL
                </button>
                {ROLES_LIST.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedRole === role
                        ? "bg-primary-600 text-white shadow-xs"
                        : "text-stone-400 hover:text-white"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* 候補数インジケーター */}
              <div className="text-[11px] text-stone-400 font-mono font-bold shrink-0">
                選択可能: <span className="text-emerald-400">{availablePool.filter((c) => !pickedChampIds.has(c.id)).length}</span> / {availablePool.length}体
              </div>
            </div>

            {/* チャンピオン一覧グリッド */}
            <div className="flex-1 my-2 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 content-start min-h-0">
              {availablePool.map((champ) => {
                const isPicked = pickedChampIds.has(champ.id);

                return (
                  <button
                    key={champ.id}
                    type="button"
                    disabled={isPicked || isCompleted}
                    onClick={() => handleSelectChamp(champ)}
                    className={`group relative flex flex-col items-center p-1.5 rounded-xl border transition-all text-center select-none ${
                      isPicked
                        ? "bg-stone-900/40 border-stone-800/60 opacity-30 cursor-not-allowed filter grayscale"
                        : "bg-[#161a26] hover:bg-[#1f2436] border-stone-800/80 hover:border-primary-500 shadow-2xs hover:shadow-md cursor-pointer hover:scale-[1.03]"
                    }`}
                    title={`${champ.name} (${REGIONS[champ.region]?.name || champ.region})`}
                  >
                    {/* アイコン */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-stone-700/80 group-hover:border-primary-400 shrink-0">
                      <img
                        src={getChampIcon(champ.id)}
                        alt={champ.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {isPicked && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <span className="text-[9px] font-black text-stone-300 border border-stone-500 px-1 rounded">
                            PICKED
                          </span>
                        </div>
                      )}
                    </div>

                    {/* チャンピオン名 */}
                    <span className="mt-1 text-[11px] font-bold text-stone-200 group-hover:text-white truncate w-full px-0.5">
                      {champ.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🔴 右側: RED チーム (R1〜R5) */}
          <div className="w-64 sm:w-72 md:w-80 bg-rose-950/20 border-l border-rose-500/30 flex flex-col p-3 gap-2 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-rose-500/40 pb-2">
              <span className="text-[10px] text-rose-300 font-mono font-bold bg-rose-900/50 px-2 py-0.5 rounded border border-rose-500/40">
                確定: {redPicks.filter(Boolean).length} / 5
              </span>
              <span className="text-sm font-black text-rose-400 tracking-wider flex items-center gap-2">
                RED TEAM
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-rose-500/50 shadow-md animate-pulse" />
              </span>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const champ = redPicks[slotIdx];
                const label = `R${slotIdx + 1}`;
                const isActive = currentTurn?.team === "RED" && currentTurn.slot === slotIdx;

                return (
                  <DraftTeamSlotCard
                    key={label}
                    label={label}
                    team="RED"
                    champ={champ}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 最下部フッター ── */}
        <div className="bg-[#121622] border-t border-stone-800 px-4 py-2 flex items-center justify-between text-[11px] text-stone-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>大会ドラフト順:</span>
            <span className="font-mono text-[10px] text-stone-300 bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
              B1 ➔ R1,R2 ➔ B2,B3 ➔ R3,R4 ➔ B4,B5 ➔ R5
            </span>
          </div>

          <div>
            <span>KTM Official Tournament Draft Simulator</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── チーム枠スロットカード ──
function DraftTeamSlotCard({
  label,
  team,
  champ,
  isActive,
}: {
  label: string;
  team: "BLUE" | "RED";
  champ: ChampionMeta | null;
  isActive: boolean;
}) {
  const isBlue = team === "BLUE";

  return (
    <div
      className={`relative h-20 rounded-2xl border transition-all flex items-center overflow-hidden p-2 select-none ${
        isActive
          ? isBlue
            ? "border-blue-400 bg-blue-900/40 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/50"
            : "border-rose-400 bg-rose-900/40 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/50"
          : champ
          ? isBlue
            ? "border-blue-500/50 bg-[#10192e]"
            : "border-rose-500/50 bg-[#27121b]"
          : "border-stone-800/80 bg-[#121520]/80"
      }`}
    >
      {/* チャンピオン確定時の背景スプラッシュ */}
      {champ && (
        <div className="absolute inset-0 opacity-25 overflow-hidden">
          <img
            src={getChampSplash(champ.id)}
            alt=""
            className="w-full h-full object-cover object-center filter saturate-150 scale-110"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-r ${
              isBlue ? "from-[#0a1120] via-transparent to-[#0a1120]" : "from-[#1d0b13] via-transparent to-[#1d0b13]"
            }`}
          />
        </div>
      )}

      {/* ラベルバッジ（B1, R1等） */}
      <div className="relative z-10 flex items-center gap-2.5 w-full">
        <span
          className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono shrink-0 shadow-xs ${
            isBlue
              ? isActive
                ? "bg-blue-500 text-white animate-pulse"
                : "bg-blue-950 text-blue-300 border border-blue-500/40"
              : isActive
              ? "bg-rose-500 text-white animate-pulse"
              : "bg-rose-950 text-rose-300 border border-rose-500/40"
          }`}
        >
          {label}
        </span>

        {champ ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-stone-600/80 shrink-0 shadow-sm">
              <img
                src={getChampIcon(champ.id)}
                alt={champ.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-black text-white truncate drop-shadow-sm">
                {champ.name}
              </span>
              <span className="text-[10px] text-stone-300 truncate">
                {champ.roles.join(" / ")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-stone-500 text-xs italic flex-1">
            {isActive ? (
              <span
                className={`font-black animate-pulse ${
                  isBlue ? "text-blue-400" : "text-rose-400"
                }`}
              >
                ピック中... ⚡
              </span>
            ) : (
              <span>待機中</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
