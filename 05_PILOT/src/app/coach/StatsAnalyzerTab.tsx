'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
          <ReportHeader report={report} targetTier={targetTier} />
          <TargetGapCard report={report} targetTier={targetTier} />
          <ReportTabNav activeTab={activeTab} setActiveTab={setActiveTab} />
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
