"use client";

import React, { Fragment } from "react";
import { toast } from '../../../components/Toaster';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Settings, Sparkles, Coins, Copy, Check, Shuffle } from "lucide-react";
import { getColorFromRankName, calculateBlueWinProbability, getKtmRank, getRankBadgeStyle, getHighestLaneMmr } from "../../../lib/mmr";
import { getPlayerTier } from "../../../lib/playerTier";
import { BalancerVcManager, updateVcStatus } from "../components/BalancerVcManager";
import { BalancerBo3Manager } from "../components/BalancerBo3Manager";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { Spinner } from "../../../components/Feedback";
import { RoleIcon, getPlayerCasinoBadges, MAX_VISIBLE_BADGES, CasinoBadges, getGroup } from "./helpers";

import type { BalanceResult } from "./types";

// ★ スティッキー下部クイックアクションバー
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function QuickActionBar({
  balancing,
  balanceResult,
  setShowResultModal,
  handleBalance,
  handleFestivalRandomBalance,
  activeCount,
  spectatorCount,
  canBalance,
  onOpenResultModal,
}: {
  balancing: boolean;
  balanceResult: BalanceResult | null;
  setShowResultModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleBalance: () => void | Promise<void>;
  handleFestivalRandomBalance: () => void | Promise<void>;
  activeCount: number;
  spectatorCount: number;
  canBalance: boolean;
  onOpenResultModal?: () => void;
}) {
  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl bg-surface/90 text-foreground backdrop-blur-xl border border-border/80 rounded-2xl p-2.5 px-3 sm:p-3 sm:px-5 shadow-2xl flex items-center justify-between gap-2 sm:gap-4 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary-500 hidden sm:block" />
          <span className="text-xs text-muted font-bold hidden sm:inline">参加:</span>
          <strong
            className={`font-mono text-xs sm:text-sm px-2.5 py-0.5 rounded-lg whitespace-nowrap font-black transition-colors ${
              canBalance
                ? "bg-success-500/15 text-success-600 dark:text-success-400 border border-success-500/30"
                : "bg-danger-500/15 text-danger-600 dark:text-danger-400 border border-danger-500/30"
            }`}
          >
            {activeCount}/10<span className="hidden sm:inline"> 人</span> {canBalance ? "✅" : `(あと${10 - activeCount})`}
          </strong>
        </div>
        {spectatorCount > 0 && (
          <span className="text-[11px] text-muted font-medium hidden sm:inline">
            (見学: {spectatorCount}人)
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {balanceResult && (
          <button
            type="button"
            onClick={onOpenResultModal || (() => setShowResultModal(true))}
            className="px-3 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover active:scale-95 text-foreground-soft font-bold text-xs border border-border transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Globe className="w-3.5 h-3.5 text-primary-500" /> <span className="hidden sm:inline">結果表示</span>
          </button>
        )}
        <Link
          href="/festival/pick"
          className="px-2.5 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover active:scale-95 text-foreground-soft font-bold text-xs border border-border transition hidden sm:flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
          title="お祭りカスタム用のチャンピオンピック候補・出身地一覧を開く"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden md:inline">ピック候補</span>
        </Link>

        <button
          type="button"
          onClick={handleFestivalRandomBalance}
          disabled={balancing || !canBalance}
          className={`px-2.5 sm:px-3 py-2 rounded-xl font-black text-xs whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md border ${
            balancing || !canBalance
              ? "bg-surface-subtle text-muted border-border cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-primary-600 to-danger-600 hover:from-primary-500 hover:to-danger-500 text-white border-primary-500/30 shadow-primary-500/20"
          }`}
          title="完全ランダムでお祭りチーム分け（MMRなし）"
        >
          <span>🎲 お祭り</span>
        </button>

        <button
          type="button"
          onClick={handleBalance}
          disabled={balancing || !canBalance}
          className={`px-3 sm:px-5 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-lg ${
            balancing || !canBalance
              ? "bg-surface-subtle text-muted cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-primary-500 to-emerald-500 hover:from-primary-400 hover:to-emerald-400 text-slate-950 font-black shadow-primary-500/25"
          }`}
        >
          {balancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
          <span className="whitespace-nowrap">{balancing ? "編成中..." : <>チーム分け<span className="hidden sm:inline">実行</span></>}</span>
        </button>
      </div>
    </div>
  );
}
