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

// ヘッダー（タイトル・操作ボタン群）
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function BalancerHeader({ players, setPlayers, saving, isAdmin, predStats, satStats, integrityData, balancing, balanceResult, showResultModal, setShowResultModal, selectedTable, setSelectedTable, bo3State, handleResetBo3, handleBalance, handleFestivalRandomBalance, activeCount, spectatorCount, inactiveCount, canBalance, selectionMode, setSelectionMode, onOpenResultModal }: {
  players: any[];
  setPlayers: React.Dispatch<React.SetStateAction<any[]>>;
  saving: boolean;
  announcingStats?: boolean;
  isAdmin: boolean;
  predStats?: { total: number; correct: number; accuracy: number; avgConfidence: number; avgCloseness: number } | null;
  satStats?: { tallied: number; totalUp: number; totalDown: number; satisfactionRate: number | null } | null;
  setShowAdminPanel?: React.Dispatch<React.SetStateAction<boolean>>;
  integrityData: any;
  balancing: boolean;
  balanceResult: any;
  showResultModal: boolean;
  setShowResultModal: React.Dispatch<React.SetStateAction<boolean>>;
  searchDepth?: number;
  setSearchDepth?: React.Dispatch<React.SetStateAction<number>>;
  selectedTable: { label: string; ids: any[] } | null;
  setSelectedTable: React.Dispatch<React.SetStateAction<{ label: string; ids: any[] } | null>>;
  bo3State: any;
  handleResetBo3: () => any;
  handleAnnounceStats?: () => any;
  handleBalance: () => any;
  handleFestivalRandomBalance: () => any;
  activeCount: number;
  spectatorCount: number;
  inactiveCount: number;
  canBalance: boolean;
  selectionMode?: 'fair' | 'low' | 'high';
  setSelectionMode?: React.Dispatch<React.SetStateAction<'fair' | 'low' | 'high'>>;
  onOpenResultModal?: () => void;
}) {
  return (
        <div className="flex flex-col gap-3 border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-primary-700" /> チーム分けバランサー
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {saving && <span className="flex items-center gap-1 text-primary-700 text-xs"><RefreshCw className="h-3 w-3 animate-spin" /> 保存中...</span>}
              {/* 🎯 品質ヘルスバッジ（接戦度 ＆ 満足度） */}
              {(predStats || satStats) && (
                <div className="flex items-center gap-2.5 bg-surface-subtle border border-border px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
                  {predStats && predStats.total > 0 && (
                    <span className="flex items-center gap-1 text-primary-700" title={`直近${predStats.total}戦の平均接戦度（100点満点）`}>
                      <span>🎯 接戦度:</span>
                      <span className="font-mono font-black text-foreground">{predStats.avgCloseness}点</span>
                    </span>
                  )}
                  {predStats && satStats && predStats.total > 0 && satStats.tallied > 0 && (
                    <span className="text-border">|</span>
                  )}
                  {satStats && satStats.tallied > 0 && satStats.satisfactionRate !== null && (
                    <span className="flex items-center gap-1 text-success-700" title={`試合後の満足度（${satStats.totalUp}👍 / ${satStats.totalDown}👎）`}>
                      <span>👍 満足度:</span>
                      <span className="font-mono font-black text-foreground">{satStats.satisfactionRate}%</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ★ リアルタイム参加者バッジ */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${
              canBalance ? 'bg-success-100 border-success-edge/60 text-success-700 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-primary-100 border-primary-edge/60 text-primary-700'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${canBalance ? 'bg-success-400' : 'bg-primary-400 animate-pulse'}`}></span>
              <span className="text-xs">参加</span>
              <span className={`text-2xl font-black leading-none ${canBalance ? 'text-success-700' : 'text-primary-700'}`}>{activeCount}</span>
              <span className="text-xs opacity-60">人</span>
              {canBalance ? (
                <span className="text-xs text-success-700 font-black border-l border-success-edge pl-2">✅ 準備完了！</span>
              ) : (
                <span className="text-xs text-primary-700 font-bold border-l border-primary-edge pl-2">あと {10 - activeCount} 人必要</span>
              )}
            </div>
            {spectatorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary-edge-soft bg-primary-100 text-primary-700 font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-primary-400"></span>
                <span className="text-xs">観戦</span>
                <span className="text-xl font-black text-primary-700">{spectatorCount}</span>
                <span className="text-xs opacity-60">人</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-black/[0.03] text-muted-strong font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-stone-600"></span>
              <span className="text-xs">不参加</span>
              <span className="text-xl font-black text-faint">{inactiveCount}</span>
              <span className="text-xs opacity-60">人</span>
            </div>

            {/* 🏆 BO3 シリーズ進行状況バナー (アクティブ時) */}
            {bo3State && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-primary-500/15 via-primary-500/15 to-primary-500/15 border-2 border-primary-edge-strong/40 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xl">🏆</span>
                  <span className="text-xs font-black text-primary-950">
                    BO3 シリーズ進行中 [第{bo3State.gameNumber}戦]
                  </span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-900 border border-secondary-edge">
                    🔵 {bo3State.team1IsCurrentlyBlue ? (bo3State.team1Name || 'Blue') : (bo3State.team2Name || 'Red')}: {bo3State.team1IsCurrentlyBlue ? Number(bo3State.team1Wins || 0) : Number(bo3State.team2Wins || 0)}勝
                  </span>
                  <span className="text-xs font-black text-muted-strong">VS</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-danger-100 text-danger-900 border border-danger-edge">
                    🔴 {!bo3State.team1IsCurrentlyBlue ? (bo3State.team1Name || 'Blue') : (bo3State.team2Name || 'Red')}: {!bo3State.team1IsCurrentlyBlue ? Number(bo3State.team1Wins || 0) : Number(bo3State.team2Wins || 0)}勝
                  </span>
                  {bo3State.gameNumber === 3 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-danger-600 text-white animate-pulse">
                      🔥 1-1 最終決戦！
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenResultModal || (() => setShowResultModal(true))}
                    className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-black text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <span>スコアボードを開く 📊</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBo3}
                    className="text-[11px] font-bold text-muted-strong hover:text-foreground-soft underline cursor-pointer"
                  >
                    終了
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* 一括操作セレクター（ON/解除/復元を1つに集約） */}
              <div className="relative">
                <select
                  value=""
                  onChange={(e) => {
                    const action = e.target.value;
                    if (action === 'all_on') {
                      const updated = players.map(p => p.is_spectator_fixed ? p : { ...p, is_active: true });
                      setPlayers(updated);
                      try { localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id))); } catch {}
                      toast.success('全員参加ONにしました');
                    } else if (action === 'all_off') {
                      const updated = players.map(p => p.is_spectator_fixed ? p : { ...p, is_active: false });
                      setPlayers(updated);
                      try { localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id))); } catch {}
                      toast.info('全員解除しました');
                    } else if (action === 'restore') {
                      try {
                        const savedIds = JSON.parse(localStorage.getItem('balancer_active_ids') || '[]');
                        if (Array.isArray(savedIds) && savedIds.length > 0) {
                          setPlayers(prev => prev.map(p => ({ ...p, is_active: savedIds.includes(p.id) })));
                          toast.success('前回構成を復元しました');
                        } else {
                          toast.info('保存された前回のメンバー構成が見つかりません。');
                        }
                      } catch {
                        toast.error('復元に失敗しました。');
                      }
                    }
                  }}
                  aria-label="一括操作メニュー"
                  className="bg-surface-subtle hover:bg-surface-hover border border-border text-foreground-soft text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer transition shadow-2xs"
                >
                  <option value="" disabled>⚙️ メンバー一括操作 ▾</option>
                  <option value="all_on">✅ 全員参加ON</option>
                  <option value="all_off">❌ 全員解除</option>
                  <option value="restore">⏪ 前回構成を復元</option>
                </select>
              </div>

              {/* 卓分割の選択状態表示 */}
              {selectedTable && (
                <span className="text-xs font-black px-3 py-2 rounded-lg bg-primary-100 text-primary-700 border border-primary-edge-soft flex items-center gap-1.5">
                  {selectedTable.label}でチーム分け
                  <button onClick={() => setSelectedTable(null)} className="text-primary-700/70 hover:text-foreground">✕</button>
                </span>
              )}

              {/* 11人以上の時に出る人の選び方（2026-10-17） */}
              {activeCount > 10 && setSelectionMode && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-foreground-soft">
                  出る人:
                  <select
                    value={selectionMode}
                    onChange={(e) => setSelectionMode(e.target.value as 'fair' | 'low' | 'high')}
                    className="px-2 py-2 rounded-xl text-xs font-bold bg-surface border border-border text-foreground"
                    title="参加者が11人以上の時、この試合に出る10人をどう選ぶか"
                  >
                    <option value="fair">公平（休んだ回数順）</option>
                    <option value="low">低レート優先</option>
                    <option value="high">高レート優先</option>
                  </select>
                </label>
              )}

              {/* 🎪 日曜お祭りランダム（控えめなサブボタン化） */}
              <button
                type="button"
                onClick={handleFestivalRandomBalance}
                disabled={balancing || !canBalance}
                className="px-3 py-2 rounded-xl text-xs font-bold text-foreground-soft hover:text-foreground bg-surface-subtle hover:bg-surface-hover border border-border disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="MMRを無視して完全ランダムにチーム分け（日曜お祭り用）"
              >
                🎲 お祭り
              </button>

              {/* メインアクション：チーム分け実行 */}
              <button onClick={handleBalance} disabled={balancing || !canBalance}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black transition text-sm ${
                  balancing || !canBalance
                    ? 'bg-surface-subtle text-muted-strong border border-border cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-md shadow-primary-500/20 cursor-pointer'
                }`}>
                {balancing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                {balancing ? 'AIが編成中...' : 'チーム分け実行'}
              </button>
            </div>
          </div>

          {/* 前回結果の再表示ボタン */}
          {balanceResult && !showResultModal && (
            <button onClick={onOpenResultModal || (() => setShowResultModal(true))}
              className="flex items-center gap-2 bg-primary-100 hover:bg-primary-100 border border-primary-edge/50 text-primary-700 px-4 py-2 rounded-lg font-bold transition text-sm">
              <Globe className="h-4 w-4" /> 前回のチーム分け結果を再表示
            </button>
          )}
        </div>
  );
}
