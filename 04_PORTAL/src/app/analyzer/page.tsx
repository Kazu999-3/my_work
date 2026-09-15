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
  Compass,
  MapPin,
  RefreshCw,
  Award,
  Layers,
  HelpCircle,
} from 'lucide-react';

export default function PlayerAnalyzerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [gameName, setGameName] = useState('Kazurin');
  const [tagLine, setTagLine] = useState('4036');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');

  // 認証チェック
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
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
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
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

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 text-xs font-black border border-amber-500/30">
            <Globe size={14} className="text-amber-600" />
            マルチ分析サイト統合エンジン
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
            プレイヤー深層統合アナライザー (Universal Intel Hub)
          </h1>
          <p className="text-stone-700 text-xs md:text-sm max-w-3xl font-medium leading-relaxed">
            <strong>your.gg / OP.GG / League of Graphs / Riot API</strong> の各客観データを自動収集・統合！<br className="hidden sm:inline" />
            プレイスタイル5大レーダー、視界侵入深度、最大の敗因ボトルネック、次戦の克服アクションを決定版レポートとして集約します。
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

          {/* 2. 2カラム統合HUDグリッド */}
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
                        {report.metrics.survival.score}点 <span className="text-[10px] text-emerald-600 font-normal">(上位{report.metrics.survival.percentile}% / 平均被デス {report.metrics.survival.avgDeaths})</span>
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
                        {report.metrics.farm.score}点 <span className="text-[10px] text-sky-600 font-normal">(上位{report.metrics.farm.percentile}% / +{report.metrics.farm.csd15} CS)</span>
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
        </div>
      )}
    </div>
  );
}
