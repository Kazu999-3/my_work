'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getChampIcon } from '../../../lib/ddragonClient';
import { Swords, Trophy, Shield, Zap, Star, Crosshair, Award, RefreshCw, Radio, Maximize2, Sparkles, Newspaper, Users } from 'lucide-react';

const ROLE_META: Record<string, { icon: any; label: string; color: string }> = {
  TOP: { icon: <Shield className="w-4 h-4 text-purple-400" />, label: 'TOP', color: 'border-purple-500/40 text-purple-300' },
  JG: { icon: <Zap className="w-4 h-4 text-emerald-400" />, label: 'JG', color: 'border-emerald-500/40 text-emerald-300' },
  MID: { icon: <Star className="w-4 h-4 text-rose-400" />, label: 'MID', color: 'border-rose-500/40 text-rose-300' },
  ADC: { icon: <Crosshair className="w-4 h-4 text-sky-400" />, label: 'ADC', color: 'border-sky-500/40 text-sky-300' },
  SUP: { icon: <Award className="w-4 h-4 text-amber-400" />, label: 'SUP', color: 'border-amber-500/40 text-amber-300' },
};

export default function SpectateOverlayPage() {
  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fetchActiveMatch = async () => {
    try {
      const res = await fetch('/api/balancer/spectate/active');
      const data = await res.json();
      if (data.success && data.match) {
        setMatchData(data.match);
      }
    } catch (e) {
      console.error('Spectate fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveMatch();
    const interval = setInterval(() => {
      if (autoRefresh) fetchActiveMatch();
    }, 15000); // 15秒ごとに更新
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

  const blue = matchData?.teamBlue || [];
  const red = matchData?.teamRed || [];
  const blueAvg = matchData?.teamBlueMMR || 1200;
  const redAvg = matchData?.teamRedMMR || 1200;
  const mmrDiff = matchData?.mmrDiff || Math.abs(blueAvg - redAvg);
  const totalMmr = (blueAvg + redAvg) || 2400;
  const bluePct = Math.round((blueAvg / totalMmr) * 100);
  const redPct = 100 - bluePct;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans p-3 sm:p-6 flex flex-col justify-between selection:bg-amber-400 selection:text-black">
      {/* 📺 オーバーレイヘッダー（中継風バナー） */}
      <div className="max-w-7xl mx-auto w-full space-y-4">
        <header className="bg-stone-900/90 border border-stone-800 rounded-3xl p-4 sm:p-5 backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20 shrink-0">
              ⚔️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>KTM IN-GAME SPECTATE OVERLAY</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/50 text-red-400 text-[10px] font-black uppercase tracking-wider">
                    <Radio className="w-3 h-3 animate-pulse" /> LIVE HUD
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-stone-400 font-medium mt-0.5">
                内戦カスタム・公式実況中継ビュー（OBS / 観戦画面ブラウザキャプチャ推奨）
              </p>
            </div>
          </div>

          {/* コントロール群 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                autoRefresh ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-stone-800 border-stone-700 text-stone-400'
              }`}
              title="15秒自動更新"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{autoRefresh ? '自動更新ON' : '停止中'}</span>
            </button>

            <button
              onClick={toggleFullScreen}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="全画面表示"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">全画面</span>
            </button>

            <Link
              href="/balancer"
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              バランサーへ ➔
            </Link>
          </div>
        </header>

        {/* 📊 チーム戦力・MMRゲージバー */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs sm:text-sm font-black">
            <div className="flex items-center gap-2 text-blue-400">
              <span className="text-base sm:text-lg">🟦 BLUE TEAM</span>
              <span className="font-mono bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-500/30 text-blue-200">
                MMR {blueAvg}
              </span>
            </div>

            <div className="text-center font-mono text-[11px] text-stone-400 hidden sm:block">
              MMR差: <strong className="text-amber-400">{mmrDiff}</strong>
            </div>

            <div className="flex items-center gap-2 text-rose-400">
              <span className="font-mono bg-red-950/60 px-2 py-0.5 rounded-lg border border-rose-500/30 text-rose-200">
                MMR {redAvg}
              </span>
              <span className="text-base sm:text-lg">RED TEAM 🟥</span>
            </div>
          </div>

          {/* プロポーショナルメーター */}
          <div className="h-3.5 rounded-full overflow-hidden bg-stone-950 p-0.5 border border-stone-800 flex shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-l-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
              style={{ width: `${bluePct}%` }}
            >
              {bluePct >= 15 ? `${bluePct}%` : ''}
            </div>
            <div
              className="bg-gradient-to-l from-rose-600 via-rose-500 to-pink-500 rounded-r-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
              style={{ width: `${redPct}%` }}
            >
              {redPct >= 15 ? `${redPct}%` : ''}
            </div>
          </div>
        </div>

        {/* ⚔️ 5レーン対面カード・グリッド（eスポーツ中継風） */}
        <div className="space-y-3">
          {roles.map((role) => {
            const rMeta = ROLE_META[role] || ROLE_META.MID;
            const blueP = blue.find((p: any) => (p.assignedRole || p.role) === role) || blue[roles.indexOf(role)];
            const redP = red.find((p: any) => (p.assignedRole || p.role) === role) || red[roles.indexOf(role)];

            return (
              <div
                key={role}
                className="bg-stone-900/90 border border-stone-800 rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between gap-2 sm:gap-4 hover:border-stone-700 transition"
              >
                {/* 🟦 BLUE PLAYER */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-950/80 border-2 border-blue-500/50 flex items-center justify-center text-blue-300 font-black text-sm shrink-0 shadow-md shadow-blue-500/10">
                    {blueP?.highest_rank?.slice(0, 1) || 'B'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm sm:text-base font-black text-white truncate">
                        {blueP?.name || 'BLUE PLAYER'}
                      </span>
                      <span className="text-[10px] font-bold text-blue-300 bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono">
                        {blueP?.mmr || 1200}
                      </span>
                    </div>

                    {/* 得意チャンピオンプール */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {(blueP?.pool || []).slice(0, 3).map((c: string, idx: number) => (
                        <div key={idx} className="relative w-6 h-6 rounded-md overflow-hidden border border-blue-400/40" title={c}>
                          <Image src={getChampIcon(c)} alt={c} fill className="object-cover" />
                        </div>
                      ))}
                      {(!blueP?.pool || blueP.pool.length === 0) && (
                        <span className="text-[10px] text-stone-500 italic">プール未登録</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ⚡ 中央レーンバッジ */}
                <div className="flex flex-col items-center justify-center px-2 sm:px-4 shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950 border ${rMeta.color} shadow-md`}>
                    {rMeta.icon}
                    <span className="font-mono text-xs font-black">{rMeta.label}</span>
                  </div>
                  <span className="text-[9px] text-stone-500 font-black tracking-widest mt-1">VS</span>
                </div>

                {/* 🟥 RED PLAYER */}
                <div className="flex items-center justify-end gap-3 flex-1 min-w-0 text-right">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-rose-300 bg-red-950/60 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono">
                        {redP?.mmr || 1200}
                      </span>
                      <span className="text-sm sm:text-base font-black text-white truncate">
                        {redP?.name || 'RED PLAYER'}
                      </span>
                    </div>

                    {/* 得意チャンピオンプール */}
                    <div className="flex items-center justify-end gap-1 mt-1.5 flex-wrap">
                      {(redP?.pool || []).slice(0, 3).map((c: string, idx: number) => (
                        <div key={idx} className="relative w-6 h-6 rounded-md overflow-hidden border border-rose-400/40" title={c}>
                          <Image src={getChampIcon(c)} alt={c} fill className="object-cover" />
                        </div>
                      ))}
                      {(!redP?.pool || redP.pool.length === 0) && (
                        <span className="text-[10px] text-stone-500 italic">プール未登録</span>
                      )}
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-950/80 border-2 border-rose-500/50 flex items-center justify-center text-rose-300 font-black text-sm shrink-0 shadow-md shadow-rose-500/10">
                    {redP?.highest_rank?.slice(0, 1) || 'R'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 📰 月刊KTMスポーツ直近号外（試合直後のダイジェストがあれば表示） */}
        {matchData?.matchNews && (
          <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800 flex items-start gap-3">
            <span className="text-xl">📰</span>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                直近試合ハイライト号外
              </span>
              <h4 className="text-xs sm:text-sm font-black text-stone-200">
                {matchData.matchNews.headline}
              </h4>
              <p className="text-[11px] text-stone-400 line-clamp-2">
                {matchData.matchNews.lead}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <footer className="text-center text-[10px] text-stone-500 font-mono py-4">
        KTM BROADCAST ENGINE • LIVE DATA DRIVEN BY DATA DRAGON & SUPABASE
      </footer>
    </div>
  );
}
