'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Sparkles,
  Shield,
  Zap,
  Target,
  AlertTriangle,
  Crosshair,
  TrendingUp,
  Eye,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Clock,
  Flame,
  Swords,
  Award,
  Activity,
  Calendar,
  Layers,
  ChevronRight,
  Brain,
  Info,
  Check,
  PieChart,
  Skull,
  Timer,
  Puzzle,
  Lightbulb,
  HeartHandshake,
  Coins,
  Compass,
  AlertOctagon,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';

export default function PlayerAnalyzerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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
        <div className="flex flex-col items-center gap-3 text-stone-500 font-bold text-sm">
          <RefreshCw size={24} className="animate-spin text-amber-600" />
          <span>管理権限を確認中...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-stone-200 rounded-3xl shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto text-xl font-black">
          🔒
        </div>
        <h2 className="text-lg font-black text-stone-900">管理者ログインが必要です</h2>
        <p className="text-xs text-stone-500 font-medium">
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-6 md:p-8 text-white shadow-xl border border-stone-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-black">
              <Sparkles size={14} className="text-amber-400" />
              <span>ソロキュー（ランク戦）実測マッチ履歴連動・深層アナライズ</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
              <span>LoL パーソナル深層アナライザー (SoloQ専属)</span>
            </h1>
            <p className="text-xs md:text-sm text-stone-300 font-medium max-w-2xl leading-relaxed">
              ノーマルやカスタムを完全排除。ソロキュー（ランク戦）の実測マッチデータのみから「実力・ボトルネック・実測パワースパイク・勝敗分岐点」を完全客観診断。
            </p>
          </div>
        </div>
      </div>

      {/* サモナー検索バー ＆ 条件指定 */}
      <div className="rounded-3xl border border-stone-200 bg-white p-4 md:p-5 shadow-xs space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis();
          }}
          className="flex flex-col md:flex-row items-stretch md:items-center gap-3"
        >
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={summonerInput}
              onChange={(e) => setSummonerInput(e.target.value)}
              placeholder="サモナー名#タグ (例: Kazurin#4036, yukizo#7867, Hide on bush#KR1)"
              className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
          </div>

          {/* 目標ランクセレクター */}
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-2xl border border-stone-200 shrink-0">
            <span className="text-[11px] font-bold text-stone-400">目標:</span>
            <select
              value={targetTier}
              onChange={(e) => {
                setTargetTier(e.target.value);
                handleRunAnalysis(summonerInput, e.target.value);
              }}
              className="bg-transparent text-xs font-black text-stone-900 focus:outline-none cursor-pointer"
            >
              <option value="Gold IV">🥇 Gold IV (ゴールド)</option>
              <option value="Platinum IV">🥈 Platinum IV (プラチナ)</option>
              <option value="Emerald IV">💎 Emerald IV (エメラルド)</option>
              <option value="Diamond IV">💠 Diamond IV (ダイアモンド)</option>
            </select>
          </div>

          {/* 実行ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs rounded-2xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>実測解析中...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>⚡ 実行</span>
              </>
            )}
          </button>
        </form>

        {/* 入力補助（最近検索したサモナー履歴 ＆ サンプル候補） */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          {recentSearches.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-stone-500 font-bold flex items-center gap-1">
                <Clock size={12} className="text-amber-600" />
                <span>最近検索したサモナー:</span>
              </span>
              {recentSearches.map((rec) => (
                <div
                  key={rec}
                  onClick={() => {
                    setSummonerInput(rec);
                    handleRunAnalysis(rec, targetTier);
                  }}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold border border-amber-200/80 transition cursor-pointer shadow-2xs"
                >
                  <span>{rec}</span>
                  <button
                    type="button"
                    onClick={(e) => removeRecentSearch(e, rec)}
                    className="text-stone-400 hover:text-rose-600 transition p-0.5 rounded-full hover:bg-white/80"
                    title="履歴から削除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={clearAllRecents}
                className="text-[10px] text-stone-400 hover:text-rose-600 transition underline cursor-pointer ml-1"
              >
                履歴クリア
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-stone-400 font-bold">サンプル候補:</span>
            {[
              { raw: 'Kazurin#4036', label: 'Kazurin#4036 (JG)' },
              { raw: 'yukizo#7867', label: 'yukizo#7867 (SUP)' },
              { raw: 'Hide on bush#KR1', label: 'Faker (KR1)' },
              { raw: 'Agurin#EUW', label: 'Agurin (EUW)' },
            ].map((p) => (
              <button
                key={p.raw}
                type="button"
                onClick={() => {
                  setSummonerInput(p.raw);
                  handleRunAnalysis(p.raw, targetTier);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 font-medium text-[10.5px] border border-stone-200/70 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 未検索時のウェルカム・ガイド表示 */}
      {!report && !loading && !error && (
        <div className="rounded-3xl border border-stone-200 bg-white p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔍
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-black text-stone-900">
              サモナー名を入力して深層アナライズを開始
            </h3>
            <p className="text-xs text-stone-500 font-medium leading-relaxed">
              上の検索バーに「サモナー名#タグ」を入力して実行してください。一度検索したサモナーは入力補助履歴に自動保存され、ワンクリックで再解析できます。
            </p>
          </div>
          {recentSearches.length > 0 && (
            <div className="pt-4 max-w-md mx-auto">
              <div className="text-xs font-bold text-stone-400 mb-2">最近検索したサモナーから再開:</div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {recentSearches.map((rec) => (
                  <button
                    key={rec}
                    type="button"
                    onClick={() => {
                      setSummonerInput(rec);
                      handleRunAnalysis(rec, targetTier);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 font-black text-xs border border-amber-300/60 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles size={12} className="text-amber-600" />
                    <span>{rec}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👑 決定版 プレイスタイル深層統合レポート出力画面 */}
      {/* ========================================================================= */}
      {report && (
        <div className="space-y-6 animate-in fade-in">
          {/* 1. 総合カルテヘッダーバナー */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-2xl font-black shadow-sm shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-stone-900">
                    {report.summoner.name}#{report.summoner.tag}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                    現在: {report.summoner.tier}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    目標: <strong>{targetTier}</strong>
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    {(() => {
                      const r = (report.summoner.role || '').toUpperCase();
                      if (r === 'UTILITY' || r === 'SUPPORT') return 'SUPPORT (サポート)';
                      if (r === 'MIDDLE' || r === 'MID') return 'MID (ミッド)';
                      if (r === 'BOTTOM' || r === 'ADC') return 'ADC (ボット)';
                      if (r === 'TOP') return 'TOP (トップ)';
                      return 'JUNGLE (ジャングル)';
                    })()} メイン
                  </span>
                  {report.summoner.sampleMatchesCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                      SoloQ実測 {report.summoner.sampleMatchesCount}試合連動
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-2 mt-1">
                  <span>
                    タイプ:{' '}
                    <strong>
                      {report.analysis?.styleTypeName ||
                        report.sessionAnalytics?.playstyleMbti?.typeName ||
                        (report.summoner?.role === 'UTILITY'
                          ? '視界制圧＆味方ピール支援型'
                          : 'ファームスケーリング＆セーフティ型')}
                    </strong>
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {report.analysis?.styleBadge ||
                      (report.summoner?.role === 'UTILITY' ? '視界スコア Sランク' : '安定度 Sランク')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-stone-400 font-mono">
                統合データソース: Riot API / your.gg / League of Graphs
              </div>
              <div className="text-xs font-bold text-stone-600 mt-0.5">
                目標ランク逆算解析完了 (リアルタイム)
              </div>
            </div>
          </div>

          {/* 🎯 目標ランク基準ギャップ診断 メインHUDカード */}
          {report.sessionAnalytics?.targetRankGap && (
            <div className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-emerald-100 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
                    🎯
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        目標基準: {report.sessionAnalytics.targetRankGap.benchmark.tierName}
                      </span>
                      <h3 className="text-lg font-black text-stone-900">
                        目標ランク到達度 ＆ スタッツギャップ診断
                      </h3>
                    </div>
                    <p className="text-xs text-stone-600 font-medium mt-0.5">
                      同ランク帯比較ではなく、目標【{targetTier}】の平均スタッツと現在の実測値を直接照合
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-stone-400 font-bold">目標到達レディネス</span>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {report.sessionAnalytics.targetRankGap.targetReadinessScore}%
                  </div>
                </div>
              </div>

              {/* 5大スタッツ ギャップカード */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* 生存率 */}
                <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-stone-600">① 平均被デス</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        report.sessionAnalytics.targetRankGap.gaps.deathsDiff.passed
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {report.sessionAnalytics.targetRankGap.gaps.deathsDiff.passed ? '達成' : '要改善'}
                    </span>
                  </div>
                  <div className="text-stone-900 font-black font-mono">
                    実測 {report.sessionAnalytics.targetRankGap.currentActual.avgDeaths} / 目標{' '}
                    {report.sessionAnalytics.targetRankGap.benchmark.avgDeaths}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {report.sessionAnalytics.targetRankGap.gaps.deathsDiff.label}
                  </div>
                </div>

                {/* CS効率 */}
                <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-stone-600">② 分間CS</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        report.sessionAnalytics.targetRankGap.gaps.csDiff.passed
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {report.sessionAnalytics.targetRankGap.gaps.csDiff.passed ? '達成' : '要改善'}
                    </span>
                  </div>
                  <div className="text-stone-900 font-black font-mono">
                    実測 {report.sessionAnalytics.targetRankGap.currentActual.csPerMin} / 目標{' '}
                    {report.sessionAnalytics.targetRankGap.benchmark.csPerMin}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {report.sessionAnalytics.targetRankGap.gaps.csDiff.label}
                  </div>
                </div>

                {/* キル関与率 */}
                <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-stone-600">③ 15分キル関与 (KP)</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        report.sessionAnalytics.targetRankGap.gaps.kpDiff.passed
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {report.sessionAnalytics.targetRankGap.gaps.kpDiff.passed ? '達成' : '最重要'}
                    </span>
                  </div>
                  <div className="text-stone-900 font-black font-mono">
                    実測 {report.sessionAnalytics.targetRankGap.currentActual.kp15}% / 目標{' '}
                    {report.sessionAnalytics.targetRankGap.benchmark.kp15}%
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {report.sessionAnalytics.targetRankGap.gaps.kpDiff.label}
                  </div>
                </div>

                {/* 分間視界 */}
                <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-stone-600">④ 分間視界</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        report.sessionAnalytics.targetRankGap.gaps.visionDiff.passed
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {report.sessionAnalytics.targetRankGap.gaps.visionDiff.passed ? '達成' : '要改善'}
                    </span>
                  </div>
                  <div className="text-stone-900 font-black font-mono">
                    実測 {report.sessionAnalytics.targetRankGap.currentActual.visionScorePerMin} / 目標{' '}
                    {report.sessionAnalytics.targetRankGap.benchmark.visionScorePerMin}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {report.sessionAnalytics.targetRankGap.gaps.visionDiff.label}
                  </div>
                </div>

                {/* 敵陣ディープ視界 */}
                <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-stone-600">⑤ 敵陣ディープ視界</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        report.sessionAnalytics.targetRankGap.gaps.deepWardDiff.passed
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {report.sessionAnalytics.targetRankGap.gaps.deepWardDiff.passed ? '達成' : '要改善'}
                    </span>
                  </div>
                  <div className="text-stone-900 font-black font-mono">
                    実測 {report.sessionAnalytics.targetRankGap.currentActual.deepWardRatio}% / 目標{' '}
                    {report.sessionAnalytics.targetRankGap.benchmark.deepWardRatio}%
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {report.sessionAnalytics.targetRankGap.gaps.deepWardDiff.label}
                  </div>
                </div>
              </div>

              {/* 昇格に必要な急所アクション処方箋 */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-2">
                <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>【{targetTier}】昇格への逆算処方箋:</span>
                </div>
                <ul className="space-y-1 text-xs text-stone-700 font-medium">
                  {report.sessionAnalytics.targetRankGap.keyActionToPromote?.map((act: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ナビゲーションタブ */}
          <div className="flex items-center gap-2 border-b border-stone-200 pb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <TrendingUp size={14} />
              <span>1. 📊 5大レーダー ＆ 展開4分類</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('champions')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'champions'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Award size={14} />
              <span>2. 👑 上位チャンプ深掘り ＆ プール穴診断</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('session')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'session'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Brain size={14} />
              <span>3. 🧠 実測コンディション ＆ ティルト分析</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('psychology')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'psychology'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              <Compass size={14} />
              <span>4. 🧬 プレイヤー心理DNA ＆ メンタルカルテ (MBTI)</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* タブ 1: 📊 5大レーダー ＆ 展開4分類 */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 試合展開4タイプ分類 */}
              {report.sessionAnalytics?.gameOutcomeBreakdown && (
                <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 gap-2">
                    <div>
                      <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                        <PieChart size={16} className="text-amber-600" />
                        <span>⚖️ 試合展開4タイプ自動分類 (Carry vs ACE Loss Index)</span>
                      </h3>
                      <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                        直近の全試合を「自力勝利」「味方連携」「不運な負け」「防げた負け」の4パターンに客観分類
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-xl font-mono self-start sm:self-auto">
                      実戦 {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}試合 抽出解析
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                    {/* 1. ハードキャリー勝利 */}
                    <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-amber-950 flex items-center gap-1">
                            👑 ハードキャリー勝利
                          </span>
                          <span className="text-[9.5px] font-black text-amber-800 bg-amber-200/70 px-1.5 py-0.5 rounded">自力主導</span>
                        </div>
                        <div className="text-2xl font-black text-amber-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.percent}%{' '}
                          <span className="text-xs font-bold text-amber-800">({report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-amber-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身が高いキル・大ダメージ・CCで試合を動かし、圧倒的なリードを作って自らチームを勝利に導いた試合。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-amber-200/70 text-[10px] text-amber-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 勝利 ＋ KDA 5.0以上 または ダメージシェア24%以上</div>
                        <div>💡 <strong>意味:</strong> あなたの勝ちパターン。再現性を高めることが昇格の最短ルート。</div>
                      </div>
                    </div>

                    {/* 2. チーム協調勝利 */}
                    <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                            🛡️ チーム協調勝利
                          </span>
                          <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-200/70 px-1.5 py-0.5 rounded">堅実連携</span>
                        </div>
                        <div className="text-2xl font-black text-emerald-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.percent}%{' '}
                          <span className="text-xs font-bold text-emerald-800">({report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-emerald-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 無理なキルを追わず低デスを維持。視界管理・味方キャリーの防衛（ピール）・オブジェクト確保で手堅く掴んだ勝利。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-emerald-200/70 text-[10px] text-emerald-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 勝利 ＋ 安定した低被デス・視界貢献・アシスト中心</div>
                        <div>💡 <strong>意味:</strong> 「自分が育たなくても勝てる」高い安定性とチーム貢献力の証拠。</div>
                      </div>
                    </div>

                    {/* 3. エース敗北 */}
                    <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-indigo-950 flex items-center gap-1">
                            😭 エース敗北 (味方崩壊)
                          </span>
                          <span className="text-[9.5px] font-black text-indigo-800 bg-indigo-200/70 px-1.5 py-0.5 rounded">不運・奮闘</span>
                        </div>
                        <div className="text-2xl font-black text-indigo-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.percent}%{' '}
                          <span className="text-xs font-bold text-indigo-800">({report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-indigo-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身は好調（低デス・高KDA）で有利を作っていたが、他レーンの大量崩壊や味方のミスで押し切られた悔しい敗北。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-indigo-200/70 text-[10px] text-indigo-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 敗北 ＋ 自身はKDA 3.8以上 ＆ 低被デス（4デス以下）</div>
                        <div>💡 <strong>意味:</strong> あなた自身に大きな非はない「不運な負け」。引きずらず割り切るべき試合。</div>
                      </div>
                    </div>

                    {/* 4. 集団戦・逆転負け */}
                    <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-rose-950 flex items-center gap-1">
                            ⚠️ 集団戦・逆転負け
                          </span>
                          <span className="text-[9.5px] font-black text-rose-800 bg-rose-200/70 px-1.5 py-0.5 rounded">要改善</span>
                        </div>
                        <div className="text-2xl font-black text-rose-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.percent}%{' '}
                          <span className="text-xs font-bold text-rose-800">({report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-rose-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身のデスが嵩んだり、終盤のオブジェクト前や視界のない場所での孤立被キャッチから形勢を逆転されてしまった敗北。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-rose-200/70 text-[10px] text-rose-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 敗北 ＋ 被デス5回以上 または 終盤の重要局面でのデス</div>
                        <div>💡 <strong>意味:</strong> 最も改善価値の高い「防げた負け筋」。このデスの原因を無くせば即昇格。</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                    <div className="font-black text-stone-900 flex items-center gap-1.5">
                      <span>💡 展開傾向診断:</span>
                    </div>
                    <p className="leading-relaxed font-medium">
                      {report.sessionAnalytics.gameOutcomeBreakdown.dominantOutcomeSummary}
                    </p>
                  </div>
                </div>
              )}

              {/* 2カラムHUDグリッド */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 flex flex-col gap-6">
                  {/* 5大レーダー解析スコアカード */}
                  <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-amber-600" />
                        <h3 className="font-black text-sm text-stone-900">
                          プレイスタイル 5大レーダー客観解析
                        </h3>
                        {report.sessionAnalytics?.roleConfig && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            {report.sessionAnalytics.roleConfig.roleIcon} {report.sessionAnalytics.roleConfig.roleName} 特化診断
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-stone-400">
                        Riot API実測値 ＆ 目標【{targetTier}】基準
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {(() => {
                        const role = (report.summoner?.role || report.sessionAnalytics?.roleConfig?.roleId || 'JUNGLE').toUpperCase();
                        const isSup = role === 'UTILITY' || role === 'SUPPORT' || role === 'SUP';
                        const isJg = role === 'JUNGLE' || role === 'JG';
                        const isMid = role === 'MIDDLE' || role === 'MID';
                        const isBot = role === 'BOTTOM' || role === 'BOT' || role === 'ADC';

                        let radarItems: Array<{
                          label: string;
                          score: number;
                          valueText: string;
                          barBg: string;
                          textColor: string;
                          subTextColor: string;
                          icon: any;
                          badge?: string;
                        }> = [];

                        if (isSup) {
                          // サポート特化 5大項目
                          const visionScore = Math.min(100, Math.max(20, Math.round((report.metrics.vision.visionScorePerMin / 2.3) * 75)));
                          radarItems = [
                            {
                              label: '① 視界支配・ピンクワード購入',
                              score: visionScore,
                              valueText: `分間視界 ${report.metrics.vision.visionScorePerMin}/分 (ピンク推計 ${report.metrics.vision.controlWardsPerGame}本/試合)`,
                              barBg: 'bg-emerald-500',
                              textColor: 'text-emerald-700',
                              subTextColor: 'text-emerald-600',
                              icon: Eye,
                              badge: visionScore < 50 ? '要改善' : undefined,
                            },
                            {
                              label: '② 序盤ローム・他レーン支援力',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-sky-500',
                              textColor: 'text-sky-700',
                              subTextColor: 'text-sky-600',
                              icon: Zap,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '③ 集団戦CC・キャリー防衛 (ピール)',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-indigo-500',
                              textColor: 'text-indigo-700',
                              subTextColor: 'text-indigo-600',
                              icon: Shield,
                            },
                            {
                              label: '④ オブジェクト先制視界管理',
                              score: report.metrics.objectives.score,
                              valueText: `${report.sessionAnalytics?.earlyTimelineImpact?.objLabel || 'ドラゴン確保時勝率'}: ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate || 50}%`,
                              barBg: 'bg-amber-500',
                              textColor: 'text-amber-700',
                              subTextColor: 'text-amber-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 低被デス・生存ポジショニング',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-rose-500',
                              textColor: 'text-rose-700',
                              subTextColor: 'text-rose-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isJg) {
                          radarItems = [
                            {
                              label: '① 生存力・被デス回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-emerald-500',
                              textColor: 'text-emerald-700',
                              subTextColor: 'text-emerald-600',
                              icon: Shield,
                            },
                            {
                              label: '② ファーム効率 (CS/分)',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-sky-500',
                              textColor: 'text-sky-700',
                              subTextColor: 'text-sky-600',
                              icon: Zap,
                            },
                            {
                              label: '③ 15分キル関与 (KP@15)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-rose-500',
                              textColor: 'text-rose-700',
                              subTextColor: 'text-rose-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ オブジェクト確保 (Obj Control)',
                              score: report.metrics.objectives.score,
                              valueText: `グラブ/ドラゴン優位時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate || 50}%`,
                              barBg: 'bg-amber-500',
                              textColor: 'text-amber-700',
                              subTextColor: 'text-amber-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 集団戦ポジショニング (Teamfight)',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-indigo-500',
                              textColor: 'text-indigo-700',
                              subTextColor: 'text-indigo-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isMid) {
                          radarItems = [
                            {
                              label: '① 生存力・被ガンク回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-emerald-500',
                              textColor: 'text-emerald-700',
                              subTextColor: 'text-emerald-600',
                              icon: Shield,
                            },
                            {
                              label: '② CS精度 ＆ プッシュ主導権',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-sky-500',
                              textColor: 'text-sky-700',
                              subTextColor: 'text-sky-600',
                              icon: Zap,
                            },
                            {
                              label: '③ ローム・サイド介入率 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-rose-500',
                              textColor: 'text-rose-700',
                              subTextColor: 'text-rose-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ リバー・オブジェクト主導権',
                              score: report.metrics.objectives.score,
                              valueText: `オブジェクト優位時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate || 50}%`,
                              barBg: 'bg-amber-500',
                              textColor: 'text-amber-700',
                              subTextColor: 'text-amber-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 集団戦DPS ＆ KDA',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-indigo-500',
                              textColor: 'text-indigo-700',
                              subTextColor: 'text-indigo-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isBot) {
                          radarItems = [
                            {
                              label: '① 集団戦ポジショニング・低デス',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-emerald-500',
                              textColor: 'text-emerald-700',
                              subTextColor: 'text-emerald-600',
                              icon: Shield,
                            },
                            {
                              label: '② 分間CS ＆ リソース回収',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-sky-500',
                              textColor: 'text-sky-700',
                              subTextColor: 'text-sky-600',
                              icon: Zap,
                            },
                            {
                              label: '③ 終盤DPS占有 ＆ キル関与 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-rose-500',
                              textColor: 'text-rose-700',
                              subTextColor: 'text-rose-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ オブジェクトバースト力',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン確保時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate || 50}%`,
                              barBg: 'bg-amber-500',
                              textColor: 'text-amber-700',
                              subTextColor: 'text-amber-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ KDA ＆ キャリー力',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-indigo-500',
                              textColor: 'text-indigo-700',
                              subTextColor: 'text-indigo-600',
                              icon: Crosshair,
                            },
                          ];
                        } else {
                          // TOP
                          radarItems = [
                            {
                              label: '① タイマン生存・被ソロキル回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-emerald-500',
                              textColor: 'text-emerald-700',
                              subTextColor: 'text-emerald-600',
                              icon: Shield,
                            },
                            {
                              label: '② CS精度 ＆ ウェーブ管理',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-sky-500',
                              textColor: 'text-sky-700',
                              subTextColor: 'text-sky-600',
                              icon: Zap,
                            },
                            {
                              label: '③ TP・集団戦合流力 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-rose-500',
                              textColor: 'text-rose-700',
                              subTextColor: 'text-rose-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ スプリットプッシュ圧力 ＆ グラブ確保',
                              score: report.metrics.objectives.score,
                              valueText: `グラブ確保時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate || 50}%`,
                              barBg: 'bg-amber-500',
                              textColor: 'text-amber-700',
                              subTextColor: 'text-amber-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ フロントライン耐久 ＆ KDA',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-indigo-500',
                              textColor: 'text-indigo-700',
                              subTextColor: 'text-indigo-600',
                              icon: Crosshair,
                            },
                          ];
                        }

                        return radarItems.map((item, idx) => {
                          const IconComp = item.icon;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className={`${item.textColor} flex items-center gap-1`}>
                                  <IconComp size={13} /> {item.label}
                                  {item.badge && (
                                    <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-black">
                                      {item.badge}
                                    </span>
                                  )}
                                </span>
                                <span className="text-stone-900 font-black">
                                  {item.score}点{' '}
                                  <span className={`text-[10px] ${item.subTextColor} font-normal`}>
                                    ({item.valueText})
                                  </span>
                                </span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                                <div
                                  className={`h-full ${item.barBg} rounded-full`}
                                  style={{ width: `${Math.min(100, Math.max(5, item.score))}%` }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* 致命的デス (Throw) ＆ 序盤タイムライン因果 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.sessionAnalytics?.fatalDeathAnalytics && (
                      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs space-y-2.5">
                        <div className="text-xs font-black text-stone-900 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                          <Skull size={14} className="text-rose-600" />
                          <span>致命的デス (Throw) 検知</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-stone-700">
                          <div className="flex justify-between font-bold">
                            <span>Obj直前デス:</span>
                            <span className="font-mono text-stone-900">
                              {report.sessionAnalytics.fatalDeathAnalytics.objPreSpawnDeathsCount}回 ({report.sessionAnalytics.fatalDeathAnalytics.objPreSpawnDeathsRate}%)
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>孤立被キャッチ率:</span>
                            <span className="font-mono text-stone-900">
                              {report.sessionAnalytics.fatalDeathAnalytics.isolatedDeathsPercent}%
                            </span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 border-t border-stone-100">
                            <span>スロー危険度:</span>
                            <span className="font-black text-emerald-700">
                              {report.sessionAnalytics.fatalDeathAnalytics.fatalThrowRating}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {report.sessionAnalytics?.earlyTimelineImpact && (
                      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs space-y-2.5">
                        <div className="text-xs font-black text-stone-900 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                          <Timer size={14} className="text-amber-600" />
                          <span>序盤14分 タイムライン因果</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-stone-700">
                          <div className="flex justify-between font-bold">
                            <span>初デス平均時間:</span>
                            <span className="font-mono text-stone-900">
                              {report.sessionAnalytics.earlyTimelineImpact.firstDeathAvgMinute}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>{report.sessionAnalytics.earlyTimelineImpact.objLabel || '序盤オブジェクト獲得時勝率'}:</span>
                            <span className="font-mono text-emerald-700">
                              {report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-100 font-medium">
                            {report.sessionAnalytics.earlyTimelineImpact.plateGoldImpact}
                          </div>
                          {report.sessionAnalytics.earlyTimelineImpact.roleObjectiveFocus && (
                            <div className="text-[10.5px] text-indigo-700 bg-indigo-50/70 p-2 rounded-xl font-medium leading-relaxed">
                              🎯 {report.sessionAnalytics.earlyTimelineImpact.roleObjectiveFocus}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 視界客観データ */}
                  <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                        <Eye size={16} className="text-indigo-600" />
                        <span>視界・コントロール客観解析 (League of Graphs / Riot API連動)</span>
                      </h3>
                      <span className="text-xs font-black text-indigo-700">
                        分間視界 {report.metrics.vision.visionScorePerMin}/分
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-stone-700">
                        <span>視界侵入深度バランス:</span>
                        <span>
                          {report.sessionAnalytics?.roleConfig?.visionLabelA || '自陣防衛'}{' '}
                          {report.metrics.vision.defensiveWardPercent}% /{' '}
                          {report.sessionAnalytics?.roleConfig?.visionLabelB || '敵陣ディープ'}{' '}
                          {report.metrics.vision.deepWardPercent}%
                        </span>
                      </div>
                      <div className="h-3.5 w-full rounded-full bg-stone-100 flex overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${report.metrics.vision.defensiveWardPercent}%` }}
                          title={`${report.sessionAnalytics?.roleConfig?.visionLabelA || '自陣防衛'}: ${report.metrics.vision.defensiveWardPercent}%`}
                        />
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${report.metrics.vision.deepWardPercent}%` }}
                          title={`${report.sessionAnalytics?.roleConfig?.visionLabelB || '敵陣ディープ'}: ${report.metrics.vision.deepWardPercent}%`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-emerald-700">
                          {report.sessionAnalytics?.roleConfig?.visionLabelA || '🛡️ 自陣防衛'} ({report.metrics.vision.defensiveWardPercent}%)
                        </span>
                        <span className="text-amber-700">
                          {report.sessionAnalytics?.roleConfig?.visionLabelB || '⚡ 敵陣ディープ'} ({report.metrics.vision.deepWardPercent}%)
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed font-medium bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                      {report.analysis.visionAnalysis}
                    </p>
                  </div>
                </div>

                {/* 右側 (5カラム): AI総合深層診断・最大の敗因・アクション */}
                <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-4">
                  {/* 3大強み */}
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs space-y-2.5">
                    <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <span>🌟</span>
                      <span>実測データから導かれた「3大強み」</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-700 font-medium">
                      {report.analysis.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 最大の敗因・ボトルネック */}
                  <div className="rounded-3xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs space-y-2.5">
                    <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-amber-200 text-amber-900">⚠️</span>
                      <span>【{targetTier}】到達を阻む最大のボトルネック</span>
                    </div>
                    <p className="text-xs text-stone-800 leading-relaxed font-medium bg-white p-3 rounded-2xl border border-amber-200">
                      {report.analysis.coreBottleNeck}
                    </p>
                  </div>

                  {/* 決定版・次戦の具体的急所アクション */}
                  <div className="rounded-3xl border border-indigo-300 bg-indigo-50/80 p-5 shadow-xs space-y-3">
                    <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-600" />
                      <span>【{targetTier}】昇格への決定版アクション</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 space-y-2">
                      <div className="text-xs font-bold text-stone-900 leading-relaxed">
                        {report.analysis.actionPlan}
                      </div>

                      {report.analysis.goldenDeepWard && (
                        <div className="pt-2 border-t border-indigo-100 text-[11px] text-stone-600 space-y-1">
                          <div className="font-bold text-indigo-900 flex items-center gap-1">
                            <MapPin size={12} className="text-indigo-600" />
                            <span>推奨: {report.analysis.goldenDeepWard.spot}</span>
                          </div>
                          <div>⏰ {report.analysis.goldenDeepWard.timing}</div>
                          <div className="text-stone-500">{report.analysis.goldenDeepWard.reason}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* タブ 2: 👑 上位チャンプ深掘り ＆ プール穴診断 */}
          {/* ========================================================================= */}
          {activeTab === 'champions' && selectedChampion && (
            <div className="space-y-6">
              {/* チャンピオンピル選択バー */}
              <div className="flex items-center gap-2 flex-wrap">
                {report.championProfiles?.map((champ: any) => (
                  <button
                    key={champ.id}
                    type="button"
                    onClick={() => setSelectedChampId(champ.id)}
                    className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 border ${
                      selectedChampion.id === champ.id
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'
                    }`}
                  >
                    <span>{champ.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        selectedChampion.id === champ.id
                          ? 'bg-amber-800/80 text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {champ.gamesCount}戦 勝率 {champ.winRate}% (KDA {champ.kda})
                    </span>
                  </button>
                ))}
              </div>

              {/* チャンピオン詳細カード */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-stone-900">{selectedChampion.name}</h3>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        {selectedChampion.powerRating}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 font-medium mt-0.5">
                      実戦サンプル: {selectedChampion.gamesCount}試合 | 分間CS: {selectedChampion.csPerMin} | 平均K/D/A:{' '}
                      {selectedChampion.avgKills} / {selectedChampion.avgDeaths} / {selectedChampion.avgAssists}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-stone-400 font-bold">勝率 / KDA</div>
                      <div className="text-lg font-black text-stone-900 font-mono">
                        {selectedChampion.winRate}%{' '}
                        <span className="text-xs font-normal text-stone-500">({selectedChampion.kda})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. パワースパイク分析 */}
                <div className="space-y-3">
                  <h4 className="font-black text-xs text-stone-900 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-600" />
                    <span>⚡ パワースパイク ＆ 立ち回り時間軸</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                      <div className="text-[11px] font-black text-stone-500">序盤 (Lv1〜5)</div>
                      <p className="text-xs text-stone-800 font-medium leading-relaxed">
                        {selectedChampion.powerSpikes.earlyLvl1to5}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1">
                      <div className="text-[11px] font-black text-amber-900">中盤 (1〜2コア完成時)</div>
                      <p className="text-xs text-stone-900 font-bold leading-relaxed">
                        {selectedChampion.powerSpikes.mid1to2Core}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-1">
                      <div className="text-[11px] font-black text-indigo-900">終盤 (3コア以降 / 集団戦)</div>
                      <p className="text-xs text-stone-900 font-medium leading-relaxed">
                        {selectedChampion.powerSpikes.late3CorePlus}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. 得意・天敵 相性マトリクス */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>カモにできる相手 (有利マッチアップ)</span>
                    </h4>
                    <div className="space-y-2">
                      {selectedChampion.favoredMatchups?.map((fav: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-black text-emerald-950">
                            <span>vs {fav.enemy}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-200/60">
                              有利相性
                            </span>
                          </div>
                          <p className="text-xs text-stone-700 font-medium leading-relaxed">{fav.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-rose-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-rose-600" />
                      <span>天敵・警戒マッチアップ ＆ 対処法</span>
                    </h4>
                    <div className="space-y-2">
                      {selectedChampion.hardMatchups?.map((hard: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-black text-rose-950">
                            <span>vs {hard.enemy}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-100/80 text-rose-800 font-bold border border-rose-200/60">
                              要警戒
                            </span>
                          </div>
                          <p className="text-xs text-stone-700 font-medium leading-relaxed">
                            <strong className="text-rose-900">対策:</strong> {hard.counterPlay}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. 勝利時 vs 敗北時の客観スタッツ差分 */}
                <div className="p-5 rounded-3xl bg-stone-50 border border-stone-200 space-y-3">
                  <h4 className="font-black text-xs text-stone-900 flex items-center gap-1.5">
                    <Swords size={14} className="text-stone-700" />
                    <span>勝利時 vs 敗北時のスタッツ差分（勝敗を分ける境界線）</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">15分CS差</div>
                      <div className="font-black text-stone-900 mt-0.5">
                        {selectedChampion.winVsLossDiffs?.cs15Diff}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">平均被デス</div>
                      <div className="font-black text-stone-900 mt-0.5">
                        {selectedChampion.winVsLossDiffs?.deathsDiff}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">視界・コントロール</div>
                      <div className="font-black text-stone-900 mt-0.5">
                        {selectedChampion.winVsLossDiffs?.visionDiff}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">第1コア完成時間</div>
                      <div className="font-black text-stone-900 mt-0.5">
                        {selectedChampion.winVsLossDiffs?.firstCoreTime}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. AI戦術ガイド */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-2.5">
                  <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-950 font-medium leading-relaxed">
                    <strong className="font-black">専属AI戦術指南:</strong> {selectedChampion.aiTacticsGuide}
                  </div>
                </div>
              </div>

              {/* 🧩 チャンピオン手持ちプール穴診断 */}
              {report.sessionAnalytics?.championPoolDiagnosis && (
                <div className="rounded-3xl border border-indigo-200 bg-white p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <h3 className="font-black text-sm text-indigo-950 flex items-center gap-2">
                      <Puzzle size={16} className="text-indigo-600" />
                      <span>🧩 チャンピオン手持ちプール穴診断 ＆ AI補完処方箋</span>
                    </h3>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                      {report.sessionAnalytics.championPoolDiagnosis.poolArchetype}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-stone-700">
                      <span>手持ちプールの属性バランス:</span>
                      <span>
                        AP {report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}% / AD{' '}
                        {report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}% / タンク{' '}
                        {report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%
                      </span>
                    </div>
                    <div className="h-3.5 w-full rounded-full bg-stone-100 flex overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}%` }}
                        title={`AP比率: ${report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}%`}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}%` }}
                        title={`AD比率: ${report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}%`}
                      />
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%` }}
                        title={`タンク比率: ${report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%`}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                    <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Lightbulb size={15} className="text-indigo-600 shrink-0" />
                      <span>
                        <strong>不足しているピース:</strong> {report.sessionAnalytics.championPoolDiagnosis.missingPiece}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {report.sessionAnalytics.championPoolDiagnosis.recommendedAdditions?.map((rec: any, idx: number) => (
                        <div key={idx} className="p-3.5 bg-white rounded-2xl border border-indigo-200/80 space-y-1 shadow-2xs">
                          <div className="text-xs font-black text-stone-900">{rec.championName}</div>
                          <div className="text-[10px] font-bold text-indigo-700">{rec.archetype}</div>
                          <p className="text-[11px] text-stone-600 font-medium leading-relaxed pt-1 border-t border-stone-100">
                            {rec.synergyReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* タブ 3: 🧠 実測コンディション ＆ ティルト分析 */}
          {/* ========================================================================= */}
          {activeTab === 'session' && report.sessionAnalytics && (
            <div className="space-y-6">
              {/* 1. 時間帯別パフォーマンス */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                    <Clock size={16} className="text-amber-600" />
                    <span>時間帯別勝率カーブ ＆ 集中力ピーク (実測タイムスタンプ集計)</span>
                  </h3>
                  <span className="text-[10px] font-bold text-stone-400">JST実測ログ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.sessionAnalytics.timeOfDayPerformance?.map((slot: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-3xl border space-y-2 ${
                        !slot.hasData
                          ? 'bg-stone-50 border-stone-200 opacity-70'
                          : slot.winRate >= 60
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : slot.winRate <= 45
                          ? 'bg-rose-50/70 border-rose-300'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-stone-900">{slot.label}</div>
                          <div className="text-[11px] font-mono text-stone-500 font-bold mt-0.5">
                            {slot.timeSlot}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-black text-stone-900">
                            {slot.hasData ? `${slot.winRate}%` : '0試合'}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {slot.hasData ? `KDA ${slot.kda} (${slot.gamesCount}戦)` : '直近履歴なし'}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 font-medium leading-relaxed pt-2 border-t border-stone-200/50">
                        {slot.insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 連戦疲労度 ＆ 即キューティルト判定 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
                  <div className="border-b border-stone-100 pb-3">
                    <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                      <Activity size={16} className="text-indigo-600" />
                      <span>連続試合数による疲労度・勝率低下分析 (実測セッション)</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {report.sessionAnalytics.sessionFatigueImpact?.map((f: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border space-y-1.5 ${
                          f.hasData ? 'bg-stone-50 border-stone-200/80' : 'bg-stone-50/60 border-dashed border-stone-200 opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-stone-900 font-black">
                            {f.gameNumberInSession} - {f.label}
                          </span>
                          <span className="font-mono text-stone-800 font-black">
                            {f.hasData ? (
                              <>
                                勝率 {f.winRate}%{' '}
                                <span className="text-[10px] text-stone-400 font-normal">
                                  (平均 {f.avgDeaths}デス / {f.gamesCount}戦)
                                </span>
                              </>
                            ) : (
                              <span className="text-stone-400 font-normal">0試合 (連戦なし・健全)</span>
                            )}
                          </span>
                        </div>
                        {f.hasData && (
                          <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                f.winRate >= 60
                                  ? 'bg-emerald-500'
                                  : f.winRate >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${f.winRate}%` }}
                            />
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[11px]">
                          <span className={f.hasData ? (f.focusScore >= 80 ? 'text-emerald-700 font-black' : f.focusScore >= 60 ? 'text-amber-700 font-bold' : 'text-rose-700 font-bold') : 'text-stone-400'}>
                            {f.hasData ? `集中力スコア: ${f.focusScore}点` : '直近データなし'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            !f.hasData
                              ? 'bg-stone-100 text-stone-500'
                              : f.focusScore >= 80
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : f.focusScore >= 60
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            状態: {f.fatigueLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-xs space-y-4">
                  <div className="border-b border-amber-200/70 pb-3">
                    <h3 className="font-black text-sm text-amber-950 flex items-center gap-2">
                      <Flame size={16} className="text-rose-600" />
                      <span>即キュー・ティルト判定 (実測インターバル)</span>
                    </h3>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-700">負け直後 5分以内即キュー</div>
                      <div className="text-sm font-black font-mono">
                        {report.sessionAnalytics.requeueTiltStats.immediateRequeueGames > 0 ? (
                          <span className={
                            report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate >= 55
                              ? 'text-emerald-600'
                              : report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate >= 45
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }>
                            勝率 {report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate}%{' '}
                            <span className="text-[10px] text-stone-400 font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合)
                            </span>
                          </span>
                        ) : (
                          <span className="text-emerald-700 text-xs font-bold">0試合 (即キューなし・良好)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-700">5分以上休憩後のマッチ</div>
                      <div className="text-sm font-black font-mono">
                        {report.sessionAnalytics.requeueTiltStats.restedRequeueGames > 0 ? (
                          <span className={
                            report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate >= 55
                              ? 'text-emerald-600'
                              : report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate >= 45
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }>
                            勝率 {report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate}%{' '}
                            <span className="text-[10px] text-stone-400 font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.restedRequeueGames}試合)
                            </span>
                          </span>
                        ) : (
                          <span className="text-stone-400 text-xs font-normal">0試合</span>
                        )}
                      </div>
                    </div>
                    {report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent > 0 && (
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-black">
                        <span className="text-amber-900">ティルトによる勝率低下</span>
                        <span className="text-rose-600 bg-rose-100 px-2 py-0.5 rounded font-mono">
                          -{report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent}% ドロップ
                        </span>
                      </div>
                    )}
                    {report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent < 0 && (
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-black">
                        <span className="text-amber-900">即キュー時の勢い維持</span>
                        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                          +{Math.abs(report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent)}% 勝率アップ
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed font-medium bg-white/70 p-3 rounded-xl border border-amber-200/50">
                    💡 <strong>実測インサイト:</strong>{' '}
                    {report.sessionAnalytics.requeueTiltStats.insight ||
                      (report.sessionAnalytics.requeueTiltStats.immediateRequeueGames < 3
                        ? `直近の即キューは${report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合のみとサンプル数が少なく、感情的な連戦を自制できています。`
                        : '敗北後は感情に流されず、冷静にセッションを管理できています。')}
                  </p>
                </div>
              </div>

              {/* 3. 黄金プレイルール */}
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-6 shadow-xs space-y-4">
                <h3 className="font-black text-sm text-indigo-950 flex items-center gap-2">
                  <Award size={16} className="text-indigo-600" />
                  <span>実測データに基づく黄金プレイルール 3箇条</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.sessionAnalytics.goldenSessionRules?.map((rule: string, idx: number) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl border border-indigo-200 space-y-1 shadow-2xs">
                      <div className="text-xs font-bold text-stone-800 leading-relaxed">{rule}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* タブ 4: 🧬 プレイヤー心理DNA ＆ メンタルカルテ (MBTI) */}
          {/* ========================================================================= */}
          {activeTab === 'psychology' && report.sessionAnalytics?.playstyleMbti && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-indigo-300 bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/80 p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-indigo-100 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                      🧬
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono">
                          TYPE: {report.sessionAnalytics.playstyleMbti.typeCode}
                        </span>
                        <h3 className="text-lg md:text-xl font-black text-stone-900">
                          {report.sessionAnalytics.playstyleMbti.typeName}
                        </h3>
                      </div>
                      <p className="text-xs text-indigo-900 font-bold mt-1">
                        {report.sessionAnalytics.playstyleMbti.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-stone-400 font-bold">意思決定DNAアルゴリズム</span>
                    <div className="text-xs font-black text-indigo-700">深層パーソナリティ判定完了</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white border border-indigo-100 space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-stone-800">
                      <span>🛡️ セーフティ計算型 ({report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%)</span>
                      <span className="text-stone-400">ハイリスク型 ({report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.riskPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden flex">
                      <div className="h-full bg-indigo-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%` }} />
                      <div className="h-full bg-rose-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.riskPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-indigo-100 space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-stone-800">
                      <span>🌾 自己スケール重視 ({report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.scalePercent}%)</span>
                      <span className="text-stone-400">献身サポート ({report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.enablerPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden flex">
                      <div className="h-full bg-amber-500" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.scalePercent}%` }} />
                      <div className="h-full bg-emerald-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.enablerPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-indigo-100 space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-stone-800">
                      <span>🏰 自陣テリトリー防衛 ({report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.guardianPercent}%)</span>
                      <span className="text-stone-400">敵陣侵略 ({report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.invaderPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.guardianPercent}%` }} />
                      <div className="h-full bg-rose-500" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.invaderPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-indigo-100 space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-stone-800">
                      <span>🧠 慎重観察型 ({report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.deliberatePercent}%)</span>
                      <span className="text-stone-400">直感即断型 ({report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.reflexPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden flex">
                      <div className="h-full bg-purple-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.deliberatePercent}%` }} />
                      <div className="h-full bg-orange-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.reflexPercent}%` }} />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-700 leading-relaxed font-medium bg-white/90 p-4 rounded-2xl border border-indigo-100">
                  {report.sessionAnalytics.playstyleMbti.personalityAnalysis}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.sessionAnalytics.tiltTriggerMatrix && (
                  <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-rose-200 pb-3">
                      <h4 className="font-black text-xs text-rose-950 flex items-center gap-1.5">
                        <Flame size={15} className="text-rose-600" />
                        <span>メンタル耐久度 ＆ ティルト誘発トリガー</span>
                      </h4>
                      <span className="text-xs font-black text-rose-700 font-mono">
                        耐性指数: {report.sessionAnalytics.tiltTriggerMatrix.mentalResilienceScore}点
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-stone-800">
                      <div className="p-3 bg-white rounded-2xl border border-rose-100 space-y-1">
                        <div className="text-[10px] text-stone-400 font-bold">自陣インベード荒らし耐性</div>
                        <div className="font-bold text-stone-900">{report.sessionAnalytics.tiltTriggerMatrix.invadeResistanceRating}</div>
                      </div>
                      <div className="p-3 bg-white rounded-2xl border border-rose-100 space-y-1">
                        <div className="text-[10px] text-stone-400 font-bold">味方序盤崩壊時のメンタル</div>
                        <div className="font-bold text-stone-900">{report.sessionAnalytics.tiltTriggerMatrix.teammateDeathResistance}</div>
                      </div>
                      <div className="p-3 bg-white rounded-2xl border border-rose-100 space-y-1">
                        <div className="text-[10px] text-stone-400 font-bold">雪だるま連続デス防止率</div>
                        <div className="font-bold text-emerald-700">
                          {report.sessionAnalytics.tiltTriggerMatrix.snowballDeathAvoidanceRate}% (デス後も冷静さを維持)
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                      💡 {report.sessionAnalytics.tiltTriggerMatrix.tiltInsight}
                    </p>
                  </div>
                )}

                {report.sessionAnalytics.goldEfficiency && (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                      <h4 className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                        <Coins size={15} className="text-amber-600" />
                        <span>銭勘定 ＆ ゴールド変換効率 (Gold-to-Impact)</span>
                      </h4>
                      <span className="text-xs font-black text-amber-900">
                        {report.sessionAnalytics.goldEfficiency.damagePerGoldRating}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-stone-800">
                      <div className="p-3 bg-white rounded-2xl border border-amber-100 space-y-1">
                        <div className="text-[10px] text-stone-400 font-bold">ゴールド死蔵率 (リコール遅延)</div>
                        <div className="font-bold text-stone-900">{report.sessionAnalytics.goldEfficiency.goldStashRating}</div>
                      </div>
                      <div className="p-3 bg-white rounded-2xl border border-amber-100 space-y-1">
                        <div className="text-[10px] text-stone-400 font-bold">1コア完成直後のアクション率</div>
                        <div className="font-bold text-amber-800">
                          {report.sessionAnalytics.goldEfficiency.spikeUtilizationPercent}% (完成直後に即戦力化)
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-700 leading-relaxed font-medium bg-white p-3 rounded-2xl border border-amber-200/80">
                      {report.sessionAnalytics.goldEfficiency.efficiencyVerdict}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.sessionAnalytics.adversityBehavior && (
                  <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h4 className="font-black text-xs text-stone-900 flex items-center gap-1.5">
                        <ShieldAlert size={15} className="text-indigo-600" />
                        <span>逆境・ビハインド時の人間性</span>
                      </h4>
                      <span className="text-xs font-black text-indigo-700">
                        逆境勝率 {report.sessionAnalytics.adversityBehavior.behindComebackWinRate}%
                      </span>
                    </div>

                    <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-1">
                      <div className="text-xs font-black text-indigo-950">
                        行動タイプ: {report.sessionAnalytics.adversityBehavior.archetype}
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-medium">
                        {report.sessionAnalytics.adversityBehavior.behaviorVerdict}
                      </p>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed font-medium">
                      🎯 <strong>逆転の鍵:</strong> {report.sessionAnalytics.adversityBehavior.recommendedMindset}
                    </p>
                  </div>
                )}

                {report.sessionAnalytics.cognitiveBiases && (
                  <div className="rounded-3xl border border-purple-200 bg-purple-50/60 p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                      <h4 className="font-black text-xs text-purple-950 flex items-center gap-1.5">
                        <AlertOctagon size={15} className="text-purple-600" />
                        <span>無意識の悪癖・認知バイアス特定</span>
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-white rounded-2xl border border-purple-100">
                        <div className="font-bold text-stone-900">{report.sessionAnalytics.cognitiveBiases.recallHabitBias}</div>
                      </div>
                      <div className="p-3 bg-white rounded-2xl border border-purple-100">
                        <div className="font-bold text-stone-900">{report.sessionAnalytics.cognitiveBiases.mapAttentionBias}</div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-purple-200 space-y-1">
                      <div className="text-xs font-black text-purple-950 flex items-center gap-1">
                        <Sparkles size={13} className="text-purple-600" />
                        <span>矯正処方箋:</span>
                      </div>
                      <p className="text-xs text-stone-800 leading-relaxed font-bold">
                        {report.sessionAnalytics.cognitiveBiases.actionPrescription}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
