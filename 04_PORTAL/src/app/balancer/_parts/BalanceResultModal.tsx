"use client";

import React, { Fragment, useState, useEffect } from "react";
import { toast } from '../../../components/Toaster';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Settings, Sparkles, Coins, Copy, Check, Shuffle, Flame } from "lucide-react";
import { getColorFromRankName, calculateBlueWinProbability, getKtmRank, getRankBadgeStyle, getHighestLaneMmr } from "../../../lib/mmr";
import { getPlayerTier } from "../../../lib/playerTier";
import { BalancerVcManager, updateVcStatus } from "../components/BalancerVcManager";
import { BalancerBo3Manager } from "../components/BalancerBo3Manager";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { Spinner } from "../../../components/Feedback";
import { RoleIcon, getPlayerCasinoBadges, MAX_VISIBLE_BADGES, CasinoBadges, getGroup } from "./helpers";

// ★ チーム分け結果モーダル
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function BalanceResultModal({ players, savingPending, copiedResult, setMessage, balanceResult, setBalanceResult, proposals, selectedProposalIdx, setSelectedProposalIdx, analysis, swapSource, sendingDiscord, setShowResultModal, selectedTable, sendingProposals, dragOverSlot, bo3State, handleStartBo3, handleRecordBo3Win, handleNextBo3Game, handleResetBo3, handleRecordNavigate, handleSendProposals, handleSendDiscord, handleCopyResultText, handleDragStart, handleDragOver, handleDragLeave, handleDropPlayer, handleSelectSwapPlayer, renderSwapSelect, handicapNames }: {
  players: any[];
  savingPending: boolean;
  copiedResult: boolean;
  setMessage: React.Dispatch<React.SetStateAction<any>>;
  balanceResult: any;
  setBalanceResult: React.Dispatch<React.SetStateAction<any>>;
  proposals: any[];
  selectedProposalIdx: number;
  setSelectedProposalIdx: React.Dispatch<React.SetStateAction<number>>;
  analysis: any;
  swapSource: { team: string; role: string; name: string } | null;
  sendingDiscord: boolean;
  setShowResultModal: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTable: { label: string; ids: any[] } | null;
  sendingProposals: boolean;
  dragOverSlot: string | null;
  bo3State: any;
  handleStartBo3: () => any;
  handleRecordBo3Win: (side: 'BLUE' | 'RED') => any;
  handleNextBo3Game: () => any;
  handleResetBo3: () => any;
  handleRecordNavigate: () => any;
  handleSendProposals: () => any;
  handleSendDiscord: () => any;
  handleCopyResultText: () => any;
  handleDragStart: (e: React.DragEvent, team: string, role: string, name: string) => any;
  handleDragOver: (e: React.DragEvent, slotKey: string) => any;
  handleDragLeave: () => any;
  handleDropPlayer: (e: React.DragEvent, targetTeam: 'teamBlue' | 'teamRed' | 'spectators', targetRole: string) => any;
  handleSelectSwapPlayer: (team: string, role: string, name: string) => any;
  renderSwapSelect: (team: 'teamBlue' | 'teamRed' | 'spectators', role: string, currentPlayerName: string) => any;
  handicapNames: Set<any>;
}) {
  const [clashData, setClashData] = useState<any>(null);
  const [loadingClash, setLoadingClash] = useState(false);

  useEffect(() => {
    if (!balanceResult?.teamBlue?.length || !balanceResult?.teamRed?.length) return;
    setLoadingClash(true);
    fetch('/api/balancer/clash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamBlue: balanceResult.teamBlue,
        teamRed: balanceResult.teamRed,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setClashData(data);
        }
      })
      .catch(err => console.error('[NemesisClash] fetch error:', err))
      .finally(() => setLoadingClash(false));
  }, [balanceResult]);

  return (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-2 md:p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setShowResultModal(false); }}
        >
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl shadow-2xl my-4">
            {/* モーダルヘッダー */}
            <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary-700" />
                  マッチング結果
                  <span className="hidden md:inline text-xs font-mono text-muted-strong ml-2">MMR差: <span className="text-foreground font-bold">{balanceResult.mmrDiff}</span></span>
                </h2>
                {/* ピック形式バッジ */}
                {(() => {
                  if (balanceResult.isFestivalMode) {
                    return (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-primary-100 text-primary-900 border border-primary-edge flex items-center gap-1 shadow-xs">
                        🎪 ピック形式: <strong>日曜お祭り (完全ランダム / MMRなし)</strong>
                      </span>
                    );
                  }
                  const avgMMR = ((balanceResult.teamBlueMMR || 0) + (balanceResult.teamRedMMR || 0)) / 10;
                  const isSilverTier = avgMMR < 1350 || selectedTable?.label?.includes('シルバー');
                  return isSilverTier ? (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900 border border-secondary-edge flex items-center gap-1 shadow-xs">
                      🔲 ピック形式: <strong>ブラインドピック (MMRあり)</strong>
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-primary-100 text-primary-900 border border-primary-edge flex items-center gap-1 shadow-xs">
                      ⚔️ ピック形式: <strong>ドラフトピック (MMRあり)</strong>
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                {proposals.length > 1 && (
                  <button onClick={handleSendProposals} disabled={sendingProposals}
                    className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-xl font-bold transition text-xs shadow-xs cursor-pointer"
                    title="全候補をDiscordに投稿してリアクション投票してもらう">
                    {sendingProposals ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <>🗳️</>}
                    <span className="hidden sm:inline">{proposals.length}案をDiscord投票</span>
                  </button>
                )}
                <button onClick={() => setShowResultModal(false)}
                  className="p-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-faint hover:text-foreground transition cursor-pointer" title="閉じる (ESC)">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 🏁 進行ナビゲーションバー（1➔2➔3で迷わないガイド） */}
            <div className="bg-surface-subtle/80 border-b border-border px-4 md:px-6 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                    🏁 カスタム進行の流れ:
                  </span>
                  <span className="text-[11px] text-muted hidden md:inline">
                    ①結果共有 ➔ ②VC設定 ➔ ③試合後に勝敗記録
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Step 1: Discord通知 */}
                  <button
                    onClick={handleSendDiscord}
                    disabled={sendingDiscord}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded-xl font-bold transition text-xs shadow-xs cursor-pointer"
                    title="チーム分け結果をDiscordの#定期カスタムへ送信してメンバーに周知します"
                  >
                    {sendingDiscord ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    <span>① Discordに結果送信</span>
                  </button>

                  {/* Step 2: VC更新 */}
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await updateVcStatus('game1');
                      if (res.success) {
                        setMessage({ type: 'success', text: `🔊 ${res.message}` });
                        toast.info(`🔊 ${res.message}`);
                      } else {
                        toast.error(`VC更新エラー: ${res.error}`);
                      }
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-xl font-bold transition text-xs shadow-xs cursor-pointer"
                    title="DiscordのVCチャンネル名を「1戦目進行中」に更新します"
                  >
                    <span>🔊 ② VC更新 (1戦目)</span>
                  </button>

                  {/* Step 3: 結果記録への誘導 */}
                  <button
                    onClick={handleRecordNavigate}
                    disabled={savingPending}
                    type="button"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-success-600 hover:bg-success-500 disabled:bg-success-800 text-white px-3.5 py-1.5 rounded-xl font-black transition text-xs shadow-xs cursor-pointer"
                    title="試合終了後、勝敗やスコアを記録してMMRを更新する画面へ進みます"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>③ 試合後に結果記録</span>
                  </button>

                  {/* コピーボタン */}
                  <button
                    type="button"
                    onClick={handleCopyResultText}
                    className="p-1.5 bg-surface hover:bg-surface-hover border border-border text-foreground-soft rounded-xl font-bold transition text-xs cursor-pointer shrink-0"
                    title="結果テキストをクリップボードにコピー"
                  >
                    {copiedResult ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5 text-muted" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {/* ⚠️ 未許可の格上対面警告（管理者確認バナー） */}
              {balanceResult.unallowedHigherMatchups && balanceResult.unallowedHigherMatchups.length > 0 && (
                <div className="p-3.5 rounded-xl border border-danger-500 bg-danger-50 text-danger-900 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-danger-800">
                    <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0 animate-pulse" />
                    <span>⚠️ 【管理者確認】格上対面が許可されていないプレイヤーが含まれています</span>
                  </div>
                  <p className="text-xs text-danger-800/90 leading-relaxed">
                    以下の対面はMMR差が200以上（シルバーvsプラチナ等）ありますが、下位側プレイヤーの「格上許可」チェックが入っていません。10人構成の都合上やむを得ずマッチングされた可能性があります。
                  </p>
                  <div className="space-y-1 bg-white/80 p-2.5 rounded-lg border border-danger-200 text-xs">
                    {balanceResult.unallowedHigherMatchups.map((m: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-bold text-danger-700">[{m.role}]</span>
                        <span>
                          <strong className="text-danger-900">{m.weakerName}</strong> ({m.weakerMmr})
                          <span className="text-faint mx-1 font-mono">VS</span>
                          <strong className="text-foreground">{m.strongerName}</strong> ({m.strongerMmr})
                        </span>
                        <span className="font-mono font-bold text-danger-600 bg-danger-100 px-1.5 py-0.5 rounded text-[11px]">
                          MMR差: +{m.diff}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-danger-700 flex items-center justify-between pt-1">
                    <span>※ このまま対戦を実施するか、下部のレーン入れ替え（⇄）やハンデ設定で調整してください。</span>
                  </div>
                </div>
              )}

              {/* 環境分析 */}
              {analysis && (
                <div className={`p-3 rounded-xl border text-sm flex flex-col gap-2 ${analysis.level === 'HIGH_DIFFERENCE' ? 'bg-primary-100 border-primary-edge-soft text-primary-700' : analysis.level === 'CLOSE' ? 'bg-success-100 border-success-edge-soft text-success-700' : 'bg-primary-100 border-primary-edge-soft text-primary-700'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {analysis.level === 'HIGH_DIFFERENCE' ? <AlertTriangle className="h-4 w-4 text-primary-700 shrink-0" /> : <Globe className="h-4 w-4 text-success-700 shrink-0" />}
                    <span>本日のカスタム環境:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-black ${analysis.level === 'HIGH_DIFFERENCE' ? 'bg-primary-800 text-primary-100' : analysis.level === 'CLOSE' ? 'bg-success-800 text-success-100' : 'bg-primary-800 text-primary-100'}`}>
                      {analysis.level === 'HIGH_DIFFERENCE' ? '格差大' : analysis.level === 'CLOSE' ? '実力拮抗' : '標準的'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{analysis.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
                    <span>KTM平均MMR: <strong className="text-foreground font-mono">{analysis.averageMMR}</strong></span>
                    <span>最低: <strong className="text-foreground font-mono">{analysis.minMMR}</strong></span>
                    <span>最高: <strong className="text-foreground font-mono">{analysis.maxMMR}</strong></span>
                    <span>差: <strong className={`font-mono ${analysis.level === 'HIGH_DIFFERENCE' ? 'text-primary-700' : 'text-foreground'}`}>{analysis.mmrRange}</strong></span>
                    <span className="text-[10px] text-muted-strong font-normal">※SoloQではなくKTMカスタム独自のランクMMR基準です</span>
                  </div>
                </div>
              )}

              {/* 勝利予想（#79）: リッチなグラデーション予測ゲージメーター */}
              {(() => {
                const blueAvg = balanceResult.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamBlue.length || 1);
                const redAvg = balanceResult.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamRed.length || 1);
                const pBlue = calculateBlueWinProbability(blueAvg, redAvg);
                const bluePct = Math.round(pBlue * 100);
                const redPct = 100 - bluePct;
                const mmrDiff = Math.abs(balanceResult.teamBlueMMR - balanceResult.teamRedMMR);
                const isCloseMatch = mmrDiff <= 50;

                return (
                  <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs">
                    <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-foreground">🔮 Elo勝率予測 ＆ 接戦度診断</span>
                        {isCloseMatch ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-success-100 text-success-800 border border-success-edge">
                            🔥 超接戦（名勝負の予感！）
                          </span>
                        ) : mmrDiff <= 120 ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 border border-primary-edge">
                            ⚔️ 互角（実力拮抗）
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-surface-subtle text-foreground-subtle border border-border">
                            ⚖️ やや戦力差あり (差: {mmrDiff} MMR)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-strong font-bold">50%に近いほど理想的なバランス</span>
                    </div>

                    {/* ゲージバー */}
                    <div className="flex items-center gap-3">
                      <div className="text-right w-24 shrink-0">
                        <span className="text-xs font-extrabold text-secondary-700 block">🟦 BLUE TEAM</span>
                        <strong className="text-base font-black text-secondary-900 font-mono">{bluePct}%</strong>
                      </div>
                      <div className="flex-1 h-4 rounded-full overflow-hidden bg-surface-subtle p-0.5 border border-border flex shadow-inner">
                        <div
                          className="bg-gradient-to-r from-secondary-600 to-secondary-500 rounded-l-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
                          style={{ width: `${bluePct}%` }}
                        >
                          {bluePct >= 20 ? `${bluePct}%` : ''}
                        </div>
                        <div
                          className="bg-gradient-to-l from-danger-600 to-danger-500 rounded-r-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
                          style={{ width: `${redPct}%` }}
                        >
                          {redPct >= 20 ? `${redPct}%` : ''}
                        </div>
                      </div>
                      <div className="text-left w-24 shrink-0">
                        <span className="text-xs font-extrabold text-danger-700 block">🟥 RED TEAM</span>
                        <strong className="text-base font-black text-danger-900 font-mono">{redPct}%</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ⚔️ 因縁マッチアップ ＆ 黄金デュオ速報（Nemesis Clash） */}
              {(loadingClash || clashData?.featuredClash || (clashData?.goldenDuos && clashData.goldenDuos.length > 0)) && (
                <div className="p-4 rounded-2xl border border-primary-edge-soft/70 bg-gradient-to-br from-primary-50/50 via-surface to-surface shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚔️</span>
                      <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
                        本日の因縁・ライバル対決速報
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 border border-primary-edge">
                          Nemesis Clash
                        </span>
                      </h3>
                    </div>
                    {loadingClash && (
                      <span className="text-[10px] text-muted-strong flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin text-primary-600" />
                        対戦履歴を照合中…
                      </span>
                    )}
                  </div>

                  {/* ハイライト因縁カード */}
                  {clashData?.featuredClash && (
                    <div className="p-3 rounded-xl bg-surface border border-border shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            clashData.featuredClash.type === 'NEMESIS'
                              ? 'bg-danger-100 text-danger-900 border border-danger-edge'
                              : 'bg-primary-100 text-primary-900 border border-primary-edge'
                          }`}>
                            {clashData.featuredClash.type === 'NEMESIS' ? '💥 最大の因縁' : '🔥 好敵手'}
                          </span>
                          <strong className="text-xs font-black text-foreground">
                            {clashData.featuredClash.headline}
                          </strong>
                        </div>
                        <p className="text-[11px] text-foreground-soft leading-relaxed">
                          {clashData.featuredClash.subtext}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center font-mono">
                        <span className="text-xs font-bold text-secondary-700 bg-secondary-100 px-2 py-1 rounded-lg border border-secondary-edge">
                          {clashData.featuredClash.bluePlayer} ({clashData.featuredClash.blueWins}勝)
                        </span>
                        <span className="text-[10px] font-black text-muted-strong">vs</span>
                        <span className="text-xs font-bold text-danger-700 bg-danger-100 px-2 py-1 rounded-lg border border-danger-edge">
                          {clashData.featuredClash.redPlayer} ({clashData.featuredClash.redWins}勝)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 黄金デュオ一覧 */}
                  {clashData?.goldenDuos && clashData.goldenDuos.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {clashData.goldenDuos.map((duo: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            duo.teamSide === 'BLUE'
                              ? 'bg-secondary-50/70 border-secondary-edge-soft text-secondary-900'
                              : 'bg-danger-50/70 border-danger-edge-soft text-danger-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🤝</span>
                            <div>
                              <span className="font-black block text-xs">
                                {duo.player1} ＆ {duo.player2}
                              </span>
                              <span className="text-[10px] opacity-80 font-medium">
                                {duo.label}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                            duo.teamSide === 'BLUE' ? 'bg-secondary-100 text-secondary-800' : 'bg-danger-100 text-danger-800'
                          }`}>
                            {duo.teamSide} TEAM
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 案タブ */}
              {proposals.length > 1 && (
                <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
                  {proposals.map((prop, idx) => (
                    <button key={prop.id || idx} onClick={() => { setBalanceResult(prop); setSelectedProposalIdx(idx); }}
                      className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap ${selectedProposalIdx === idx ? 'border-primary-edge-strong text-primary-700 font-black' : 'border-transparent text-muted-strong hover:text-foreground-subtle'}`}>
                      {prop.title || `案${prop.id || idx}`}
                      {prop.id === 'E' && <span className="ml-1 text-[10px] bg-primary-200 text-primary-900 px-1.5 py-0.2 rounded-full">🎗️ルール設定</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* 🎗️ 案E選択時: 実践的レーン戦ハンデ縛り ＆ 再微調整パネル */}
              {balanceResult.id === 'E' && (
                <div className="p-4 rounded-2xl bg-primary-50 border-2 border-primary-edge shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎗️</span>
                      <div>
                        <h3 className="text-xs font-black text-primary-950">案E：実践的レーン戦ハンデ縛り設定 ＆ 再微調整</h3>
                        <p className="text-[11px] text-primary-800">不利対面（2ランク格差等）の格上プレイヤーに縛りルールを設定し、戦力を完全に均等化します。</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
                    {/* Lv.1 */}
                    <div className="p-3 rounded-xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-primary-900 text-xs">Lv.1 軽度ハンデ</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-100 text-primary-800">実効MMR -150</span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        ▫ <strong>フラッシュ禁止</strong>（ゴースト/TP強制）<br />
                        ▫ <strong>序盤5分間リコール禁止</strong>
                      </p>
                      <div className="text-[10px] text-primary-700 font-bold">消費: 300 コイン</div>
                    </div>

                    {/* Lv.2 */}
                    <div className="p-3 rounded-xl bg-surface border-2 border-primary-edge space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-primary-950 text-xs">Lv.2 中度ハンデ</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-primary-500 text-white">実効MMR -300 (1ランク差)</span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        ▫ <strong>ポーション購入禁止</strong>（回復封じ）<br />
                        ▫ <strong>メインチャンプBAN＆セカンド強制</strong>
                      </p>
                      <div className="text-[10px] text-primary-700 font-bold">消費: 600 コイン</div>
                    </div>

                    {/* Lv.3 */}
                    <div className="p-3 rounded-xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-primary-900 text-xs">Lv.3 重度ハンデ</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-danger-100 text-danger-800">実効MMR -500 (完全互角)</span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        ▫ <strong>初手『女神の涙』スタート縛り</strong><br />
                        ▫ <strong>スキル1つ（Ult除く）使用禁止</strong>
                      </p>
                      <div className="text-[10px] text-primary-700 font-bold">消費: 1,200 コイン</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-primary-edge-soft/60">
                    <span className="text-[11px] text-primary-900 font-bold">
                      ※この設定で推定MMRが再計算され、対面格差がピタッと埋まります。
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // 案Eの再微調整を実行: 格上プレイヤーの実効MMRを補正して再描画
                        const updatedBlue = balanceResult.teamBlue.map((p: any) => {
                          const penalty = handicapNames.has(p.name) ? 300 : 0;
                          return { ...p, mmr: Math.max(100, p.mmr - penalty) };
                        });
                        const updatedRed = balanceResult.teamRed.map((p: any) => {
                          const penalty = handicapNames.has(p.name) ? 300 : 0;
                          return { ...p, mmr: Math.max(100, p.mmr - penalty) };
                        });
                        const newBlueMMR = updatedBlue.reduce((s: number, p: any) => s + p.mmr, 0);
                        const newRedMMR = updatedRed.reduce((s: number, p: any) => s + p.mmr, 0);
                        const updatedRes = {
                          ...balanceResult,
                          teamBlue: updatedBlue,
                          teamRed: updatedRed,
                          teamBlueMMR: newBlueMMR,
                          teamRedMMR: newRedMMR,
                          mmrDiff: Math.abs(newBlueMMR - newRedMMR),
                        };
                        setBalanceResult(updatedRes);
                        toast.success("⚡ 【案E微調整完了】 ハンデ補正（実効MMR -300）を適用し、対面格差と勝率予想を再計算しました！");
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-black text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      推定MMRを反映してチーム分けを微調整する
                    </button>
                  </div>
                </div>
              )}

              {/* チーム表示 */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center border-b border-border pb-3">
                  <div className="col-span-5 bg-gradient-to-r from-secondary-100 to-transparent p-3 rounded-xl border-l-4 border-secondary-edge-strong flex justify-between items-center">
                    <span className="text-base font-black text-secondary-700">BLUE TEAM</span>
                    <span className="text-xs font-mono font-bold text-secondary-600">合計MMR: {balanceResult.teamBlueMMR}</span>
                  </div>
                  <div className="col-span-1 flex justify-center text-muted-strong font-black">VS</div>
                  <div className="col-span-5 bg-gradient-to-l from-danger-100 to-transparent p-3 rounded-xl border-r-4 border-danger-edge-strong flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-danger-600">合計MMR: {balanceResult.teamRedMMR}</span>
                    <span className="text-base font-black text-danger-700">RED TEAM</span>
                  </div>
                </div>
                {['TOP','JG','MID','ADC','SUP'].map(role => {
                  const pB = balanceResult.teamBlue.find((x: any) => x.currentRole === role);
                  const pR = balanceResult.teamRed.find((x: any) => x.currentRole === role);
                  const pBData = players.find((p: any) => p.name === pB?.name);
                  const pRData = players.find((p: any) => p.name === pR?.name);
                  const offB = pB && pB.mainLane !== 'ALL' && pB.mainLane !== '-' && pB.currentRole !== pB.mainLane;
                  const offR = pR && pR.mainLane !== 'ALL' && pR.mainLane !== '-' && pR.currentRole !== pR.mainLane;
                  const bKey = `teamBlue-${role}`, rKey = `teamRed-${role}`;
                  const bMMR = pB?.mmr || 1200, rMMR = pR?.mmr || 1200, diff = bMMR - rMMR;
                  return (
                    <div key={role} className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center bg-black/[0.03] p-2 md:p-3 rounded-2xl border border-black/5">
                      <div draggable={!!pB?.name} onDragStart={e => handleDragStart(e,'teamBlue',role,pB?.name||'')} onDragOver={e => handleDragOver(e,bKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'teamBlue',role)}
                        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOverSlot===bKey?'border-secondary-edge-strong bg-secondary-100 border-dashed':'bg-secondary-50 border-secondary-edge-soft hover:bg-secondary-100'} ${swapSource?.name === pB?.name ? 'border-primary-edge-strong bg-primary-100 animate-pulse' : ''}`}>
                        {/* 名前は行の主役なので、バッジがいくつ増えても潰れないよう最低幅を確保する */}
                        <div className="flex-1 min-w-[5.5rem]">{renderSwapSelect('teamBlue',role,pB?.name||'')}</div>
                        {pB?.name && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('teamBlue', role, pB.name); }}
                            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === pB.name ? 'bg-primary-500 text-black' : 'text-secondary-700 hover:text-foreground hover:bg-secondary-200'}`}
                            title="タップして入れ替え"
                          >
                            ⇄
                          </button>
                        )}
                        {offB && <span className="text-[9px] bg-danger-100 border border-danger-edge text-danger-700 px-1.5 py-0.5 rounded font-black shrink-0">⚠️OFF</span>}
                        {pB?.name && handicapNames.has(pB.name) && <span className="text-[9px] bg-primary-100 border border-primary-edge text-primary-700 px-1.5 py-0.5 rounded font-black shrink-0" title="ハンデ参加（オフロール等の制約付き）">🎗️ハンデ</span>}
                        <CasinoBadges player={pBData} />
                        {pB?.name && (pB.mainLane !== 'ALL' || pB.subLane !== 'ALL') && (
                          <span className="text-[9px] bg-black/5 border border-black/10 text-muted-strong px-1.5 py-0.5 rounded font-bold shrink-0" title="第一希望／第二希望レーン">
                            {pB.mainLane !== 'ALL' && pB.mainLane !== '-' ? pB.mainLane : '指定無'}
                            {pB.subLane !== 'ALL' && pB.subLane !== '-' ? `/${pB.subLane}` : ''}
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-secondary-700 shrink-0 bg-secondary-100 px-2 py-0.5 rounded border border-secondary-edge">{bMMR}</span>
                      </div>
                      <div className="col-span-1 flex flex-col items-center py-1">
                        <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center shadow-lg"><RoleIcon role={role} className="w-4 h-4" /></div>
                        <span className={`text-[10px] font-mono mt-0.5 font-extrabold ${diff>0?'text-secondary-700':diff<0?'text-danger-700':'text-muted-strong'}`}>{diff>0?`+${diff}`:diff<0?diff:'±0'}</span>
                        {(() => {
                          const clash = clashData?.laneClashes?.find((c: any) => c.role === role);
                          if (!clash || clash.games === 0) return null;
                          return (
                            <span
                              className="text-[8px] font-mono font-bold text-muted-strong bg-surface border border-border px-1 py-0.2 rounded mt-0.5 shadow-2xs whitespace-nowrap cursor-help"
                              title={`過去の直接対決: ${clash.bluePlayer} ${clash.blueWins}勝 - ${clash.redWins}勝 ${clash.redPlayer} (${clash.headline})`}
                            >
                              {clash.blueWins}勝-{clash.redWins}勝
                            </span>
                          );
                        })()}
                      </div>
                      <div draggable={!!pR?.name} onDragStart={e => handleDragStart(e,'teamRed',role,pR?.name||'')} onDragOver={e => handleDragOver(e,rKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'teamRed',role)}
                        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOverSlot===rKey?'border-danger-edge-strong bg-danger-100 border-dashed':'bg-danger-50 border-danger-edge-soft hover:bg-danger-100'} ${swapSource?.name === pR?.name ? 'border-primary-edge-strong bg-primary-100 animate-pulse' : ''}`}>
                        <span className="font-mono text-xs font-bold text-danger-700 shrink-0 bg-danger-100 px-2 py-0.5 rounded border border-danger-edge">{rMMR}</span>
                        {offR && <span className="text-[9px] bg-danger-100 border border-danger-edge text-danger-700 px-1.5 py-0.5 rounded font-black shrink-0">⚠️OFF</span>}
                        {pR?.name && handicapNames.has(pR.name) && <span className="text-[9px] bg-primary-100 border border-primary-edge text-primary-700 px-1.5 py-0.5 rounded font-black shrink-0" title="ハンデ参加（オフロール等の制約付き）">🎗️ハンデ</span>}
                        <CasinoBadges player={pRData} />
                        {pR?.name && (pR.mainLane !== 'ALL' || pR.subLane !== 'ALL') && (
                          <span className="text-[9px] bg-black/5 border border-black/10 text-muted-strong px-1.5 py-0.5 rounded font-bold shrink-0" title="第一希望／第二希望レーン">
                            {pR.mainLane !== 'ALL' && pR.mainLane !== '-' ? pR.mainLane : '指定無'}
                            {pR.subLane !== 'ALL' && pR.subLane !== '-' ? `/${pR.subLane}` : ''}
                          </span>
                        )}
                        {pR?.name && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('teamRed', role, pR.name); }}
                            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === pR.name ? 'bg-primary-500 text-black' : 'text-danger-700 hover:text-foreground hover:bg-danger-200'}`}
                            title="タップして入れ替え"
                          >
                            ⇄
                          </button>
                        )}
                        {/* 名前は行の主役なので、バッジがいくつ増えても潰れないよう最低幅を確保する */}
                        <div className="flex-1 min-w-[5.5rem]">{renderSwapSelect('teamRed',role,pR?.name||'')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AIレポート */}
              {balanceResult.balanceReport && (
                <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-50/60 border border-primary-edge/80 rounded-2xl shadow-2xs space-y-2">
                  <h3 className="text-sm font-extrabold text-primary-950 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary-600" />
                    <span>AIバランス分析 ＆ 勝敗予想レポート</span>
                  </h3>
                  <div className="text-xs text-foreground-soft leading-relaxed font-sans space-y-1.5 bg-surface/80 p-3.5 rounded-xl border border-primary-edge-soft/60">
                    {(Array.isArray(balanceResult.balanceReport)
                      ? balanceResult.balanceReport
                      : [balanceResult.balanceReport]
                    ).map((line: string, i: number) => {
                      if (!line) return <div key={i} className="h-1" />;
                      // **太字** や `コード` の簡易リッチテキスト変換
                      const formatted = line
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-primary-950">$1</strong>')
                        .replace(/`(.*?)`/g, '<code class="bg-primary-100 text-primary-900 font-mono px-1 py-0.5 rounded text-[11px] font-bold border border-primary-edge-soft">$1</code>');
                      return (
                        <div
                          key={i}
                          dangerouslySetInnerHTML={{ __html: formatted }}
                          className="leading-relaxed"
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 観戦 */}
              {balanceResult.spectators && balanceResult.spectators.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <h3 className="text-xs font-bold text-muted-strong mb-2 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> 観戦 / 待機メンバー</h3>
                  <div className="flex flex-wrap gap-2">
                    {balanceResult.spectators.map((name: string, index: number) => {
                      const slotKey = `spectators-${index}`;
                      const specP = players.find((p: any) => p.name === name);
                      const specMmr = specP?.mmr || 1200;
                      return (
                        <div key={`spec-${index}`} draggable onDragStart={e => handleDragStart(e,'spectators',index.toString(),name)} onDragOver={e => handleDragOver(e,slotKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'spectators',index.toString())}
                          className={`border rounded px-2.5 py-1.5 min-w-[140px] flex items-center justify-between gap-1.5 transition cursor-grab ${dragOverSlot===slotKey?'border-primary-edge bg-primary-100 border-dashed':'bg-surface-subtle border-border hover:bg-surface-subtle'} ${swapSource?.name === name ? 'border-primary-edge-strong bg-primary-100 animate-pulse' : ''}`}>
                          <div className="flex-1 min-w-0">{renderSwapSelect('spectators',index.toString(),name)}</div>
                          <span className="font-mono text-[10px] font-bold text-primary-800 bg-primary-100 px-1.5 py-0.5 rounded shrink-0" title="KTM代表MMR">
                            {specMmr}
                          </span>
                          {name && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('spectators', index.toString(), name); }}
                              className={`p-0.5 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === name ? 'bg-primary-500 text-black' : 'text-primary-700 hover:text-foreground hover:bg-surface-subtle'}`}
                              title="タップして入れ替え"
                            >
                              ⇄
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 🏆 BO3 シリーズスコアボード (アクティブ時) */}
              <BalancerBo3Manager
                bo3State={bo3State}
                onStartBo3={handleStartBo3}
                onRecordBo3Win={handleRecordBo3Win}
                onNextBo3Game={handleNextBo3Game}
                onResetBo3={handleResetBo3}
              />


              {/* 試合結果記録 & BO3 / ドラフトシミュレータ直結 */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={handleRecordNavigate}
                    disabled={savingPending}
                    type="button"
                    className="flex-1 min-w-[200px] bg-success-600 hover:bg-success-500 disabled:bg-success-800 text-white px-5 py-3 rounded-xl font-black transition flex items-center justify-center gap-2 shadow-lg cursor-pointer text-xs sm:text-sm"
                  >
                    <Trophy className="h-4 w-4" />
                    {savingPending ? '一時保存中...' : 'この編成で試合結果を記録 🏆'}
                  </button>

                  {!bo3State && (
                    <button
                      type="button"
                      onClick={handleStartBo3}
                      className="bg-primary-100 hover:bg-primary-200 border border-primary-edge text-primary-950 px-4 py-3 rounded-xl font-black transition flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm shadow-xs"
                      title="このチーム編成のままBO3（2本先取）マッチを開始します"
                    >
                      <Trophy className="h-4 w-4 text-primary-700" />
                      🏆 BO3シリーズ開始 (2本先取)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!balanceResult) return;
                      setBalanceResult({
                        ...balanceResult,
                        teamBlue: balanceResult.teamRed,
                        teamRed: balanceResult.teamBlue,
                        teamBlueMMR: balanceResult.teamRedMMR,
                        teamRedMMR: balanceResult.teamBlueMMR,
                      });
                      setMessage({ type: 'success', text: '🔄 BLUE ⇄ RED の陣営を入れ替えました！' });
                    }}
                    className="bg-primary-50 hover:bg-primary-100 border border-primary-edge-soft text-primary-800 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm"
                    title="BLUEとREDの陣営を丸ごと入れ替えます"
                  >
                    <Shuffle className="h-4 w-4 text-primary-600" />
                    サイド交代 (BLUE ⇄ RED)
                  </button>

                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
