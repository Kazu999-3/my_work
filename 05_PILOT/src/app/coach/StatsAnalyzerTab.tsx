'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, 
  Brain, Shield, Swords, Target, Clock, Zap, Activity, Award, User, BookOpen
} from 'lucide-react';
import { getChampIcon } from '@/lib/ddragonClient';
import { useCoachRiotId } from './riotIdContext';

export default function StatsAnalyzerTab() {
  const [summonerInput, setSummonerInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'champions' | 'session' | 'psychology'>('overview');

  const { riotId: ownRiotId } = useCoachRiotId();
  // 画面上部の「自分のRiot ID」を初期値にする。ここで書き換えても共有の値は変えない
  useEffect(() => {
    if (ownRiotId) setSummonerInput(ownRiotId);
  }, [ownRiotId]);

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!summonerInput.trim()) return;

    setLoading(true);
    setError('');

    const parts = summonerInput.trim().split('#');
    const gameName = parts[0];
    const tagLine = parts[1] || 'JP1';

    try {
      const res = await fetch('/api/analyzer/deep-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameName, tagLine }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '分析に失敗しました');
      }

      setReport(data.report);
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 検索バー */}
      <form onSubmit={handleAnalyze} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Riot ID を入力 (例: Kazurin#4036 または Hide on bush#KR1)"
            value={summonerInput}
            onChange={(e) => setSummonerInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !summonerInput.trim()}
          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>深層スタッツ分析</span>
        </button>
      </form>

      {/* エラー表示 */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* レポート本体 */}
      {report && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* サモナー基本情報バー */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-700/60 flex items-center justify-center text-xl font-black text-indigo-300">
                {report.summoner.tier?.[0] || 'R'}
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>{report.summoner.gameName}</span>
                  <span className="text-slate-500 text-xs font-mono">#{report.summoner.tagLine}</span>
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span className="text-indigo-400 font-bold">{report.summoner.tier}</span>
                  <span>• 主ロール: {report.summoner.role}</span>
                  <span>• 直近分析: {report.summoner.analyzedMatchesCount}試合</span>
                </div>
              </div>
            </div>

            {/* サブタブ切替 */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold self-start sm:self-auto overflow-x-auto">
              <button
                onClick={() => setActiveSubTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeSubTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                概要・レーダー
              </button>
              <button
                onClick={() => setActiveSubTab('champions')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeSubTab === 'champions'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                チャンプ別
              </button>
              <button
                onClick={() => setActiveSubTab('session')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeSubTab === 'session'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                連戦・セッション
              </button>
            </div>
          </div>

          {/* 1. 概要・レーダーサブタブ */}
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              {/* スタッツサマリーカード */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">勝率 (直近)</span>
                  <div className={`text-2xl font-black ${report.averages.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {report.averages.winRate}%
                  </div>
                  <span className="text-[10px] text-slate-500">Target: {report.targetTier}</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">平均 KDA</span>
                  <div className="text-2xl font-black text-indigo-400">
                    {report.averages.kda}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {report.averages.kills} / {report.averages.deaths} / {report.averages.assists}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">CS / 分</span>
                  <div className="text-2xl font-black text-amber-400">
                    {report.averages.csPerMin}
                  </div>
                  <span className="text-[10px] text-slate-500">ファームテンポ</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">キル関与率 (KP)</span>
                  <div className="text-2xl font-black text-sky-400">
                    {report.averages.killParticipation}%
                  </div>
                  <span className="text-[10px] text-slate-500">集団戦・ガンク参加</span>
                </div>
              </div>

              {/* レーダースコアバー */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" /> スキル指数（実測値を100点換算）
                </h4>
                <div className="space-y-2 text-xs">
                  {Object.entries(report.radarScores).map(([key, score]: [string, any]) => {
                    const labelMap: Record<string, string> = {
                      survival: '🛡️ 生存力・デス回避',
                      farming: '🌾 ファーム効率',
                      combat: '⚔️ キル関与・戦闘力',
                      teamfighting: '👑 KDA指数',
                    };
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-300 font-bold">{labelMap[key] || key}</span>
                          <span className="font-mono font-black text-indigo-400">{score} pt</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. チャンピオン別サブタブ */}
          {activeSubTab === 'champions' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-hidden">
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4 text-indigo-400" /> 使用チャンピオン戦績一覧
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px]">
                      <th className="py-2.5 px-3">チャンプ</th>
                      <th className="py-2.5 px-3">試合数</th>
                      <th className="py-2.5 px-3">勝率</th>
                      <th className="py-2.5 px-3">KDA</th>
                      <th className="py-2.5 px-3">CS/分</th>
                      <th className="py-2.5 px-3 text-right">即時連携</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.champions.map((c: any) => (
                      <tr key={c.name} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <img src={getChampIcon(c.name)} alt={c.name} className="w-7 h-7 rounded-lg object-cover" />
                          <span className="font-bold text-white">{c.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{c.gamesCount}戦</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${c.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {c.winRate}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-300">{c.kda}</td>
                        <td className="py-2.5 px-3 text-slate-400">{c.csPerMin}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/coach?my=${encodeURIComponent(c.name)}`}
                              className="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-[10px] font-bold text-indigo-300 transition"
                              title={`${c.name}の試合前設計図を開く`}
                            >
                              ⚔️ 設計図
                            </Link>
                            <Link
                              href={`/?c=${encodeURIComponent(c.name)}`}
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 transition"
                              title={`${c.name}の辞典を開く`}
                            >
                              👑 辞典
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. セッション・連戦分析サブタブ */}
          {activeSubTab === 'session' && (
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> 連戦疲労度 ＆ ティルト傾向
              </h4>
              {report.sessionStats ? (
                <>
                  <p className="text-[11px] text-slate-400">
                    直近{report.sessionStats.totalGames}試合（{report.sessionStats.sessions}回の連戦）の開始・終了時刻から集計。
                    前の試合の終了から{report.sessionStats.rules.sessionGapMin}分以内に始めた試合を同じ連戦とみなしています。
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-slate-500 text-[10px]">
                          <th className="text-left py-1">連戦の何戦目か</th>
                          <th className="text-right py-1">試合数</th>
                          <th className="text-right py-1">勝率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.sessionStats.byIndex.map((b: any) => (
                          <tr key={b.label} className="border-t border-slate-800/60">
                            <td className="py-1.5 text-slate-300 font-sans font-bold">{b.label}</td>
                            <td className="py-1.5 text-right text-slate-400">{b.games}</td>
                            <td className={`py-1.5 text-right font-bold ${b.winRate == null ? 'text-slate-500' : b.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {b.winRate == null ? '-' : `${b.winRate}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {([
                      ['quick', `負けた後${report.sessionStats.rules.quickRequeueMin}分以内に次へ`],
                      ['later', `負けた後${report.sessionStats.rules.quickRequeueMin}分より空けて次へ`],
                    ] as const).map(([k, label]) => {
                      const b = report.sessionStats.afterLoss[k];
                      return (
                        <div key={k} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-[11px] text-slate-400 font-bold">{label}</div>
                          <div className="font-mono font-black text-slate-100">
                            {b.winRate == null ? '該当なし' : `勝率 ${b.winRate}%`}
                            <span className="text-[10px] text-slate-500 font-normal ml-1">（{b.games}試合）</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500">試合数が少ない区分の勝率はぶれが大きいので、傾向の目安として見てください。</p>
                </>
              ) : (
                <p className="text-xs text-slate-400">連戦分析のデータがありません。</p>
              )}
            </div>
          )}

        </div>
      )}

      {!report && !loading && !error && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl text-slate-500 text-xs space-y-2">
          <Brain className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="font-bold text-slate-400">Riot ID を入力して「深層スタッツ分析」を実行してください</p>
          <p className="text-[11px] text-slate-500">直近35試合の生データから、勝率・KDA・ファーム・連戦ごとの勝率を集計します</p>
        </div>
      )}

    </div>
  );
}
