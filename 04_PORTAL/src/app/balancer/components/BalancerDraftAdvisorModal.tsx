'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Sparkles, Shield, Swords, AlertOctagon, Target, RefreshCw, Zap, Trophy, Heart } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';

interface DraftAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  balanceResult: any;
}

const ROLE_ICONS: Record<string, string> = {
  TOP: '🛡️',
  JG: '🌲',
  MID: '⚡',
  ADC: '🏹',
  SUP: '💚',
};

export default function BalancerDraftAdvisorModal({
  isOpen,
  onClose,
  balanceResult,
}: DraftAdvisorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<any>(null);
  const [selectedSide, setSelectedSide] = useState<'BOTH' | 'BLUE' | 'RED'>('BOTH');

  const fetchAdvice = async () => {
    if (!balanceResult || !balanceResult.teamBlue || !balanceResult.teamRed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/balancer/draft-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamBlue: balanceResult.teamBlue,
          teamRed: balanceResult.teamRed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ドラフト分析の生成に失敗しました。');
      }
      setAdvice(data.advice);
    } catch (e: any) {
      setError(e.message || '通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // 初回表示時に自動実行
  React.useEffect(() => {
    if (isOpen && !advice && !loading) {
      fetchAdvice();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-stone-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-stone-100">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                  AIドラフト・バンピック軍師
                </h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold px-2 py-0.5 rounded-full">
                  Gemini 3.5
                </span>
              </div>
              <p className="text-xs text-stone-400">
                両チームの参加者プール・実力を分析し、勝率を最大化する構成＆BANを提案
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdvice}
              disabled={loading}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer disabled:opacity-50"
              title="再分析"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* フィルタータブ */}
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-950/40 border-b border-stone-800 text-xs">
          <button
            onClick={() => setSelectedSide('BOTH')}
            className={`px-3 py-1 rounded-xl font-black transition cursor-pointer ${
              selectedSide === 'BOTH' ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            両チーム比較
          </button>
          <button
            onClick={() => setSelectedSide('BLUE')}
            className={`px-3 py-1 rounded-xl font-black transition cursor-pointer ${
              selectedSide === 'BLUE' ? 'bg-blue-600 text-white' : 'bg-stone-800 text-blue-300 hover:bg-blue-900/40'
            }`}
          >
            🟦 BLUE視点
          </button>
          <button
            onClick={() => setSelectedSide('RED')}
            className={`px-3 py-1 rounded-xl font-black transition cursor-pointer ${
              selectedSide === 'RED' ? 'bg-red-600 text-white' : 'bg-stone-800 text-rose-300 hover:bg-red-900/40'
            }`}
          >
            🟥 RED視点
          </button>
        </div>

        {/* 本文エリア */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm font-bold text-stone-300">両チームのプール・戦績をAIが読み込んでいます...</p>
              <span className="text-xs text-stone-500">推奨BAN候補とシナジー構成を策定中</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={fetchAdvice}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold ml-2 cursor-pointer"
              >
                再試行
              </button>
            </div>
          )}

          {advice && !loading && (
            <>
              {/* 総評展望 */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-black text-amber-300">軍師の対戦カード総評</h4>
                </div>
                <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-medium">
                  {advice.summary}
                </p>
              </div>

              {/* チーム別作戦カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BLUE 戦略 */}
                {(selectedSide === 'BOTH' || selectedSide === 'BLUE') && (
                  <div className="bg-stone-950/60 border border-blue-500/40 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🟦</span>
                        <h4 className="text-sm font-black text-blue-300">BLUE TEAM 戦略</h4>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full border border-blue-500/40 font-bold">
                        {advice.blueStrategy?.theme || '集団戦構成'}
                      </span>
                    </div>

                    {/* 推奨BAN */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-rose-400 flex items-center gap-1">
                        <AlertOctagon size={13} />
                        <span>推奨BAN候補 (相手の武器を封じる)</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {advice.blueStrategy?.recommendedBans?.map((ban: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-xl bg-stone-900 border border-rose-500/30 flex items-center gap-2">
                            <Image
                              src={getChampIcon(ban.champion)}
                              alt={ban.champion}
                              width={32}
                              height={32}
                              className="rounded-lg border border-rose-500/40 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-black text-rose-200 block truncate">{ban.champion}</span>
                              <span className="text-[10px] text-stone-400 leading-tight block line-clamp-2">{ban.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* シナジー推奨ピック */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-blue-300 flex items-center gap-1">
                        <Swords size={13} />
                        <span>おすすめシナジー編成</span>
                      </span>
                      <div className="space-y-1.5">
                        {advice.blueStrategy?.keySynergyPicks?.map((pick: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-xl bg-stone-900/80 border border-blue-500/20 flex items-center gap-2.5">
                            <span className="text-xs font-black text-stone-400 w-7 shrink-0">
                              {ROLE_ICONS[pick.role] || pick.role}
                            </span>
                            <Image
                              src={getChampIcon(pick.champion)}
                              alt={pick.champion}
                              width={28}
                              height={28}
                              className="rounded-lg border border-blue-400/40 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-black text-blue-200 mr-2">{pick.champion}</span>
                              <span className="text-[10px] text-stone-400">{pick.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 勝ち筋 */}
                    <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200">
                      <span className="font-black text-blue-300 block mb-0.5">🎯 チーム勝ち筋:</span>
                      {advice.blueStrategy?.winCondition}
                    </div>
                  </div>
                )}

                {/* RED 戦略 */}
                {(selectedSide === 'BOTH' || selectedSide === 'RED') && (
                  <div className="bg-stone-950/60 border border-rose-500/40 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🟥</span>
                        <h4 className="text-sm font-black text-rose-300">RED TEAM 戦略</h4>
                      </div>
                      <span className="text-[10px] bg-rose-500/20 text-rose-200 px-2 py-0.5 rounded-full border border-rose-500/40 font-bold">
                        {advice.redStrategy?.theme || 'キャリー構成'}
                      </span>
                    </div>

                    {/* 推奨BAN */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-rose-400 flex items-center gap-1">
                        <AlertOctagon size={13} />
                        <span>推奨BAN候補 (相手の武器を封じる)</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {advice.redStrategy?.recommendedBans?.map((ban: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-xl bg-stone-900 border border-rose-500/30 flex items-center gap-2">
                            <Image
                              src={getChampIcon(ban.champion)}
                              alt={ban.champion}
                              width={32}
                              height={32}
                              className="rounded-lg border border-rose-500/40 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-black text-rose-200 block truncate">{ban.champion}</span>
                              <span className="text-[10px] text-stone-400 leading-tight block line-clamp-2">{ban.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* シナジー推奨ピック */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-rose-300 flex items-center gap-1">
                        <Swords size={13} />
                        <span>おすすめシナジー編成</span>
                      </span>
                      <div className="space-y-1.5">
                        {advice.redStrategy?.keySynergyPicks?.map((pick: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-xl bg-stone-900/80 border border-rose-500/20 flex items-center gap-2.5">
                            <span className="text-xs font-black text-stone-400 w-7 shrink-0">
                              {ROLE_ICONS[pick.role] || pick.role}
                            </span>
                            <Image
                              src={getChampIcon(pick.champion)}
                              alt={pick.champion}
                              width={28}
                              height={28}
                              className="rounded-lg border border-rose-400/40 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-black text-rose-200 mr-2">{pick.champion}</span>
                              <span className="text-[10px] text-stone-400">{pick.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 勝ち筋 */}
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200">
                      <span className="font-black text-rose-300 block mb-0.5">🎯 チーム勝ち筋:</span>
                      {advice.redStrategy?.winCondition}
                    </div>
                  </div>
                )}
              </div>

              {/* 注目のレーン対決 */}
              {advice.keyMatchups && advice.keyMatchups.length > 0 && (
                <div className="bg-stone-950/40 border border-stone-800 rounded-2xl p-4 space-y-2.5">
                  <h4 className="text-xs font-black text-stone-300 flex items-center gap-1.5">
                    <Target size={14} className="text-amber-400" />
                    <span>勝敗を分ける注目レーン対決</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {advice.keyMatchups.map((km: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-stone-900/90 border border-stone-800 text-xs space-y-1">
                        <span className="font-black text-amber-400 flex items-center gap-1">
                          <span>{ROLE_ICONS[km.lane] || '⚔️'}</span>
                          <span>{km.lane} レーン</span>
                        </span>
                        <p className="text-stone-300 text-[11px] leading-relaxed">{km.focus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* フッター */}
        <div className="p-3 sm:p-4 border-t border-stone-800 bg-stone-950/90 flex items-center justify-between">
          <span className="text-[10px] text-stone-500">
            ※プレイヤーの過去ピック・登録得意チャンピオン・MMRを元に生成しています
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-black text-xs transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
