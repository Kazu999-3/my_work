'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Target, AlertTriangle, RefreshCw, Swords } from 'lucide-react';
import { PlayerCompareView } from './PlayerCompareView';
import AnalyzerSearchPanel from './_analyzer/AnalyzerSearchPanel';
import WelcomeGuide from './_analyzer/WelcomeGuide';
import ReportHeader from './_analyzer/ReportHeader';
import TargetGapCard from './_analyzer/TargetGapCard';
import ReportTabNav from './_analyzer/ReportTabNav';
import OverviewTab from './_analyzer/OverviewTab';
import ChampionsTab from './_analyzer/ChampionsTab';
import SessionTab from './_analyzer/SessionTab';
import PsychologyTab from './_analyzer/PsychologyTab';

// プレイヤー外部分析（LoLディープアナライザー）。状態・通信と画面の組み立てだけをここに置き、
// 検索欄・レポートの各ブロック・4つのタブは _analyzer/ の部品が持つ。
// 2026-10-07: 1,939行から分割（表示・動作は分割前と同じ）。
export default function PlayerAnalyzerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [analyzerMode, setAnalyzerMode] = useState<'single' | 'compare'>('single');
  const [summonerInput, setSummonerInput] = useState('');
  const [targetTier, setTargetTier] = useState<string>('Emerald IV');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'champions' | 'session' | 'psychology'>('overview');
  const [selectedChampId, setSelectedChampId] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // 検索履歴のロード
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lol_analyzer_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 検索履歴の保存ヘルパー
  const saveRecentSearch = (raw: string) => {
    try {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const filtered = recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem('lol_analyzer_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = (e: React.MouseEvent, target: string) => {
    e.stopPropagation();
    try {
      const updated = recentSearches.filter((s) => s !== target);
      setRecentSearches(updated);
      localStorage.setItem('lol_analyzer_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearAllRecents = () => {
    setRecentSearches([]);
    localStorage.removeItem('lol_analyzer_recent_searches');
  };

  // サモナー名とタグのパース
  const parseSummonerInput = (raw: string) => {
    const parts = raw.trim().split('#');
    const name = parts[0]?.trim() || '';
    const tag = parts[1]?.trim() || 'JP1';
    return { name, tag };
  };

  // 認証チェック
  useEffect(() => {
    fetch('/api/auth/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // 統合解析の実行
  const handleRunAnalysis = async (
    targetRawInput?: string,
    targetT?: string
  ) => {
    const raw = targetRawInput !== undefined ? targetRawInput : summonerInput;
    const { name, tag } = parseSummonerInput(raw);
    const tier = targetT !== undefined ? targetT : targetTier;

    if (!name.trim()) return;

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
      } catch (jsonErr) {
        throw new Error(
          res.status === 504 || res.status === 408
            ? 'サーバーがタイムアウトしました。もう一度実行してください。'
            : `サーバー通信エラー (${res.status}): しばらく待ってから再試行してください。`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || '解析に失敗しました');
      }

      setReport(data.report);
      saveRecentSearch(`${name}#${tag}`);
      if (data.report?.championProfiles?.length > 0) {
        setSelectedChampId(data.report.championProfiles[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'データ解析の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // URLクエリパラメータがある場合のみ初回自動解析（なければ待機）
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryName = params.get('name') || params.get('summoner');
      const queryTag = params.get('tag') || 'JP1';
      if (queryName) {
        const full = `${queryName}#${queryTag}`;
        setSummonerInput(full);
        handleRunAnalysis(full);
      }
    }
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-strong font-bold text-sm">
          <RefreshCw size={24} className="animate-spin text-primary-600" />
          <span>管理権限を確認中...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-surface border border-border rounded-3xl shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-primary-100 text-primary-800 rounded-2xl flex items-center justify-center mx-auto text-xl font-black">
          🔒
        </div>
        <h2 className="text-lg font-black text-foreground">管理者ログインが必要です</h2>
        <p className="text-xs text-muted-strong font-medium">
          LoLディープアナライザーは管理者限定の統合診断ツールです。ログインしてください。
        </p>
        <a
          href="/ktm-admin"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-stone-900 text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition"
        >
          管理者ログインへ
        </a>
      </div>
    );
  }

  const selectedChampion =
    report?.championProfiles?.find((c: any) => c.id === selectedChampId) || report?.championProfiles?.[0];


  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ページタイトル ＆ コンセプトバナー */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-primary-950 p-6 md:p-8 text-white shadow-xl border border-stone-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 border border-primary-edge/30 text-primary-300 text-xs font-black">
              <Sparkles size={14} className="text-primary-400" />
              <span>ソロキュー（ランク戦）実測マッチ履歴連動・深層アナライズ</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
              <span>LoL パーソナル深層アナライザー (SoloQ専属)</span>
            </h1>
            <p className="text-xs md:text-sm text-faint font-medium max-w-2xl leading-relaxed">
              ノーマルやカスタムを完全排除。ソロキュー（ランク戦）の実測マッチデータのみから「実力・ボトルネック・実測パワースパイク・勝敗分岐点」を完全客観診断。
            </p>
          </div>
        </div>
      </div>

      {/* 解析モード切替タブ */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setAnalyzerMode('single')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer ${
            analyzerMode === 'single'
              ? 'bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900'
              : 'bg-surface text-stone-500 hover:text-foreground border border-border'
          }`}
        >
          <Target size={14} className={analyzerMode === 'single' ? 'text-amber-400 dark:text-amber-600' : ''} />
          <span>🎯 個人目標分析 (目標ランク対比)</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyzerMode('compare')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer ${
            analyzerMode === 'compare'
              ? 'bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900'
              : 'bg-surface text-stone-500 hover:text-foreground border border-border'
          }`}
        >
          <Swords size={14} className={analyzerMode === 'compare' ? 'text-amber-400 dark:text-amber-600' : ''} />
          <span>⚔️ 2人プレイヤー直接比較 (VS Head-to-Head)</span>
        </button>
      </div>

      {analyzerMode === 'compare' ? (
        <PlayerCompareView recentSearches={recentSearches} onSaveRecent={saveRecentSearch} />
      ) : (
        <>
          <AnalyzerSearchPanel
            targetTier={targetTier} setTargetTier={setTargetTier} summonerInput={summonerInput} setSummonerInput={setSummonerInput}
            loading={loading} handleRunAnalysis={handleRunAnalysis} recentSearches={recentSearches}
            removeRecentSearch={removeRecentSearch} clearAllRecents={clearAllRecents}
          />

      {/* エラー表示 */}
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

          {/* 👑 プレイスタイル深層統合レポート */}
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
        </>
      )}
    </div>
  );
}
