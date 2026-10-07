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
export default function BalancerHeader({ players, setPlayers, saving, announcingStats, isAdmin, setShowAdminPanel, integrityData, balancing, balanceResult, showResultModal, setShowResultModal, searchDepth, setSearchDepth, selectedTable, setSelectedTable, bo3State, handleResetBo3, handleAnnounceStats, handleBalance, handleFestivalRandomBalance, activeCount, spectatorCount, inactiveCount, canBalance }: {
  players: any[];
  setPlayers: React.Dispatch<React.SetStateAction<any[]>>;
  saving: boolean;
  announcingStats: boolean;
  isAdmin: boolean;
  setShowAdminPanel: React.Dispatch<React.SetStateAction<boolean>>;
  integrityData: any;
  balancing: boolean;
  balanceResult: any;
  showResultModal: boolean;
  setShowResultModal: React.Dispatch<React.SetStateAction<boolean>>;
  searchDepth: number;
  setSearchDepth: React.Dispatch<React.SetStateAction<number>>;
  selectedTable: { label: string; ids: any[] } | null;
  setSelectedTable: React.Dispatch<React.SetStateAction<{ label: string; ids: any[] } | null>>;
  bo3State: any;
  handleResetBo3: () => any;
  handleAnnounceStats: () => any;
  handleBalance: () => any;
  handleFestivalRandomBalance: () => any;
  activeCount: number;
  spectatorCount: number;
  inactiveCount: number;
  canBalance: boolean;
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
              {/* 2026-09-23: 飛び先を /ktm-admin?tab=history（管理者専用）から一般公開の /history へ変更。
                  リンク自体は isAdmin の外にあり全員に見えていたため、一般メンバーが押すと
                  管理者パスコードを求められて行き止まりになっていた。 */}
              <Link href="/history" className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-primary-700 px-3 py-1.5 rounded-lg font-bold transition text-xs border border-primary-edge-soft whitespace-nowrap shrink-0">
                <History className="h-3.5 w-3.5" /> 過去の試合
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(v => !v)}
                  title="管理者専用操作"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs border whitespace-nowrap shrink-0 ${
                    integrityData?.hasDiscrepancy
                      ? 'bg-danger-100 hover:bg-danger-100 border-danger-edge-soft text-danger-700'
                      : 'bg-primary-100 hover:bg-primary-100 border-primary-edge-soft text-primary-700'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" /> 管理者パネル
                  {integrityData?.hasDiscrepancy && (
                    <span className="bg-danger-500 text-white rounded-full px-1.5 text-[10px] font-black">{integrityData.discrepancyCount}</span>
                  )}
                </button>
              )}
              <Link href="/ktm-admin" prefetch={false} className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover border border-border text-foreground-subtle px-3 py-1.5 rounded-lg font-bold transition text-xs whitespace-nowrap shrink-0">
                <Shield className="h-3.5 w-3.5" /> {isAdmin ? '詳細管理へ' : '管理者 🔑'}
              </Link>
              <button
                onClick={handleAnnounceStats}
                disabled={announcingStats}
                className="flex items-center gap-1.5 bg-primary-100 hover:bg-primary-100 border border-primary-edge-soft text-primary-700 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {announcingStats ? '通知中...' : '募集状況を通知 📢'}
              </button>
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
                    🔵 {bo3State.team1IsCurrentlyBlue ? bo3State.team1Name : bo3State.team2Name}: {bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins}勝
                  </span>
                  <span className="text-xs font-black text-muted-strong">VS</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-danger-100 text-danger-900 border border-danger-edge">
                    🔴 {!bo3State.team1IsCurrentlyBlue ? bo3State.team1Name : bo3State.team2Name}: {!bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins}勝
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
                    onClick={() => setShowResultModal(true)}
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

            {/* 📢 KTMカスタム新方針・ルール案内チップ */}
            <div className="w-full flex flex-wrap items-center gap-2 text-xs bg-primary-50/80 border border-primary-edge-soft/80 rounded-xl p-2.5 text-primary-950">
              <span className="font-black flex items-center gap-1 text-primary-900">
                <Info className="h-3.5 w-3.5 text-primary-700" />
                カスタム方針:
              </span>
              <span className="bg-surface border border-primary-edge/60 px-2 py-0.5 rounded-md font-bold text-[11px] text-secondary-900">
                🛡️ シルバー以下: <strong>ブラインドピック (MMRあり)</strong>
              </span>
              <span className="bg-surface border border-primary-edge/60 px-2 py-0.5 rounded-md font-bold text-[11px] text-primary-900">
                👑 ゴルプラ: <strong>ドラフトピック (MMRあり)</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">

              {/* 一括参加切り替えボタン */}
              <button
                type="button"
                onClick={() => {
                  const updated = players.map(p => p.is_spectator_fixed ? p : { ...p, is_active: true });
                  setPlayers(updated);
                  try { localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id))); } catch {}
                }}
                className="px-3 py-2 rounded-xl bg-success-100 hover:bg-success-200 border border-success-edge-soft text-success-800 font-bold text-xs transition"
                title="観戦固定メンバーを除く全員の参加チェックをONにします"
              >
                ✅ 全員参加ON
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = players.map(p => p.is_spectator_fixed ? p : { ...p, is_active: false });
                  setPlayers(updated);
                  try { localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id))); } catch {}
                }}
                className="px-3 py-2 rounded-xl bg-surface-hover hover:bg-stone-300 border border-border text-foreground-subtle font-bold text-xs transition"
                title="観戦固定メンバーを除く全員の参加チェックをクリアします"
              >
                ❌ 全員解除
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const savedIds = JSON.parse(localStorage.getItem('balancer_active_ids') || '[]');
                    if (Array.isArray(savedIds) && savedIds.length > 0) {
                      setPlayers(prev => prev.map(p => ({ ...p, is_active: savedIds.includes(p.id) })));
                    } else {
                      toast.info('保存された前回のメンバー構成が見つかりません。');
                    }
                  } catch {
                    toast.error('復元に失敗しました。');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-primary-100 hover:bg-primary-200 border border-primary-edge text-primary-900 font-bold text-xs transition"
                title="前回のチーム分け時に参加していたメンバー構成を一元復元します"
              >
                ⏪ 前回構成を復元
              </button>

              {/* 卓分割の選択状態表示 */}
              {selectedTable && (
                <span className="text-xs font-black px-3 py-2 rounded-lg bg-primary-100 text-primary-700 border border-primary-edge-soft flex items-center gap-1.5">
                  {selectedTable.label}でチーム分け
                  <button onClick={() => setSelectedTable(null)} className="text-primary-700/70 hover:text-foreground">✕</button>
                </span>
              )}
              {/* BL-02: 探索強度 */}
              <select value={searchDepth} onChange={e => setSearchDepth(Number(e.target.value))}
                title="精密ほど良い組み合わせを探すが計算が遅くなる"
                className="bg-surface border border-border text-foreground-subtle text-xs font-bold rounded-lg px-2 py-2 outline-none">
                <option value={40}>⚡ 速い</option>
                <option value={100}>⚖️ 標準</option>
                <option value={200}>🔬 精密</option>
              </select>
              {/* 🎪 日曜お祭りランダムシャッフル */}
              <button
                type="button"
                onClick={handleFestivalRandomBalance}
                disabled={balancing || !canBalance}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-black transition text-xs md:text-sm border ${
                  balancing || !canBalance
                    ? 'bg-surface-subtle text-faint border-border cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-600 to-danger-600 hover:from-primary-500 hover:to-danger-500 text-white border-primary-edge shadow-md shadow-primary-500/20 cursor-pointer'
                }`}
                title="MMRやレーン希望に関係なく、10名を完全ランダムにBlue/Redへ振り分けます（公式MMR変動なし）"
              >
                <span>🎲 お祭りランダム</span>
              </button>

              <button onClick={handleBalance} disabled={balancing || !canBalance}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 md:px-8 md:py-3 rounded-xl font-black transition text-sm md:text-base ${
                  balancing || !canBalance ? 'bg-surface-subtle text-muted-strong cursor-not-allowed' : 'bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-500 hover:to-primary-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]'
                }`}>
                {balancing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
                {balancing ? 'AIが編成中...' : 'チーム分け実行'}
              </button>
            </div>
          </div>

          {/* 🛒 発動中の特権・ハンデ確認メモ */}
          <details className="mt-3 bg-primary-500/10 border border-primary-edge-strong/20 rounded-2xl p-3 text-xs">
            <summary className="font-bold text-primary-900 cursor-pointer select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>🛒 発動中の特権・ハンデを確認する</span>
                <span className="text-[10px] bg-primary-200 text-primary-900 px-2 py-0.5 rounded-full font-bold">KTMショップ連動</span>
              </span>
              <span className="text-[10px] text-primary-700">▼</span>
            </summary>
            <div className="mt-2.5 pt-2.5 border-t border-primary-edge-strong/20 space-y-2 text-foreground-subtle">
              <p className="text-[11px] text-muted">
                参加者がKTMショップで購入した特権（下剋上キャラ指定、特定レーンBAN、お祭りマッチ等）がある場合は、ここで確認しながらドラフトや試合記録を行えます。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-surface border border-primary-edge-soft">
                  <span className="font-bold text-primary-900">👑 下剋上キャラ指定:</span>
                  <span className="ml-1 text-muted">対象の高レートに苦手チャンプを指定 (実効MMR -400)</span>
                </div>
                <div className="p-2 rounded-xl bg-surface border border-primary-edge-soft">
                  <span className="font-bold text-primary-900">🎪 お祭りカスタム:</span>
                  <span className="ml-1 text-muted">結果記録時に「戦績ノーカウント保護」をONにする</span>
                </div>
              </div>
            </div>
          </details>
          {/* 前回結果の再表示ボタン */}
          {balanceResult && !showResultModal && (
            <button onClick={() => setShowResultModal(true)}
              className="flex items-center gap-2 bg-primary-100 hover:bg-primary-100 border border-primary-edge/50 text-primary-700 px-4 py-2 rounded-lg font-bold transition text-sm">
              <Globe className="h-4 w-4" /> 前回のチーム分け結果を再表示
            </button>
          )}
        </div>
  );
}
