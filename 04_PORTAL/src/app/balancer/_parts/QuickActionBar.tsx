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

// ★ スティッキー下部クイックアクションバー
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function QuickActionBar({ balancing, balanceResult, setShowResultModal, handleBalance, handleFestivalRandomBalance, activeCount, spectatorCount, canBalance }: {
  balancing: boolean;
  balanceResult: any;
  setShowResultModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleBalance: () => any;
  handleFestivalRandomBalance: () => any;
  activeCount: number;
  spectatorCount: number;
  canBalance: boolean;
}) {
  return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl bg-surface/95 text-foreground backdrop-blur-md border border-border rounded-2xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary-600" />
              <span className="text-xs text-muted font-bold">参加:</span>
              <strong className={`font-mono text-xs sm:text-sm px-2 py-0.5 rounded-lg ${canBalance ? 'bg-success-100 text-success-800 border border-success-edge' : 'bg-danger-100 text-danger-800 border border-danger-edge'}`}>
                {activeCount} / 10 人 {canBalance ? '✅' : `(あと${10 - activeCount}人)`}
              </strong>
            </div>
            {spectatorCount > 0 && (
              <span className="text-[11px] text-muted-strong hidden sm:inline">
                (見学: {spectatorCount}人)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {balanceResult && (
              <button
                onClick={() => setShowResultModal(true)}
                className="px-3 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-soft font-bold text-xs border border-border transition flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-primary-600" /> <span className="hidden sm:inline">結果表示</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleFestivalRandomBalance}
              disabled={balancing || !canBalance}
              className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md border ${
                balancing || !canBalance
                  ? 'bg-surface-subtle text-faint border-border cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-primary-600 to-danger-600 hover:from-primary-500 hover:to-danger-500 text-white border-primary-edge shadow-primary-500/20'
              }`}
              title="完全ランダムでお祭りチーム分け（MMRなし）"
            >
              <span>🎲 お祭り</span>
            </button>

            <button
              onClick={handleBalance}
              disabled={balancing || !canBalance}
              className={`px-4 sm:px-5 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-lg ${
                balancing || !canBalance
                  ? 'bg-surface-hover text-faint cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-primary-500 to-primary-500 hover:from-primary-400 hover:to-primary-400 text-stone-950 shadow-primary-500/30'
              }`}
            >
              {balancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              <span>{balancing ? 'AI編成中...' : '⚔️ チーム分け実行'}</span>
            </button>
          </div>
        </div>
  );
}
