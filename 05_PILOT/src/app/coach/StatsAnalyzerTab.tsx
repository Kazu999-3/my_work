'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, Zap, Target } from 'lucide-react';
import { useCoachRiotId } from './riotIdContext';
import AnalyzerSearchPanel from './_analyzer/AnalyzerSearchPanel';
import WelcomeGuide from './_analyzer/WelcomeGuide';
import ReportHeader from './_analyzer/ReportHeader';
import TargetGapCard from './_analyzer/TargetGapCard';
import ReportTabNav from './_analyzer/ReportTabNav';
import OverviewTab from './_analyzer/OverviewTab';
import ChampionsTab from './_analyzer/ChampionsTab';
import SessionTab from './_analyzer/SessionTab';
import PsychologyTab from './_analyzer/PsychologyTab';

// スタッツ分析タブ。2026-10-08: 04 の外部分析（/analyzer）をそのまま移植した。
// それまでの 05 版はスキル指数・チャンピオン戦績表・連戦疲労の3つだけの簡易版だった。
// 計算は /api/analyzer/deep-intel（04 と同じ lib/sessionAnalyticsCalculator.ts）。画面部品は ./_analyzer/（04 と同じ）。
// 04 との違い: 検索欄にコーチ画面で保存した自分の Riot ID を最初から入れる。2人比較モードは 05 に比較 API が無いため移していない。
const RECENT_KEY = 'lol_analyzer_recent_searches';

