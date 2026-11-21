'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swords, Trophy, Users, Coins, Sparkles, Shield, Zap, Star, Crosshair, Award, ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';
import { generatePreMatchBriefing, TacticalBriefing } from '../../../lib/tacticalBriefingRAG';

const ROLE_ICONS: Record<string, any> = {
  TOP: <Shield className="w-3.5 h-3.5 text-primary-600" />,
  JG: <Zap className="w-3.5 h-3.5 text-success-600" />,
  MID: <Star className="w-3.5 h-3.5 text-danger-600" />,
  ADC: <Crosshair className="w-3.5 h-3.5 text-secondary-600" />,
  SUP: <Award className="w-3.5 h-3.5 text-primary-600" />,
};

interface BalancerStadiumViewProps {
  result: any;
  currentUserName?: string;
  onOpenAdminModal?: () => void;
  isAdmin?: boolean;
}

export default function BalancerStadiumView({
  result,
  currentUserName,
  onOpenAdminModal,
  isAdmin,
}: BalancerStadiumViewProps) {
  if (!result || !result.teamBlue || !result.teamRed) return null;

  const blue = result.teamBlue || [];
  const red = result.teamRed || [];
  const spectators = result.spectators || [];

  const getPlayerRole = (p: any) => p?.currentRole || p?.role || p?.assignedRole || null;

  // 自分がどちらのチームにいるか判定
  const myBlueEntry = currentUserName ? blue.find((p: any) => p.name === currentUserName) : null;
  const myRedEntry = currentUserName ? red.find((p: any) => p.name === currentUserName) : null;
  const mySide = myBlueEntry ? 'BLUE' : myRedEntry ? 'RED' : null;
  const myRole = getPlayerRole(myBlueEntry) || getPlayerRole(myRedEntry) || null;

  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

  const [briefingOpen, setBriefingOpen] = useState(true);
  const briefing: TacticalBriefing | null = useMemo(() => generatePreMatchBriefing(result), [result]);

  return (
    <div className="bg-gradient-to-b from-stone-900 to-stone-950 border-2 border-primary-edge-strong/60 rounded-3xl p-4 sm:p-6 shadow-xl text-white space-y-5 animate-in fade-in">
      {/* スタジアムヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-edge-strong/40 flex items-center justify-center text-xl shrink-0">
            🏟️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>本日のチーム分け対戦カード</span>
                <span className="text-[10px] bg-success-500/20 border border-success-edge-strong/40 text-success-400 font-extrabold px-2 py-0.5 rounded-full">
                  進行中
                </span>
              </h2>
            </div>
            <p className="text-xs text-faint font-medium">
              MMR差: <strong className="text-primary-400 font-mono">{result.mmrDiff || 0}</strong> │ Blue代表MMR: {result.teamBlueMMR || 0} vs Red代表MMR: {result.teamRedMMR || 0}
            </p>
          </div>
        </div>

        {/* アクションボタングループ */}
        <div className="flex items-center gap-2 flex-wrap">

          <Link
            href={result.id ? `/balancer/record?pending_id=${result.id}` : '/balancer/record'}
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-stone-700"
            title="試合結果の入力・OCRスコアボード解析へ進む"
          >
            <span>📝 結果記録・OCR</span>
          </Link>

          <Link
            href="/casino"
            className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-stone-950 font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-primary-edge"
          >
            <Coins size={14} />
            <span>勝敗予想にベット</span>
          </Link>

          {isAdmin && onOpenAdminModal && (
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              ⚙️ 運営詳細
            </button>
          )}
        </div>
      </div>

      {/* 🧠 AI試合前戦術ブリーフィング (RAGエンジン) */}
      {briefing && (
        <div className="bg-stone-900/90 border border-primary-500/30 rounded-2xl overflow-hidden shadow-lg transition-all">
          <button
            type="button"
            onClick={() => setBriefingOpen(!briefingOpen)}
            className="w-full px-4 py-3 bg-gradient-to-r from-primary-950/60 via-stone-900 to-stone-900 hover:bg-stone-850 flex items-center justify-between text-left transition border-b border-primary-500/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary-500/20 border border-primary-500/40 flex items-center justify-center text-primary-400">
                <BrainCircuit size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                    AI試合前戦術ブリーフィング
                  </span>
                  <span className="text-[10px] bg-primary-500/20 border border-primary-500/40 text-primary-300 font-extrabold px-2 py-0.5 rounded-full">
                    {briefing.overview.statusText}
                  </span>
                </div>
                <p className="text-[11px] text-faint">
                  チーム構成・MMR格差から戦術バイブル（D原則）を即時照合
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary-400 font-bold">
              <span>{briefingOpen ? '折りたたむ' : '戦術を開く'}</span>
              {briefingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {briefingOpen && (
            <div className="p-3 sm:p-4 space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 text-[11px] sm:text-xs text-stone-300">
                💡 <span className="font-bold text-white">{briefing.overview.favoredReason}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* 激突区間 (Key Matchup) */}
                <div className="p-3 rounded-xl bg-stone-950/80 border border-primary-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary-400 flex items-center gap-1">
                        <Swords size={12} />
                        <span>最重要激突区間</span>
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary-950 border border-primary-700/50 text-primary-300 font-bold">
                        {briefing.keyMatchup.bibleCode}
                      </span>
                    </div>
                    <div className="text-xs font-black text-white mb-1">
                      {briefing.keyMatchup.role}: {briefing.keyMatchup.bluePlayer} <span className="text-muted-strong font-normal">vs</span> {briefing.keyMatchup.redPlayer}
                    </div>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      {briefing.keyMatchup.tacticalNote}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-800/80 text-[10px] text-primary-400 font-medium">
                    MMR差: ±{briefing.keyMatchup.mmrDiff}
                  </div>
                </div>

                {/* Blueの勝ち筋 */}
                <div className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                  mySide === 'BLUE'
                    ? 'bg-secondary-950/70 border-secondary-500/60 ring-1 ring-secondary-400/50'
                    : 'bg-stone-950/80 border-secondary-500/30'
                }`}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-secondary-400 flex items-center gap-1">
                        <span>🟦 Blueチームの勝ち筋</span>
                        {mySide === 'BLUE' && (
                          <span className="text-[9px] bg-secondary-500 text-white px-1 rounded font-black">自軍</span>
                        )}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary-950 border border-secondary-700/50 text-secondary-300 font-bold">
                        {briefing.blueWinCondition.bibleCode}
                      </span>
                    </div>
                    <div className="text-xs font-black text-secondary-200 mb-1">
                      {briefing.blueWinCondition.title}
                    </div>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      {briefing.blueWinCondition.strategy}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-800/80 text-[10px] text-secondary-400 font-medium">
                    {briefing.blueWinCondition.phase}
                  </div>
                </div>

                {/* Redの勝ち筋 */}
                <div className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                  mySide === 'RED'
                    ? 'bg-danger-950/70 border-danger-500/60 ring-1 ring-danger-400/50'
                    : 'bg-stone-950/80 border-danger-500/30'
                }`}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-danger-400 flex items-center gap-1">
                        <span>🟥 Redチームの勝ち筋</span>
                        {mySide === 'RED' && (
                          <span className="text-[9px] bg-danger-500 text-white px-1 rounded font-black">自軍</span>
                        )}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-danger-950 border border-danger-700/50 text-danger-300 font-bold">
                        {briefing.redWinCondition.bibleCode}
                      </span>
                    </div>
                    <div className="text-xs font-black text-danger-200 mb-1">
                      {briefing.redWinCondition.title}
                    </div>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      {briefing.redWinCondition.strategy}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-stone-800/80 text-[10px] text-danger-400 font-medium">
                    {briefing.redWinCondition.phase}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 👤 ログインユーザー専用の所属アナウンスバナー */}
      {mySide && (
        <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
          mySide === 'BLUE'
            ? 'bg-secondary-950/60 border-secondary-edge-strong/50 text-secondary-200'
            : 'bg-danger-950/60 border-danger-edge-strong/50 text-danger-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{mySide === 'BLUE' ? '🟦' : '🟥'}</span>
            <div>
              <span className="text-xs font-black">
                あなたは <strong className="text-white font-black">{mySide}チーム ({myRole})</strong> です！
              </span>
              <p className="text-[11px] opacity-80">
                対面相手の得意チャンプや戦略を事前に確認して試合に挑みましょう。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ⚔️ 5レーン対面スタジアムグリッド */}
      <div className="space-y-2">
        {roles.map((role) => {
          const blueP = blue.find((p: any) => getPlayerRole(p) === role) || blue[roles.indexOf(role)];
          const redP = red.find((p: any) => getPlayerRole(p) === role) || red[roles.indexOf(role)];

          const isMyBlue = currentUserName && blueP?.name === currentUserName;
          const isMyRed = currentUserName && redP?.name === currentUserName;

          return (
            <div
              key={role}
              className="bg-stone-900/90 border border-stone-800 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 hover:border-stone-700 transition"
            >
              {/* BLUEサイド選手 */}
              <div className={`flex items-center gap-2.5 min-w-0 flex-1 ${isMyBlue ? 'p-1.5 rounded-xl bg-secondary-900/40 border border-secondary-edge-strong/50 ring-1 ring-secondary-400/40' : ''}`}>
                <div className="w-7 h-7 rounded-xl bg-secondary-600/30 border border-secondary-edge-strong/40 flex items-center justify-center text-xs font-black text-secondary-300 shrink-0">
                  {blueP?.highest_rank?.slice(0, 1) || 'B'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      {blueP?.name || '未定'}
                    </span>
                    {isMyBlue && (
                      <span className="text-[9px] font-black bg-secondary-500 text-white px-1.5 rounded">YOU</span>
                    )}
                  </div>
                  <div className="text-[10px] text-faint font-mono">
                    MMR {blueP?.mmr || 1200}
                  </div>
                </div>
              </div>

              {/* 中央レーンバッジ */}
              <div className="flex flex-col items-center justify-center px-2 shrink-0">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-[10px] font-black font-mono text-faint">
                  {ROLE_ICONS[role]}
                  <span>{role}</span>
                </div>
                <span className="text-[9px] text-muted-strong font-black mt-0.5">VS</span>
              </div>

              {/* REDサイド選手 */}
              <div className={`flex items-center justify-end gap-2.5 min-w-0 flex-1 text-right ${isMyRed ? 'p-1.5 rounded-xl bg-danger-900/40 border border-danger-edge-strong/50 ring-1 ring-danger-400/40' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-end gap-1.5">
                    {isMyRed && (
                      <span className="text-[9px] font-black bg-danger-500 text-white px-1.5 rounded">YOU</span>
                    )}
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      {redP?.name || '未定'}
                    </span>
                  </div>
                  <div className="text-[10px] text-faint font-mono">
                    MMR {redP?.mmr || 1200}
                  </div>
                </div>
                <div className="w-7 h-7 rounded-xl bg-danger-600/30 border border-danger-edge-strong/40 flex items-center justify-center text-xs font-black text-danger-300 shrink-0">
                  {redP?.highest_rank?.slice(0, 1) || 'R'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 待機・観戦者 (Spectators) */}
      {spectators.length > 0 && (
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-faint font-bold flex items-center gap-1">
              <Users size={13} className="text-faint" />
              <span>待機・観戦 ({spectators.length}人):</span>
            </span>
            {spectators.map((s: any, idx: number) => (
              <span key={idx} className="bg-stone-800 text-faint px-2 py-0.5 rounded-lg text-[11px] font-bold border border-stone-700">
                {typeof s === 'string' ? s : s.name}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-primary-400 font-bold">
            ※次戦優先選出Pity付与中
          </span>
        </div>
      )}
    </div>
  );
}
