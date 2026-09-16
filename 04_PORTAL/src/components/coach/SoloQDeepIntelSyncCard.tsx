'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Target,
  AlertTriangle,
  Zap,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Award,
  CheckCircle2,
  Flame,
} from 'lucide-react';

interface SoloQDeepIntelSyncCardProps {
  selectedChampion?: string;
  summonerName?: string;
}

export default function SoloQDeepIntelSyncCard({
  selectedChampion = '',
  summonerName = 'Kazurin#4036',
}: SoloQDeepIntelSyncCardProps) {
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [error, setError] = useState('');

  const fetchDeepIntel = async () => {
    setLoading(true);
    setError('');
    try {
      const parts = summonerName.trim().split('#');
      const gName = parts[0]?.trim() || 'Kazurin';
      const tLine = parts[1]?.trim() || '4036';

      const res = await fetch('/api/analyzer/deep-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameName: gName,
          tagLine: tLine,
          targetTier: 'Emerald IV',
        }),
      });

      if (!res.ok) throw new Error('アナライザーデータの取得に失敗しました');
      const data = await res.json();
      if (data.success && data.report) {
        setIntel(data.report);
      }
    } catch (e: any) {
      console.warn('SoloQDeepIntelSyncCard fetch error:', e);
      setError(e.message || 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeepIntel();
  }, [summonerName]);

  // 選択中チャンピオンの固有スタッツを抽出
  const matchedChampProfile = intel?.championProfiles?.find((c: any) => {
    if (!selectedChampion || !c) return false;
    return (
      c.name?.toLowerCase() === selectedChampion.toLowerCase() ||
      c.id?.toLowerCase() === selectedChampion.toLowerCase()
    );
  }) || intel?.championProfiles?.[0];

  const gap = intel?.sessionAnalytics?.targetRankGap;
  const mbti = intel?.sessionAnalytics?.playstyleMbti;
  const rules = intel?.sessionAnalytics?.goldenPlayRules;
  const pool = intel?.sessionAnalytics?.championPoolDiagnosis;

  return (
    <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-white to-orange-500/5 p-5 shadow-xs space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-amber-200/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center text-sm font-black shadow-2xs">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-stone-900">
                SoloQ実測アナライザー同期インテル
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                直近35戦実測
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              目標ランク【{gap?.targetTier || 'Emerald IV'}】到達に向けた実測課題 ＆ 境界線
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDeepIntel}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer disabled:opacity-50"
            title="最新データ再同期"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-amber-600' : ''} />
          </button>
          <Link
            href="/analyzer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-2xs transition hover:scale-105"
          >
            <span>全量カルテ</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {loading && !intel ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs font-bold text-stone-500">
          <RefreshCw size={15} className="animate-spin text-amber-600" />
          <span>アナライザーから直近ソロQデータを同期中...</span>
        </div>
      ) : error && !intel ? (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
          {error}
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* 1. 目標ランク到達度 ＆ 最大ボトルネック */}
          {gap && (
            <div className="bg-white rounded-2xl border border-amber-200/80 p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-950">
                    目標【{gap.targetTier}】到達度スコア:
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-700">
                    {gap.targetReadinessScore}%
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {mbti?.typeName || '実測タイプ判定済み'}
                </span>
              </div>

              {/* 最大の急所ボトルネック */}
              {intel?.analysis?.coreBottleNeck && (
                <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-1">
                  <div className="font-black flex items-center gap-1 text-[11px] text-rose-950">
                    <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                    <span>⚠️ 試合前チェック: 昇格を阻む最大の急所</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {intel.analysis.coreBottleNeck}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. 選択中チャンピオンの実測勝敗境界線 ＆ パワースパイク */}
          {matchedChampProfile && (
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-stone-900">
                    👑 {matchedChampProfile.name} の実戦カルテ
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 font-bold">
                    ({matchedChampProfile.gamesCount}戦 勝率{matchedChampProfile.winRate}% / KDA {matchedChampProfile.kda})
                  </span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                  {matchedChampProfile.powerRating}
                </span>
              </div>

              {/* 実測 勝利時 vs 敗北時のスタッツ差分 */}
              {matchedChampProfile.winVsLossDiffs && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-stone-50 p-2 rounded-xl border border-stone-100 space-y-0.5">
                    <span className="text-[10px] font-bold text-stone-400">🌾 分間CSの勝敗ライン:</span>
                    <p className="font-bold text-stone-800">
                      {matchedChampProfile.winVsLossDiffs.cs15Diff}
                    </p>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-xl border border-stone-100 space-y-0.5">
                    <span className="text-[10px] font-bold text-stone-400">🛡️ 被デス削減ライン:</span>
                    <p className="font-bold text-stone-800">
                      {matchedChampProfile.winVsLossDiffs.deathsDiff}
                    </p>
                  </div>
                </div>
              )}

              {/* 固有パワースパイク指南 */}
              {matchedChampProfile.powerSpikes && (
                <div className="space-y-1 text-xs">
                  <div className="font-black text-amber-950 flex items-center gap-1 text-[11px]">
                    <Zap size={12} className="text-amber-600" />
                    <span>実戦パワースパイク立ち回り:</span>
                  </div>
                  <div className="text-[11px] text-stone-700 bg-amber-50/60 p-2 rounded-xl border border-amber-200/60 leading-relaxed font-medium space-y-1">
                    <div>
                      <strong className="text-amber-900">【序盤 Lv1〜5】:</strong>{' '}
                      {matchedChampProfile.powerSpikes.earlyLvl1to5}
                    </div>
                    <div>
                      <strong className="text-amber-900">【中盤 1〜2コア】:</strong>{' '}
                      {matchedChampProfile.powerSpikes.mid1to2Core}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. セッション管理 ＆ 黄金プレイルール */}
          {rules && rules.length > 0 && (
            <div className="bg-stone-50/80 rounded-2xl border border-stone-200/80 p-3 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 flex items-center gap-1">
                <Flame size={12} className="text-amber-600" />
                <span>実測セッション黄金ルール (連敗・疲労防止)</span>
              </span>
              <ul className="text-[11px] text-stone-700 space-y-1 font-medium">
                {rules.slice(0, 2).map((r: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold shrink-0">✔</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
