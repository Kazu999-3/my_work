"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from '../../../components/Toaster';
import { RefreshCw, X, Activity, Globe, MessageSquare, Trophy, AlertTriangle, ArrowLeftRight, Dices, Copy, Check, Shuffle } from "lucide-react";
import { detectUnallowedHigherMatchups, swapWholeTeams, assignFestivalRestrictions } from "../../../lib/balancer/teams";
import { BalancerBo3Manager } from "../components/BalancerBo3Manager";
import { WinRatePredictorCard } from "./WinRatePredictorCard";
import NemesisClashCard from "./NemesisClashCard";
import { LaneMatchupRow } from "./LaneMatchupRow";
import { TacticsSentinelModal } from "./TacticsSentinelModal";
import type { BalanceResultModalProps, ClashResponseData, BalanceTeamMember, FestivalRestriction, BalanceResult } from "./types";

// ★ チーム分け結果モーダル
// 2026-10-07: app/balancer/page.tsx から分割
// 2026-11-15: 06_code_smells_and_dod.md に基づき any 排除・型安全化＆コンポーネント解体（WinRatePredictorCard, NemesisClashCard, LaneMatchupRow）
export default function BalanceResultModal({
  players,
  savingPending,
  copiedResult,
  setMessage,
  balanceResult,
  setBalanceResult,
  proposals,
  selectedProposalIdx,
  setSelectedProposalIdx,
  analysis,
  swapSource,
  sendingDiscord,
  setShowResultModal,
  selectedTable,
  dragOverSlot,
  bo3State,
  handleStartBo3,
  handleRecordBo3Win,
  handleNextBo3Game,
  handleResetBo3,
  handleRecordNavigate,
  handleSendDiscord,
  handleCopyResultText,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDropPlayer,
  handleSelectSwapPlayer,
  renderSwapSelect,
  handicapNames,
  handleSwapWholeTeams,
}: BalanceResultModalProps) {
  const [clashData, setClashData] = useState<ClashResponseData | null>(null);
  const [loadingClash, setLoadingClash] = useState(false);
  const [tacticsModalInfo, setTacticsModalInfo] = useState<{
    isOpen: boolean;
    role: string;
    myPlayerName: string;
    enemyPlayerName: string;
    myChampion: string;
    enemyChampion: string;
  } | null>(null);

  const teamBlue = useMemo(() => balanceResult?.teamBlue || balanceResult?.blueTeam || [], [balanceResult]);
  const teamRed = useMemo(() => balanceResult?.teamRed || balanceResult?.redTeam || [], [balanceResult]);

  // 🛡️ チームメンバーやレーン入れ替え時にもリアルタイムに格上対面警告を再計算
  const unallowedHigherMatchups = detectUnallowedHigherMatchups(
    teamBlue,
    teamRed,
    players
  );

  useEffect(() => {
    if (!teamBlue.length || !teamRed.length) return;
    setLoadingClash(true);
    fetch('/api/balancer/clash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamBlue,
        teamRed,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setClashData(data);
        }
      })
      .catch((err) => console.error('[NemesisClash] fetch error:', err))
      .finally(() => setLoadingClash(false));
  }, [balanceResult, teamBlue, teamRed]);

  if (!balanceResult) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-2 md:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowResultModal(false);
      }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl shadow-2xl my-4">
        {/* モーダルヘッダー */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary-700" />
              マッチング結果
              <span className="hidden md:inline text-xs font-mono text-muted-strong ml-2">
                MMR差: <span className="text-foreground font-bold">{balanceResult.mmrDiff ?? 0}</span>
              </span>
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

            {/* ★ A-10: 希望満足度バッジ */}
            {(() => {
              const allPlayers = [...teamBlue, ...teamRed];
              if (allPlayers.length === 0) return null;
              let mainCount = 0;
              let subCount = 0;
              let offCount = 0;
              allPlayers.forEach((p: BalanceTeamMember) => {
                const role = p.currentRole || p.role;
                const main = p.mainLane || (p as { pref1?: string }).pref1;
                const sub = p.subLane || (p as { pref2?: string }).pref2;
                if (p.isFixed || main === 'ALL' || main === role) {
                  mainCount++;
                } else if (sub === role) {
                  subCount++;
                } else {
                  offCount++;
                }
              });
              const satisfactionRate = Math.round(((mainCount * 1.0 + subCount * 0.5) / allPlayers.length) * 100);
              return (
                <span
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 shadow-xs ${
                    offCount === 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50'
                      : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50'
                  }`}
                >
                  <span>🎉 希望満足度: <strong>{satisfactionRate}%</strong></span>
                  <span className="opacity-75">
                    （第1希望:{mainCount} / 第2希望:{subCount}{offCount > 0 ? ` / オフ:${offCount}` : ''}）
                  </span>
                </span>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            {handleSwapWholeTeams && (
              <button
                type="button"
                onClick={handleSwapWholeTeams}
                className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-foreground-soft px-3 py-1.5 rounded-xl font-bold transition text-xs border border-border shadow-2xs cursor-pointer"
                title="BlueチームとRedチームの陣営を丸ごと反転入れ替えします"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary-600" />
                <span className="hidden sm:inline">陣営入替 (Blue ⇄ Red)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowResultModal(false)}
              className="p-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-faint hover:text-foreground transition cursor-pointer"
              title="閉じる (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 🏁 進行ナビゲーションバー（1➔2で迷わないガイド） */}
        <div className="bg-surface-subtle/80 border-b border-border px-4 md:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                🏁 カスタム進行の流れ:
              </span>
              <span className="text-[11px] text-muted hidden md:inline">
                ①結果送信（VC自動更新） ➔ ②試合後に勝敗記録
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Step 1: Discord通知 */}
              <button
                type="button"
                onClick={handleSendDiscord}
                disabled={sendingDiscord}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded-xl font-bold transition text-xs shadow-xs cursor-pointer"
                title="チーム分け結果をDiscordの#定期カスタムへ送信してメンバーに周知します（VCも自動更新）"
              >
                {sendingDiscord ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                <span>① Discordに結果送信</span>
              </button>

              {/* Step 2: 結果記録への誘導 */}
              <button
                type="button"
                onClick={handleRecordNavigate}
                disabled={savingPending}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-success-600 hover:bg-success-500 disabled:bg-success-800 text-white px-3.5 py-1.5 rounded-xl font-black transition text-xs shadow-xs cursor-pointer"
                title="試合終了後、勝敗やスコアを記録してMMRを更新する画面へ進みます"
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>② 試合後に結果記録</span>
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
          {/* ⚠️ 未許可の格上対面警告 */}
          {unallowedHigherMatchups && unallowedHigherMatchups.length > 0 && (
            <div className="p-3.5 rounded-xl border border-danger-500 bg-danger-50 dark:bg-danger-950/30 text-danger-900 dark:text-danger-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-danger-800 dark:text-danger-300">
                <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0 animate-pulse" />
                <span>⚠️ 【管理者確認】格上対面が許可されていないプレイヤーが含まれています</span>
              </div>
              <p className="text-xs text-danger-800/90 dark:text-danger-300/90 leading-relaxed">
                以下の対面はMMR差が200以上（シルバーvsプラチナ等）ありますが、下位側プレイヤーの「格上との対面」が「🛡️守ってほしい」になっています。10人構成の都合上やむを得ずマッチングされた可能性があります。
              </p>
              <div className="space-y-1 bg-white/80 dark:bg-black/40 p-2.5 rounded-lg border border-danger-200 dark:border-danger-800 text-xs">
                {unallowedHigherMatchups.map((m: { role: string; weakerName: string; weakerMmr: number; strongerName: string; strongerMmr: number; diff: number }, idx: number) => (
                  <div key={idx} className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-danger-700 dark:text-danger-400">[{m.role}]</span>
                    <span>
                      <strong className="text-danger-900 dark:text-danger-200">{m.weakerName}</strong> ({m.weakerMmr})
                      <span className="text-faint mx-1 font-mono">VS</span>
                      <strong className="text-foreground">{m.strongerName}</strong> ({m.strongerMmr})
                    </span>
                    <span className="font-mono font-bold text-danger-600 bg-danger-100 dark:bg-danger-900/40 px-1.5 py-0.5 rounded text-[11px]">
                      MMR差: +{m.diff}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-danger-700 dark:text-danger-400 flex items-center justify-between pt-1">
                <span>※ このまま対戦を実施するか、下部のレーン入れ替え（⇄）やハンデ設定で調整してください。</span>
              </div>
            </div>
          )}

          {/* 環境分析 */}
          {analysis && (
            <div className={`p-3 rounded-xl border text-sm flex flex-col gap-2 ${
              analysis.level === 'HIGH_DIFFERENCE'
                ? 'bg-primary-100 border-primary-edge-soft text-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
                : analysis.level === 'CLOSE'
                ? 'bg-success-100 border-success-edge-soft text-success-700 dark:bg-success-950/30 dark:text-success-300'
                : 'bg-primary-100 border-primary-edge-soft text-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {analysis.level === 'HIGH_DIFFERENCE' ? (
                  <AlertTriangle className="h-4 w-4 text-primary-700 shrink-0" />
                ) : (
                  <Globe className="h-4 w-4 text-success-700 shrink-0" />
                )}
                <span>本日のカスタム環境:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-black ${
                  analysis.level === 'HIGH_DIFFERENCE'
                    ? 'bg-primary-800 text-primary-100'
                    : analysis.level === 'CLOSE'
                    ? 'bg-success-800 text-success-100'
                    : 'bg-primary-800 text-primary-100'
                }`}>
                  {analysis.level === 'HIGH_DIFFERENCE' ? '格差大' : analysis.level === 'CLOSE' ? '実力拮抗' : '標準的'}
                </span>
              </div>
              <p className="text-xs leading-relaxed">{String(analysis.message)}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
                <span>KTM平均MMR: <strong className="text-foreground font-mono">{String(analysis.averageMMR)}</strong></span>
                <span>最低: <strong className="text-foreground font-mono">{String(analysis.minMMR)}</strong></span>
                <span>最高: <strong className="text-foreground font-mono">{String(analysis.maxMMR)}</strong></span>
                <span>差: <strong className={`font-mono ${analysis.level === 'HIGH_DIFFERENCE' ? 'text-primary-700' : 'text-foreground'}`}>{String(analysis.mmrRange)}</strong></span>
                <span className="text-[10px] text-muted-strong font-normal">※SoloQではなくKTMカスタム独自のランクMMR基準です</span>
              </div>
            </div>
          )}

          {/* 🔮 Elo勝率予測 ＆ 接戦度カード（リッチなグラデーションメーター） */}
          <WinRatePredictorCard balanceResult={balanceResult} />

          {/* ⚔️ 因縁マッチアップ ＆ 黄金デュオ速報（Nemesis Clash） */}
          <NemesisClashCard clashData={clashData} loadingClash={loadingClash} />

          {/* 案タブ */}
          {proposals.length > 1 && (
            <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
              {proposals.map((prop: BalanceResult, idx: number): React.ReactElement => {
                const pBlue = prop.teamBlue || prop.blueTeam || [];
                const pRed = prop.teamRed || prop.redTeam || [];
                const diff = Number(prop.mmrDiff ?? Math.abs((prop.teamBlueMMR || 0) - (prop.teamRedMMR || 0)));
                const allP = [...pBlue, ...pRed];
                let mainC = 0;
                let subC = 0;
                allP.forEach((p: BalanceTeamMember) => {
                  const r = p.currentRole || p.role;
                  const m = p.mainLane || (p as { pref1?: string }).pref1;
                  const s = p.subLane || (p as { pref2?: string }).pref2;
                  if (p.isFixed || m === 'ALL' || m === r) mainC++;
                  else if (s === r) subC++;
                });
                const satRate = allP.length > 0 ? Math.round(((mainC + subC * 0.5) / allP.length) * 100) : 0;

                return (
                  <button
                    key={(prop as { id?: string | number }).id || idx}
                    type="button"
                    onClick={() => {
                      setBalanceResult(prop);
                      setSelectedProposalIdx(idx);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                      selectedProposalIdx === idx
                        ? 'bg-primary-600 text-white border-primary-500 shadow-xs'
                        : 'bg-surface-subtle hover:bg-surface-hover text-foreground-soft border-border'
                    }`}
                  >
                    <span>{String(prop.title || `案${(prop as { id?: string | number }).id || idx + 1}`)}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      selectedProposalIdx === idx ? 'bg-black/20 text-white' : 'bg-surface text-muted'
                    }`}>
                      差:{diff}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      selectedProposalIdx === idx ? 'bg-black/20 text-white' : 'bg-surface text-success-600'
                    }`}>
                      {satRate}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 🎪 お祭りモード時: 対面レート差解消縛りルーレット */}
          {balanceResult.isFestivalMode && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-pink-500/10 border-2 border-purple-500/30 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl p-1.5 bg-purple-500/20 rounded-xl border border-purple-500/30 shrink-0">🎲</span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-purple-950 dark:text-purple-200 flex items-center gap-2">
                      案F：対面レート格差解消 ＆ ランダム縛りルーレット
                      <span className="text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                        格差自動アシスト
                      </span>
                    </h3>
                    <p className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5">
                      完全ランダムによる対面の実力差（MMR差）を自動監査！格上プレイヤーに「重度・中度・軽度」の縛りをランダム抽選し、格差を打ち消して白熱した接戦にします。
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = assignFestivalRestrictions(teamBlue, teamRed);
                      setBalanceResult({
                        ...balanceResult,
                        teamBlue: updated.teamBlue,
                        teamRed: updated.teamRed,
                      });
                      toast.success("🎲 対面のMMR格差に応じてランダム縛りルーレットを一括抽選しました！");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5 animate-pulse hover:animate-none"
                    title="格差に応じて格上プレイヤーにランダム縛りを割り当てます"
                  >
                    <Dices size={14} />
                    <span>全レーンの縛りを一括抽選！ 🎲</span>
                  </button>
                </div>
              </div>

              {/* 縛りランクの早見表 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-surface/80 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">🟢 軽度縛り (MMR差 50〜120)</span>
                  </div>
                  <p className="text-[10px] text-muted leading-tight">フラッシュ禁止 / 序盤5分リコール禁止 / ピンクワード義務 / 初期ポーション禁止</p>
                </div>
                <div className="p-2.5 rounded-xl bg-surface/80 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-600 dark:text-amber-400 text-xs">🟡 中度縛り (MMR差 120〜250)</span>
                  </div>
                  <p className="text-[10px] text-muted leading-tight">裸足の戦士（靴禁止） / サモスペ1枠制限 / キル譲渡マン / 逆張り1stアイテム</p>
                </div>
                <div className="p-2.5 rounded-xl bg-surface/80 border border-rose-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-rose-600 dark:text-rose-400 text-xs">🔴 重度縛り (MMR差 250以上・大幅格上)</span>
                  </div>
                  <p className="text-[10px] text-muted leading-tight">完成品アイテム禁止令 / サモスペ完全封印 / 6Lvまでスキル1つ封印 / 視界ワード禁止</p>
                </div>
              </div>
            </div>
          )}

          {/* チーム表示ヘッダー */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center border-b border-border pb-3">
              <div className="col-span-5 bg-gradient-to-r from-secondary-100 dark:from-secondary-950/40 to-transparent p-3 rounded-xl border-l-4 border-secondary-edge-strong flex justify-between items-center">
                <span className="text-base font-black text-secondary-700 dark:text-secondary-400">BLUE TEAM</span>
                <span className="text-xs font-mono font-bold text-secondary-600 dark:text-secondary-300">
                  合計MMR: {balanceResult.teamBlueMMR ?? 0}
                </span>
              </div>
              <div className="col-span-1 flex justify-center text-muted-strong font-black">VS</div>
              <div className="col-span-5 bg-gradient-to-l from-danger-100 dark:from-danger-950/40 to-transparent p-3 rounded-xl border-r-4 border-danger-edge-strong flex justify-between items-center">
                <span className="text-xs font-mono font-bold text-danger-600 dark:text-danger-300">
                  合計MMR: {balanceResult.teamRedMMR ?? 0}
                </span>
                <span className="text-base font-black text-danger-700 dark:text-danger-400">RED TEAM</span>
              </div>
            </div>

            {/* 各レーンの対面行 */}
            {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map((role) => {
              const pB = teamBlue.find((x) => x.currentRole === role);
              const pR = teamRed.find((x) => x.currentRole === role);
              const pBData = players.find((p) => p.name === pB?.name);
              const pRData = players.find((p) => p.name === pR?.name);

              return (
                <LaneMatchupRow
                  key={role}
                  role={role}
                  pB={pB}
                  pR={pR}
                  pBData={pBData}
                  pRData={pRData}
                  dragOverSlot={dragOverSlot}
                  swapSource={swapSource}
                  handicapNames={handicapNames}
                  clashData={clashData}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDropPlayer={handleDropPlayer}
                  handleSelectSwapPlayer={handleSelectSwapPlayer}
                  renderSwapSelect={renderSwapSelect}
                  onOpenTactics={(r, myName, enemyName) => {
                    const myChamp = (pBData as any)?.favoriteChampion || (pBData?.metadata as any)?.favorite_champion || (r === 'TOP' ? 'Aatrox' : r === 'JG' ? 'JarvanIV' : r === 'MID' ? 'Ahri' : r === 'ADC' ? 'Jinx' : 'Thresh');
                    const enemyChamp = (pRData as any)?.favoriteChampion || (pRData?.metadata as any)?.favorite_champion || (r === 'TOP' ? 'Darius' : r === 'JG' ? 'LeeSin' : r === 'MID' ? 'Zed' : r === 'ADC' ? 'Kaisa' : 'Nautilus');
                    setTacticsModalInfo({
                      isOpen: true,
                      role: r,
                      myPlayerName: myName,
                      enemyPlayerName: enemyName,
                      myChampion: myChamp,
                      enemyChampion: enemyChamp,
                    });
                  }}
                />
              );
            })}
          </div>

          {/* AIレポート */}
          {Boolean(balanceResult.balanceReport) && (
            <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-50/60 dark:from-primary-950/30 dark:to-primary-900/10 border border-primary-edge/80 rounded-2xl shadow-2xs space-y-2">
              <h3 className="text-sm font-extrabold text-primary-950 dark:text-primary-200 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary-600" />
                <span>AIバランス分析 ＆ 勝敗予想レポート</span>
              </h3>
              <div className="text-xs text-foreground-soft leading-relaxed font-sans space-y-1.5 bg-surface/80 p-3.5 rounded-xl border border-primary-edge-soft/60">
                {(Array.isArray(balanceResult.balanceReport)
                  ? balanceResult.balanceReport
                  : [balanceResult.balanceReport]
                ).map((line: string | undefined, i: number) => {
                  if (!line) return <div key={i} className="h-1" />;
                  const escaped = String(line)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                  const formatted = escaped
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-primary-950 dark:text-primary-200">$1</strong>')
                    .replace(/`(.*?)`/g, '<code class="bg-primary-100 dark:bg-primary-900/50 text-primary-900 dark:text-primary-200 font-mono px-1 py-0.5 rounded text-[11px] font-bold border border-primary-edge-soft">$1</code>');
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

          {/* 観戦 / 待機メンバー */}
          {balanceResult.spectators && balanceResult.spectators.length > 0 && (
            <div className="pt-3 border-t border-border">
              <h3 className="text-xs font-bold text-muted-strong mb-2 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" /> 観戦 / 待機メンバー
              </h3>
              <div className="flex flex-wrap gap-2">
                {balanceResult.spectators.map((specItem, index) => {
                  const name = typeof specItem === 'string' ? specItem : (specItem as { name: string })?.name || '';
                  const slotKey = `spectators-${index}`;
                  const specP = players.find((p) => p.name === name);
                  const specMmr = specP?.mmr || 1200;
                  return (
                    <div
                      key={`spec-${index}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'spectators', index.toString(), name)}
                      onDragOver={(e) => handleDragOver(e, slotKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropPlayer(e, 'spectators', index.toString())}
                      className={`border rounded px-2.5 py-1.5 min-w-[140px] flex items-center justify-between gap-1.5 transition cursor-grab ${
                        dragOverSlot === slotKey
                          ? 'border-primary-edge bg-primary-100 border-dashed'
                          : 'bg-surface-subtle border-border hover:bg-surface-subtle'
                      } ${swapSource?.name === name ? 'border-primary-edge-strong bg-primary-100 animate-pulse' : ''}`}
                    >
                      <div className="flex-1 min-w-0">{renderSwapSelect('spectators', index.toString(), name)}</div>
                      <span className="font-mono text-[10px] font-bold text-primary-800 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/40 px-1.5 py-0.5 rounded shrink-0" title="KTM代表MMR">
                        {specMmr}
                      </span>
                      {name && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSwapPlayer('spectators', index.toString(), name);
                          }}
                          className={`p-0.5 rounded transition-colors text-xs font-black shrink-0 ${
                            swapSource?.name === name
                              ? 'bg-primary-500 text-black'
                              : 'text-primary-700 hover:text-foreground hover:bg-surface-subtle'
                          }`}
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
            bo3State={bo3State ?? null}
            onStartBo3={handleStartBo3}
            onRecordBo3Win={handleRecordBo3Win}
            onNextBo3Game={handleNextBo3Game}
            onResetBo3={handleResetBo3}
          />

          {/* 試合結果記録 & サイド交代 */}
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
                  className="bg-primary-100 hover:bg-primary-200 dark:bg-primary-950/40 dark:hover:bg-primary-900/50 border border-primary-edge text-primary-950 dark:text-primary-200 px-4 py-3 rounded-xl font-black transition flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm shadow-xs"
                  title="このチーム編成のままBO3（2本先取）マッチを開始します"
                >
                  <Trophy className="h-4 w-4 text-primary-700 dark:text-primary-400" />
                  🏆 BO3シリーズ開始 (2本先取)
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!balanceResult) return;
                  if (handleSwapWholeTeams) {
                    handleSwapWholeTeams();
                  } else {
                    const swapped = swapWholeTeams(balanceResult);
                    setBalanceResult(swapped);
                  }
                  setMessage({ type: 'success', text: '🔄 BLUE ⇄ RED の陣営を入れ替えました！' });
                }}
                className="bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/20 dark:hover:bg-primary-900/40 border border-primary-edge-soft text-primary-800 dark:text-primary-300 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm"
                title="BLUEとREDの陣営を丸ごと入れ替えます"
              >
                <Shuffle className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                サイド交代 (BLUE ⇄ RED)
              </button>
            </div>
          </div>
        </div>
      </div>

      {tacticsModalInfo && (
        <TacticsSentinelModal
          isOpen={tacticsModalInfo.isOpen}
          onClose={() => setTacticsModalInfo(null)}
          role={tacticsModalInfo.role}
          myPlayerName={tacticsModalInfo.myPlayerName}
          enemyPlayerName={tacticsModalInfo.enemyPlayerName}
          myChampion={tacticsModalInfo.myChampion}
          enemyChampion={tacticsModalInfo.enemyChampion}
        />
      )}
    </div>
  );
}
