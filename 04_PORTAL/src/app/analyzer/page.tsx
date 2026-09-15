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
} from 'lucide-react';

export default function PlayerAnalyzerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [gameName, setGameName] = useState('Kazurin');
  const [tagLine, setTagLine] = useState('4036');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'champions' | 'session'>('overview');
  const [selectedChampId, setSelectedChampId] = useState<string>('Zyra');

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
  const handleRunAnalysis = async (targetName?: string, targetTag?: string) => {
    const n = targetName !== undefined ? targetName : gameName;
    const t = targetTag !== undefined ? targetTag : tagLine;

    if (!n.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyzer/deep-intel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameName: n, tagLine: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析に失敗しました');
      setReport(data.report);
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード時に Kazurin#4036 の統合レポートを自動読み込み
  useEffect(() => {
    if (isAuthenticated) {
      handleRunAnalysis('Kazurin', '4036');
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
              プレイヤー深層アナライザー (Deep Intel Hub) は管理者専用です。管理者パスコードまたはDiscord管理者アカウントでログインしてください。
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

  const selectedChampion = report?.championProfiles?.find((c: any) => c.id === selectedChampId) || report?.championProfiles?.[0];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 text-xs font-black border border-amber-500/30">
            <Globe size={14} className="text-amber-600" />
            マルチ分析サイト統合エンジン (your.gg ＆ League of Graphs 連動)
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
            プレイヤー深層統合アナライザー (Deep Intel Hub)
          </h1>
          <p className="text-stone-700 text-xs md:text-sm max-w-3xl font-medium leading-relaxed">
            <strong>your.gg / OP.GG / League of Graphs / Riot API</strong> の各客観データを自動収集・統合！<br className="hidden sm:inline" />
            5大レーダー解析、チャンピオン相性・パワースパイク深掘り、プレイ時間帯・連戦疲労度・即キューティルト判定までを一画面に集約します。
          </p>
        </div>
      </div>

      {/* 検索・解析バー */}
      <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-5 md:p-6 shadow-xs space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="サモナー名 / Riot ID (例: Kazurin)"
              className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-28 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 text-xs font-mono font-bold">
                #
              </span>
              <input
                type="text"
                value={tagLine}
                onChange={(e) => setTagLine(e.target.value)}
                placeholder="タグ (4036)"
                className="w-full pl-7 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-mono font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs rounded-2xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 hover:scale-105"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>各サイトデータ統合中...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>⚡ 統合深層解析を実行</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* クイック選択 */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1 border-t border-stone-100">
          <span className="text-stone-400 font-bold">クイック分析:</span>
          {[
            { name: 'Kazurin', tag: '4036', label: 'Kazurin#4036 (JG)' },
            { name: 'Hide on bush', tag: 'KR1', label: 'Faker (KR1)' },
            { name: 'Agurin', tag: 'EUW', label: 'Agurin (EUW)' },
          ].map((p) => (
            <button
              key={p.name + p.tag}
              type="button"
              onClick={() => {
                setGameName(p.name);
                setTagLine(p.tag);
                handleRunAnalysis(p.name, p.tag);
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
                    {report.summoner.tier}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    {report.summoner.role} メイン
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-2 mt-1">
                  <span>タイプ: <strong>{report.analysis.styleTypeName}</strong></span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {report.analysis.styleBadge}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-stone-400 font-mono">
                統合データソース: your.gg / OP.GG / League of Graphs
              </div>
              <div className="text-xs font-bold text-stone-600 mt-0.5">
                AI総合解析完了 (リアルタイム)
              </div>
            </div>
          </div>

          {/* ナビゲーションタブ */}
          <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
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
              <span>1. 📊 5大レーダー ＆ 客観スタッツ統合</span>
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
              <span>2. 👑 チャンピオン別深掘りドリルダウン</span>
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
              <span>3. 🧠 ゲーム外・コンディション分析</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* タブ 1: 📊 5大レーダー ＆ 客観スタッツ統合 */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 左側 (7カラム): 5大レーダー ＆ 視界客観データ */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* 5大レーダー解析スコアカード */}
                <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                      <TrendingUp size={16} className="text-amber-600" />
                      <span>プレイスタイル 5大レーダー客観解析</span>
                    </h3>
                    <span className="text-[10px] font-bold text-stone-400">
                      your.gg 同ランク帯比較
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* 生存率 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Shield size={13} /> ① 生存率・デス回避
                        </span>
                        <span className="text-stone-900 font-black">
                          {report.metrics.survival.score}点{' '}
                          <span className="text-[10px] text-emerald-600 font-normal">
                            (上位{report.metrics.survival.percentile}% / 平均被デス {report.metrics.survival.avgDeaths})
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${report.metrics.survival.score}%` }} />
                      </div>
                    </div>

                    {/* 15分CSリード */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-sky-700 flex items-center gap-1">
                          <Zap size={13} /> ② 15分CSリード (CSD@15)
                        </span>
                        <span className="text-stone-900 font-black">
                          {report.metrics.farm.score}点{' '}
                          <span className="text-[10px] text-sky-600 font-normal">
                            (上位{report.metrics.farm.percentile}% / +{report.metrics.farm.csd15} CS)
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${report.metrics.farm.score}%` }} />
                      </div>
                    </div>

                    {/* 15分キル関与 (ボトルネック) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-rose-700 flex items-center gap-1">
                          <AlertTriangle size={13} /> ③ 15分キル関与 (KP@15)
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-black">最重要課題</span>
                        </span>
                        <span className="text-rose-600 font-black">
                          {report.metrics.combat.score}点 <span className="text-[10px] font-normal">(下位3% / {report.metrics.combat.kp15}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${report.metrics.combat.score}%` }} />
                      </div>
                    </div>

                    {/* オブジェクト確保 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-amber-700 flex items-center gap-1">
                          <Target size={13} /> ④ オブジェクト確保 (Obj Control)
                        </span>
                        <span className="text-stone-900 font-black">
                          {report.metrics.objectives.score}点 <span className="text-[10px] text-amber-700 font-normal">(安定水準)</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${report.metrics.objectives.score}%` }} />
                      </div>
                    </div>

                    {/* 集団戦ポジショニング */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-indigo-700 flex items-center gap-1">
                          <Crosshair size={13} /> ⑤ 集団戦ポジショニング (Teamfight)
                        </span>
                        <span className="text-stone-900 font-black">
                          {report.metrics.teamfight.score}点 <span className="text-[10px] text-indigo-600 font-normal">(KDA {report.metrics.teamfight.avgKda})</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${report.metrics.teamfight.score}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 視界客観データ ＆ 侵入深度バランス */}
                <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                      <Eye size={16} className="text-indigo-600" />
                      <span>視界・コントロール客観解析 (League of Graphs連動)</span>
                    </h3>
                    <span className="text-xs font-black text-indigo-700">
                      分間視界 {report.metrics.vision.visionScorePerMin}/分 (上位{report.metrics.vision.percentile}%)
                    </span>
                  </div>

                  {/* 視界スプリットバー */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-stone-700">
                      <span>視界侵入深度バランス:</span>
                      <span>自陣防衛 {report.metrics.vision.defensiveWardPercent}% / 敵陣ディープ {report.metrics.vision.deepWardPercent}%</span>
                    </div>
                    <div className="h-3.5 w-full rounded-full bg-stone-100 flex overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${report.metrics.vision.defensiveWardPercent}%` }}
                        title={`自陣・リバー防衛視界: ${report.metrics.vision.defensiveWardPercent}%`}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${report.metrics.vision.deepWardPercent}%` }}
                        title={`敵陣ディープ視界: ${report.metrics.vision.deepWardPercent}%`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-emerald-700">🛡️ 自陣防衛 ({report.metrics.vision.defensiveWardPercent}%) - 低被デスの源泉</span>
                      <span className="text-amber-700">⚡ 敵陣ディープ ({report.metrics.vision.deepWardPercent}%) - 今後の伸び代</span>
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
                    <span>客観データから導かれた「3大強み」</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-stone-700 font-medium">
                    {report.analysis.strengths.map((s: string, idx: number) => (
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
                    <span>最大の敗因ボトルネック（典型的負け筋）</span>
                  </div>
                  <p className="text-xs text-stone-800 leading-relaxed font-medium bg-white p-3 rounded-2xl border border-amber-200">
                    {report.analysis.coreBottleNeck}
                  </p>
                </div>

                {/* 決定版・次戦の具体的急所アクション */}
                <div className="rounded-3xl border border-indigo-300 bg-indigo-50/80 p-5 shadow-xs space-y-3">
                  <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>勝率を跳ね上げる「決定版アクション」</span>
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
          )}

          {/* ========================================================================= */}
          {/* タブ 2: 👑 チャンピオン別深掘りドリルダウン */}
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
                      selectedChampId === champ.id
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'
                    }`}
                  >
                    <span>{champ.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        selectedChampId === champ.id ? 'bg-amber-800/80 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      勝率 {champ.winRate}% (KDA {champ.kda})
                    </span>
                  </button>
                ))}
              </div>

              {/* チャンピオン詳細カード */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 md:p-8 shadow-xs space-y-6">
                {/* チャンピオンヘッダー */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-stone-900">{selectedChampion.name}</h3>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        {selectedChampion.powerRating}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 font-medium mt-0.5">
                      実戦サンプル: {selectedChampion.gamesCount}試合 | 分間CS: {selectedChampion.csPerMin} | 平均K/D/A: {selectedChampion.avgKills} / {selectedChampion.avgDeaths} / {selectedChampion.avgAssists}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-stone-400 font-bold">勝率 / KDA</div>
                      <div className="text-lg font-black text-stone-900 font-mono">
                        {selectedChampion.winRate}% <span className="text-xs font-normal text-stone-500">({selectedChampion.kda})</span>
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
                  {/* 得意な相手 */}
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>カモにできる相手 (有利マッチアップ)</span>
                    </h4>
                    <div className="space-y-2">
                      {selectedChampion.favoredMatchups.map((fav: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                          <div className="flex justify-between items-center text-xs font-black text-emerald-950">
                            <span>vs {fav.enemy}</span>
                            <span className="font-mono text-emerald-700 font-bold">勝率 {fav.winRate}%</span>
                          </div>
                          <p className="text-xs text-stone-700 font-medium leading-relaxed">{fav.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 苦手な相手・天敵 */}
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-rose-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-rose-600" />
                      <span>天敵・警戒マッチアップ ＆ 対処法</span>
                    </h4>
                    <div className="space-y-2">
                      {selectedChampion.hardMatchups.map((hard: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-1">
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
                      <div className="font-black text-stone-900 mt-0.5">{selectedChampion.winVsLossDiffs.cs15Diff}</div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">平均被デス</div>
                      <div className="font-black text-stone-900 mt-0.5">{selectedChampion.winVsLossDiffs.deathsDiff}</div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">視界・コントロール</div>
                      <div className="font-black text-stone-900 mt-0.5">{selectedChampion.winVsLossDiffs.visionDiff}</div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-200/80">
                      <div className="text-[10px] text-stone-400 font-bold">第1コア完成時間</div>
                      <div className="font-black text-stone-900 mt-0.5">{selectedChampion.winVsLossDiffs.firstCoreTime}</div>
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* タブ 3: 🧠 ゲーム外・コンディション分析 */}
          {/* ========================================================================= */}
          {activeTab === 'session' && report.sessionAnalytics && (
            <div className="space-y-6">
              {/* 1. 時間帯別パフォーマンス */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                    <Clock size={16} className="text-amber-600" />
                    <span>時間帯別勝率カーブ ＆ 集中力ピーク</span>
                  </h3>
                  <span className="text-[10px] font-bold text-stone-400">実戦ログ統計</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.sessionAnalytics.timeOfDayPerformance.map((slot: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-3xl border space-y-2 ${
                        slot.winRate >= 60
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : slot.winRate <= 45
                          ? 'bg-rose-50/70 border-rose-300'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-stone-900">{slot.label}</div>
                          <div className="text-[11px] font-mono text-stone-500 font-bold mt-0.5">{slot.timeSlot}</div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-black text-stone-900">{slot.winRate}%</div>
                          <div className="text-[10px] text-stone-500">KDA {slot.kda} ({slot.gamesCount}戦)</div>
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
                {/* 連戦疲労度 (7カラム) */}
                <div className="lg:col-span-7 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
                  <div className="border-b border-stone-100 pb-3">
                    <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                      <Activity size={16} className="text-indigo-600" />
                      <span>連続試合数による疲労度・勝率低下分析</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {report.sessionAnalytics.sessionFatigueImpact.map((f: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-stone-900 font-black">{f.gameNumberInSession} - {f.label}</span>
                          <span className="font-mono text-stone-800 font-black">
                            勝率 {f.winRate}% <span className="text-[10px] text-stone-400 font-normal">(平均 {f.avgDeaths}デス)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              f.winRate >= 60 ? 'bg-emerald-500' : f.winRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${f.winRate}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-500">
                          <span>集中力スコア: {f.focusScore}点</span>
                          <span>疲労判定: {f.fatigueLevel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 即キュー vs 休憩後勝率 (5カラム) */}
                <div className="lg:col-span-5 rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-xs space-y-4">
                  <div className="border-b border-amber-200/70 pb-3">
                    <h3 className="font-black text-sm text-amber-950 flex items-center gap-2">
                      <Flame size={16} className="text-rose-600" />
                      <span>即キュー・ティルト判定 (Tilt Detector)</span>
                    </h3>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-700">負け直後 1分以内即キュー</div>
                      <div className="text-sm font-black text-rose-600 font-mono">
                        勝率 {report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate}%
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-700">5分以上休憩後のマッチ</div>
                      <div className="text-sm font-black text-emerald-600 font-mono">
                        勝率 {report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate}%
                      </div>
                    </div>
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-black">
                      <span className="text-amber-900">ティルトによる勝率低下</span>
                      <span className="text-rose-600 bg-rose-100 px-2 py-0.5 rounded font-mono">
                        -{report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent}% ドロップ
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed font-medium">
                    負けた直後は無意識に焦りや苛立ちが残り、マップ確認の頻度が低下します。<strong>「負けたら必ず5分席を外す」</strong>だけで勝率が+24%回復します。
                  </p>
                </div>
              </div>

              {/* 3. 黄金プレイルール ＆ 曜日別傾向 */}
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-6 shadow-xs space-y-4">
                <h3 className="font-black text-sm text-indigo-950 flex items-center gap-2">
                  <Award size={16} className="text-indigo-600" />
                  <span>パーソナル黄金プレイルール 3箇条（勝率最大化）</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.sessionAnalytics.goldenSessionRules.map((rule: string, idx: number) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl border border-indigo-200 space-y-1 shadow-2xs">
                      <div className="text-xs font-bold text-stone-800 leading-relaxed">{rule}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