export default function StatsAnalyzerTab() {
  const { riotId } = useCoachRiotId();
  const [summonerInput, setSummonerInput] = useState('');
  const [targetTier, setTargetTier] = useState<string>('Emerald IV');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'champions' | 'session' | 'psychology'>('overview');
  const [selectedChampId, setSelectedChampId] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const filledFromSaved = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(saved)) setRecentSearches(saved);
    } catch {
      // 端末保存が使えなくても検索はできる
    }
  }, []);

  // コーチ画面で保存した自分の Riot ID を検索欄の初期値にする（1回だけ。入力中は上書きしない）
  useEffect(() => {
    if (!filledFromSaved.current && riotId) {
      filledFromSaved.current = true;
      setSummonerInput((cur) => cur || riotId);
    }
  }, [riotId]);

  const writeRecents = (list: string[]) => {
    setRecentSearches(list);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* 保存できなくても続行 */ }
  };
  const saveRecentSearch = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    writeRecents([trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8));
  };
  const removeRecentSearch = (e: React.MouseEvent, target: string) => {
    e.stopPropagation();
    writeRecents(recentSearches.filter((s) => s !== target));
  };
  const clearAllRecents = () => writeRecents([]);

  const handleRunAnalysis = async (targetRawInput?: string, targetT?: string) => {
    const raw = targetRawInput !== undefined ? targetRawInput : summonerInput;
    const parts = raw.trim().split('#');
    const name = parts[0]?.trim() || '';
    const tag = parts[1]?.trim() || 'JP1';
    const tier = targetT !== undefined ? targetT : targetTier;
    if (!name) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyzer/deep-intel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameName: name, tagLine: tag, targetTier: tier }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 504 || res.status === 408
            ? 'サーバーがタイムアウトしました。もう一度実行してください。'
            : `サーバー通信エラー (${res.status}): しばらく待ってから再試行してください。`
        );
      }
      if (!res.ok || !data.success) throw new Error(data.error || '解析に失敗しました');

      setReport(data.report);
      saveRecentSearch(`${name}#${tag}`);
      if (data.report?.championProfiles?.length > 0) setSelectedChampId(data.report.championProfiles[0].id);
    } catch (err: any) {
      setError(err.message || 'データ解析の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const selectedChampion =
    report?.championProfiles?.find((c: any) => c.id === selectedChampId) || report?.championProfiles?.[0];

  return (
    <div className="space-y-6">
      <AnalyzerSearchPanel
        targetTier={targetTier} setTargetTier={setTargetTier} summonerInput={summonerInput} setSummonerInput={setSummonerInput}
        loading={loading} handleRunAnalysis={handleRunAnalysis} recentSearches={recentSearches}
        removeRecentSearch={removeRecentSearch} clearAllRecents={clearAllRecents}
      />

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-edge-soft text-danger-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <WelcomeGuide
        report={report} targetTier={targetTier} setSummonerInput={setSummonerInput} loading={loading}
        handleRunAnalysis={handleRunAnalysis} recentSearches={recentSearches} error={error}
      />

      {report && (
        <div className="space-y-6 animate-in fade-in">
          {/* 🎯 結論の要約（強み・最大のボトルネック・次にやること） */}
          {(() => {
            const gap = report.sessionAnalytics?.targetRankGap;
            const radar = report.radarData || [];

            // 強みとボトルの抽出
            let strengthText = 'キル関与とチーム戦闘への参加率が高く、集団戦での存在感を発揮しています。';
            let bottleneckText = '中盤以降の不必要なデスと視界管理に課題があります。';
            let nextActionText = 'オブジェクト発生1分前の先行視界確保と、孤立デスを減らすレーン管理を意識しましょう。';

            if (gap) {
              const passedItems: string[] = [];
              const failedItems: string[] = [];
              if (gap.gaps.deathsDiff?.passed) passedItems.push('低平均デス'); else failedItems.push('平均デスの多さ');
              if (gap.gaps.csDiff?.passed) passedItems.push('安定した分間CS'); else failedItems.push('分間CSの伸び悩み');
              if (gap.gaps.kpDiff?.passed) passedItems.push('高いキル関与率'); else failedItems.push('キル関与率の低さ');
              if (gap.gaps.visionDiff?.passed) passedItems.push('積極的な視界確保'); else failedItems.push('分間視界スコア');

              if (passedItems.length > 0) {
                strengthText = `${gap.benchmark.tierName}基準を上回る「${passedItems.join('・')}」が現在の最大の武器です。`;
              }
              if (failedItems.length > 0) {
                bottleneckText = `昇格に向けた最大のボトルネックは「${failedItems[0]}」です（実測値が目標平均を下回っています）。`;
                if (failedItems[0].includes('デス')) {
                  nextActionText = '視界のないエリアでの単独ファームを自重し、まずは平均デスを1試合あたり1回減らすことを最優先課題にしましょう。';
                } else if (failedItems[0].includes('CS')) {
                  nextActionText = '中盤のローテーション時にサイドレーンの2ウェーブを確実に回収し、分間CS 7.0+ を維持しましょう。';
                } else if (failedItems[0].includes('視界')) {
                  nextActionText = '毎リコールでコントロールワードを1本購入し、敵JGの侵入ルートに常時視界を置きましょう。';
                } else {
                  nextActionText = '味方JGのアクションに合わせて寄りを1手早くし、オブジェクト前の戦闘参加率を高めましょう。';
                }
              }
            }

            return (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-amber-950/20 border border-amber-500/40 shadow-lg space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                  <Target className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white tracking-wide">
                    🎯 総合診断サマリー（AIコーチの結論）
                  </h3>
                  {gap && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 ml-auto">
                      目標 {gap.benchmark.tierName} 適合度: {gap.passedCount}/{gap.totalCount} 項目クリア
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-emerald-900/40 space-y-1">
                    <span className="font-bold text-emerald-400 flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 最大の強み
                    </span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">{strengthText}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-rose-900/40 space-y-1">
                    <span className="font-bold text-rose-400 flex items-center gap-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" /> 最大のボトルネック
                    </span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">{bottleneckText}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-amber-900/40 space-y-1">
                    <span className="font-bold text-amber-400 flex items-center gap-1 text-[11px]">
                      <Zap className="w-3.5 h-3.5" /> 次にやること
                    </span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">{nextActionText}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* セクション切替（画面上部固定 sticky でスクロール不要） */}
          <div className="sticky top-20 z-20 bg-zinc-900/95 backdrop-blur-md p-2 rounded-2xl border border-zinc-800 shadow-xl">
            <ReportTabNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <ReportHeader report={report} targetTier={targetTier} />
          <TargetGapCard report={report} targetTier={targetTier} />
          {activeTab === 'overview' && <OverviewTab report={report} targetTier={targetTier} />}
          {activeTab === 'champions' && selectedChampion && (
            <ChampionsTab report={report} selectedChampion={selectedChampion} setSelectedChampId={setSelectedChampId} />
          )}
          {activeTab === 'session' && report.sessionAnalytics && <SessionTab report={report} />}
          {activeTab === 'psychology' && report.sessionAnalytics?.playstyleMbti && <PsychologyTab report={report} />}
        </div>
      )}
    </div>
  );
}
