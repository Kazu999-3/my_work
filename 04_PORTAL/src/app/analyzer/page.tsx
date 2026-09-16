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
  const [summonerInput, setSummonerInput] = useState('Kazurin#4036');
  const [queueType, setQueueType] = useState<'solo' | 'all'>('solo');
  const [targetTier, setTargetTier] = useState<string>('Emerald IV');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'champions' | 'session' | 'psychology'>('overview');
  const [selectedChampId, setSelectedChampId] = useState<string>('');

  // サモナー名とタグのパース
  const parseSummonerInput = (raw: string) => {
    const parts = raw.trim().split('#');
    const name = parts[0]?.trim() || '';
    const tag = parts[1]?.trim() || (name.toLowerCase() === 'kazurin' ? '4036' : 'JP1');
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
    targetQ?: 'solo' | 'all',
    targetT?: string
  ) => {
    const raw = targetRawInput !== undefined ? targetRawInput : summonerInput;
    const { name, tag } = parseSummonerInput(raw);
    const q = targetQ !== undefined ? targetQ : queueType;
    const tier = targetT !== undefined ? targetT : targetTier;

    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyzer/deep-intel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameName: name, tagLine: tag, queueType: q, targetTier: tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析に失敗しました');
      setReport(data.report);
      if (data.report?.championProfiles?.length > 0) {
        setSelectedChampId(data.report.championProfiles[0].id);
      }
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード時に自動読み込み
  useEffect(() => {
    if (isAuthenticated) {
      handleRunAnalysis('Kazurin#4036', 'solo', 'Emerald IV');
    }
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3 font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-amber-600" />
        <p className="text-xs font-bold text-stone-500">認証ステータスを確認中...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-stone-50">
        <div className="text-center max-w-sm rounded-3xl border border-stone-200/90 bg-white p-8 shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl mx-auto shadow-2xs">
            🔑
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-900 mb-1.5">管理者認証が必要です</h2>
            <p className="text-xs text-stone-500 leading-relaxed font-medium">
              プレイヤー深層アナライザー (Universal Deep Intel Hub) は管理者専用です。管理者パスコードまたはDiscord管理者アカウントでログインしてください。
            </p>
          </div>
          <a
            href="/login"
            className="inline-block w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-xs transition"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  const selectedChampion =
    report?.championProfiles?.find((c: any) => c.id === selectedChampId) || report?.championProfiles?.[0];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 text-xs font-black border border-amber-500/30">
            <Globe size={14} className="text-amber-600" />
            目標ランク逆算 ＆ リアルタイム実測マッチ解析エンジン
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
            プレイヤー深層統合アナライザー (Universal Deep Intel Hub)
          </h1>
          <p className="text-stone-700 text-xs md:text-sm max-w-3xl font-medium leading-relaxed">
            現状維持の比較ではなく、<strong>「目標ランク（ゴールド / プラチナ / エメラルド）」</strong>の基準値とのスタッツ差分（ギャップ）を逆算診断！<br className="hidden sm:inline" />
            ソロQ実測マッチ・タイムスタンプ連動により、昇格のために変えるべき急所アクションを完全可視化します。
          </p>
        </div>
      </div>

      {/* 検索・条件設定コントロールバー */}
      <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-5 md:p-6 shadow-xs space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis();
          }}
          className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3"
        >
          {/* サモナー名#タグ 統合入力ボックス */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={summonerInput}
              onChange={(e) => setSummonerInput(e.target.value)}
              placeholder="サモナー名#タグ (例: Kazurin#4036, Hide on bush#KR1, Agurin#EUW)"
              className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
          </div>

          {/* キュー選択トグル */}
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                setQueueType('solo');
                handleRunAnalysis(summonerInput, 'solo', targetTier);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                queueType === 'solo'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🎯 ソロQのみ
            </button>
            <button
              type="button"
              onClick={() => {
                setQueueType('all');
                handleRunAnalysis(summonerInput, 'all', targetTier);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                queueType === 'all'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🌐 全試合 (含むノーマル)
            </button>
          </div>

          {/* 目標ランクセレクター */}
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-2xl border border-stone-200 shrink-0">
            <span className="text-[11px] font-bold text-stone-400">目標:</span>
            <select
              value={targetTier}
              onChange={(e) => {
                setTargetTier(e.target.value);
                handleRunAnalysis(summonerInput, queueType, e.target.value);
              }}
              className="bg-transparent text-xs font-black text-stone-900 focus:outline-none cursor-pointer"
            >
              <option value="Gold IV">🥇 Gold IV (ゴールド)</option>
              <option value="Platinum IV">🥈 Platinum IV (プラチナ)</option>
              <option value="Emerald IV">💎 Emerald IV (エメラルド / 推奨)</option>
            </select>
          </div>

          {/* 実行ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs rounded-2xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 hover:scale-105"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>実測解析中...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>⚡ 実測深層解析</span>
              </>
            )}
          </button>
        </form>

        {/* クイック選択 */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1 border-t border-stone-100">
          <span className="text-stone-400 font-bold">サンプル分析:</span>
          {[
            { raw: 'Kazurin#4036', label: 'Kazurin#4036' },
            { raw: 'Hide on bush#KR1', label: 'Faker (KR1)' },
            { raw: 'Agurin#EUW', label: 'Agurin (EUW)' },
          ].map((p) => (
            <button
              key={p.raw}
              type="button"
              onClick={() => {
                setSummonerInput(p.raw);
                handleRunAnalysis(p.raw, queueType, targetTier);
              }}
              className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-amber-100/80 hover:text-amber-900 text-stone-700 font-bold border border-stone-200/80 transition cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
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
                      Riot API実測 {report.summoner.sampleMatchesCount}試合連動 ({queueType === 'solo' ? 'ソロQ' : '全試合'})
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
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                      <PieChart size={16} className="text-amber-600" />
                      <span>⚖️ 試合展開4タイプ自動分類 (Carry vs ACE Loss Index)</span>
                    </h3>
                    <span className="text-[10px] font-bold text-stone-400">実戦ログ分類</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1">
                      <div className="text-[10px] font-black text-amber-900">👑 ハードキャリー勝利</div>
                      <div className="text-lg font-black text-amber-950 font-mono">
                        {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.percent}%{' '}
                        <span className="text-[10px] font-normal">({report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count}戦)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                      <div className="text-[10px] font-black text-emerald-900">🛡️ チーム協調勝利</div>
                      <div className="text-lg font-black text-emerald-950 font-mono">
                        {report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.percent}%{' '}
                        <span className="text-[10px] font-normal">({report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count}戦)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-1">
                      <div className="text-[10px] font-black text-indigo-900">😭 エース敗北 (味方崩壊型)</div>
                      <div className="text-lg font-black text-indigo-950 font-mono">
                        {report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.percent}%{' '}
                        <span className="text-[10px] font-normal">({report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count}戦)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-1">
                      <div className="text-[10px] font-black text-rose-900">⚠️ 集団戦・逆転負け</div>
                      <div className="text-lg font-black text-rose-950 font-mono">
                        {report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.percent}%{' '}
                        <span className="text-[10px] font-normal">({report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}戦)</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed font-medium bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                    💡 <strong>展開診断:</strong> {report.sessionAnalytics.gameOutcomeBreakdown.dominantOutcomeSummary}
                  </p>
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
                      {/* 軸① */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-emerald-700 flex items-center gap-1">
                            <Shield size={13} />{' '}
                            {report.sessionAnalytics?.roleConfig?.radarLabels?.[0] || '① 生存率・デス回避'}
                          </span>
                          <span className="text-stone-900 font-black">
                            {report.metrics.survival.score}点{' '}
                            <span className="text-[10px] text-emerald-600 font-normal">
                              (平均被デス {report.metrics.survival.avgDeaths})
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${report.metrics.survival.score}%` }}
                          />
                        </div>
                      </div>

                      {/* 軸② */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-sky-700 flex items-center gap-1">
                            <Zap size={13} />{' '}
                            {report.sessionAnalytics?.roleConfig?.radarLabels?.[1] || '② ファーム効率 ＆ リソース確保'}
                          </span>
                          <span className="text-stone-900 font-black">
                            {report.metrics.farm.score}点{' '}
                            <span className="text-[10px] text-sky-600 font-normal">
                              (分間CS {report.metrics.farm.csPerMin})
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{ width: `${report.metrics.farm.score}%` }}
                          />
                        </div>
                      </div>

                      {/* 軸③ */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-rose-700 flex items-center gap-1">
                            <AlertTriangle size={13} />{' '}
                            {report.sessionAnalytics?.roleConfig?.radarLabels?.[2] || '③ キル関与率 (KP)'}
                            {report.metrics.combat.score < 50 && (
                              <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-black">
                                改善余地あり
                              </span>
                            )}
                          </span>
                          <span className="text-rose-600 font-black">
                            {report.metrics.combat.score}点{' '}
                            <span className="text-[10px] font-normal">({report.metrics.combat.kpPercent}%)</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${report.metrics.combat.score}%` }}
                          />
                        </div>
                      </div>

                      {/* 軸④ */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-amber-700 flex items-center gap-1">
                            <Target size={13} />{' '}
                            {report.sessionAnalytics?.roleConfig?.radarLabels?.[3] || '④ オブジェクト確保 (Obj Control)'}
                          </span>
                          <span className="text-stone-900 font-black">
                            {report.metrics.objectives.score}点{' '}
                            <span className="text-[10px] text-amber-700 font-normal">(安定水準)</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${report.metrics.objectives.score}%` }}
                          />
                        </div>
                      </div>

                      {/* 軸⑤ */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-indigo-700 flex items-center gap-1">
                            <Crosshair size={13} />{' '}
                            {report.sessionAnalytics?.roleConfig?.radarLabels?.[4] || '⑤ 集団戦ポジショニング (Teamfight)'}
                          </span>
                          <span className="text-stone-900 font-black">
                            {report.metrics.teamfight.score}点{' '}
                            <span className="text-[10px] text-indigo-600 font-normal">
                              (KDA {report.metrics.teamfight.avgKda})
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${report.metrics.teamfight.score}%` }}
                          />
                        </div>
                      </div>
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
                            <span>グラブ獲得時勝率:</span>
                            <span className="font-mono text-emerald-700">
                              {report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-100 font-medium">
                            {report.sessionAnalytics.earlyTimelineImpact.plateGoldImpact}
                          </div>
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
                            <span className="font-mono text-emerald-700 font-bold">勝率 {fav.winRate}%</span>
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
                            <span className="font-mono text-rose-700 font-bold">勝率 {hard.winRate}%</span>
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
                        <div className="flex justify-between text-[10px] text-stone-500">
                          <span>{f.hasData ? `集中力スコア: ${f.focusScore}点` : '直近データなし'}</span>
                          <span>状態: {f.fatigueLevel}</span>
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
                      <div className="text-sm font-black text-rose-600 font-mono">
                        {report.sessionAnalytics.requeueTiltStats.immediateRequeueGames > 0 ? (
                          <>
                            勝率 {report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate}%{' '}
                            <span className="text-[10px] text-stone-400 font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合)
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-700 text-xs font-bold">0試合 (即キューなし・良好)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-700">5分以上休憩後のマッチ</div>
                      <div className="text-sm font-black text-emerald-600 font-mono">
                        {report.sessionAnalytics.requeueTiltStats.restedRequeueGames > 0 ? (
                          <>
                            勝率 {report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate}%{' '}
                            <span className="text-[10px] text-stone-400 font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.restedRequeueGames}試合)
                            </span>
                          </>
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
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed font-medium">
                    負けた直後は無意識に焦りや苛立ちが残り、マップ確認の頻度が低下します。
                    <strong>「負けたら必ず5分席を外す」</strong>だけで勝率が大幅に改善します。
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
