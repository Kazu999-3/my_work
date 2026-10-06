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
import { PlayerCompareView } from './PlayerCompareView';

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
          {/* サモナー検索バー ＆ 条件指定 */}
          <div className="rounded-3xl border border-border bg-surface p-4 md:p-5 shadow-xs space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis();
          }}
          className="flex flex-col md:flex-row items-stretch md:items-center gap-3"
        >
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={summonerInput}
              onChange={(e) => setSummonerInput(e.target.value)}
              placeholder="サモナー名#タグ (例: Kazurin#4036, yukizo#7867, Hide on bush#KR1)"
              className="w-full pl-10 pr-3 py-2.5 bg-background border border-border rounded-2xl text-xs font-bold text-foreground placeholder:text-faint focus:outline-none focus:border-primary-edge-strong focus:bg-surface transition"
            />
          </div>

          {/* 目標ランクセレクター */}
          <div className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-2xl border border-border shrink-0">
            <span className="text-[11px] font-bold text-faint">目標:</span>
            <select
              value={targetTier}
              onChange={(e) => {
                setTargetTier(e.target.value);
                handleRunAnalysis(summonerInput, e.target.value);
              }}
              className="bg-transparent text-xs font-black text-foreground focus:outline-none cursor-pointer"
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
            className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-black text-xs rounded-2xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
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
              <span className="text-muted-strong font-bold flex items-center gap-1">
                <Clock size={12} className="text-primary-600" />
                <span>最近検索したサモナー:</span>
              </span>
              {recentSearches.map((rec) => (
                <div
                  key={rec}
                  onClick={() => {
                    setSummonerInput(rec);
                    handleRunAnalysis(rec, targetTier);
                  }}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-950 font-bold border border-primary-edge-soft/80 transition cursor-pointer shadow-2xs"
                >
                  <span>{rec}</span>
                  <button
                    type="button"
                    onClick={(e) => removeRecentSearch(e, rec)}
                    className="text-faint hover:text-danger-600 transition p-0.5 rounded-full hover:bg-surface/80"
                    title="履歴から削除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={clearAllRecents}
                className="text-[10px] text-faint hover:text-danger-600 transition underline cursor-pointer ml-1"
              >
                履歴クリア
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-faint font-bold">サンプル候補:</span>
            <span className="text-faint">（JP鯖のみ対応）</span>
            {/* ⚠️ 2026-09-23: 以前は Faker(KR1) / Agurin(EUW) をサンプルに出していたが、
                アカウント検索と試合一覧は asia ルーティング（lib/riot.ts の RIOT_API_BASE_ASIA）、
                ランク・マスタリー等は jp1 固定（RIOT_API_BASE_JP）のため、
                **JP鯖以外のプレイヤーは名前が引けてもランク情報が取れない**。
                誤解を招くのでJP鯖のサンプルだけに絞った。 */}
            {[
              { raw: 'Kazurin#4036', label: 'Kazurin#4036 (JG)' },
              { raw: 'yukizo#7867', label: 'yukizo#7867 (SUP)' },
            ].map((p) => (
              <button
                key={p.raw}
                type="button"
                onClick={() => {
                  setSummonerInput(p.raw);
                  handleRunAnalysis(p.raw, targetTier);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-surface-subtle hover:bg-surface-hover text-muted hover:text-foreground font-medium text-[10.5px] border border-border/70 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-edge-soft text-danger-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 未検索時のウェルカム・ガイド表示 */}
      {!report && !loading && !error && (
        <div className="rounded-3xl border border-border bg-surface p-8 md:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-primary-50 border border-primary-edge-soft text-primary-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔍
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-black text-foreground">
              サモナー名を入力して深層アナライズを開始
            </h3>
            <p className="text-xs text-muted-strong font-medium leading-relaxed">
              上の検索バーに「サモナー名#タグ」を入力して実行してください。一度検索したサモナーは入力補助履歴に自動保存され、ワンクリックで再解析できます。
            </p>
          </div>
          {recentSearches.length > 0 && (
            <div className="pt-4 max-w-md mx-auto">
              <div className="text-xs font-bold text-faint mb-2">最近検索したサモナーから再開:</div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {recentSearches.map((rec) => (
                  <button
                    key={rec}
                    type="button"
                    onClick={() => {
                      setSummonerInput(rec);
                      handleRunAnalysis(rec, targetTier);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-900 font-black text-xs border border-primary-edge/60 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles size={12} className="text-primary-600" />
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
          <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-500 text-white flex items-center justify-center text-2xl font-black shadow-sm shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-foreground">
                    {report.summoner.name}#{report.summoner.tag}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-surface-subtle text-foreground-subtle border border-border">
                    現在: {report.summoner.tier}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-success-100 text-success-900 border border-success-edge">
                    目標: <strong>{targetTier}</strong>
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft">
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
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-subtle text-muted border border-border">
                      SoloQ実測 {report.summoner.sampleMatchesCount}試合連動
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-success-700 flex items-center gap-2 mt-1">
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
                  <span className="text-[10px] px-2 py-0.2 rounded bg-success-100 text-success-900 border border-success-edge">
                    {report.analysis?.styleBadge ||
                      (report.summoner?.role === 'UTILITY' ? '視界スコア Sランク' : '安定度 Sランク')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-faint font-mono">
                統合データソース: Riot API / your.gg / League of Graphs
              </div>
              <div className="text-xs font-bold text-muted mt-0.5">
                目標ランク逆算解析完了 (リアルタイム)
              </div>
            </div>
          </div>

          {/* 🎯 目標ランク基準ギャップ診断（2026-10-07: 目標ランク・同ロールの実測平均と比較。以前は手入力の目標値） */}
          {report.sessionAnalytics?.targetRankGap ? (() => {
            const g = report.sessionAnalytics.targetRankGap;
            const items = [
              { key: 'deaths', title: '① 平均デス', gap: g.gaps.deathsDiff, actual: g.currentActual.avgDeaths, avg: g.benchmark.avgDeaths, unit: '' },
              { key: 'cs', title: '② 分間CS', gap: g.gaps.csDiff, actual: g.currentActual.csPerMin, avg: g.benchmark.csPerMin, unit: '' },
              { key: 'kp', title: '③ キル関与率', gap: g.gaps.kpDiff, actual: g.currentActual.killParticipation, avg: g.benchmark.killParticipation, unit: '%' },
              { key: 'vision', title: '④ 分間視界スコア', gap: g.gaps.visionDiff, actual: g.currentActual.visionScorePerMin, avg: g.benchmark.visionScorePerMin, unit: '' },
            ];
            return (
              <div className="rounded-3xl border border-success-edge bg-gradient-to-br from-success-50/90 via-white to-secondary-50/70 p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-success-edge-soft gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-success-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
                      🎯
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-success-100 text-success-900 border border-success-edge">
                          比較相手: {g.benchmark.tierName}・同ロールの実測平均
                        </span>
                        <h3 className="text-lg font-black text-foreground">目標ランク平均との比較</h3>
                      </div>
                      <p className="text-xs text-muted font-medium mt-0.5">
                        {g.benchmark.tierName} のプレイヤー本人の直近ランクソロ {g.benchmark.sampleCount}試合（直近30日）の平均と、現在の実測値を比べています
                        {g.lowSample && <span className="block text-[10px] text-danger-700 font-bold">※試合数が少ないため参考値です</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-faint font-bold">平均以上の項目</span>
                    <div className="text-2xl font-black text-success-700 font-mono">
                      {g.passedCount} / {g.totalCount}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {items.map((it) => (
                    <div key={it.key} className="p-3.5 bg-surface rounded-2xl border border-border/80 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-muted">{it.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${it.gap.passed ? 'bg-success-100 text-success-900' : 'bg-danger-100 text-danger-900'}`}>
                          {it.gap.passed ? '平均以上' : '平均未満'}
                        </span>
                      </div>
                      <div className="text-foreground font-black font-mono">
                        実測 {it.actual}{it.unit} / 平均 {it.avg}{it.unit}
                      </div>
                      <div className="text-[10px] text-muted-strong">{it.gap.label}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-success-edge-soft space-y-2">
                  <div className="text-xs font-black text-success-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-success-600" />
                    <span>{g.benchmark.tierName}平均を下回っている項目:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-foreground-subtle font-medium">
                    {g.keyActionToPromote?.map((act: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="text-success-600 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })() : (
            <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted">
              🎯 目標ランク【{targetTier}】の実測平均はまだ収集中のため、目標ランクとの比較は表示していません（毎日自動で収集しています）。
            </div>
          )}

          {/* ナビゲーションタブ */}
          <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-surface-subtle border border-border'
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
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-surface-subtle border border-border'
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
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-surface-subtle border border-border'
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
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface text-primary-700 hover:bg-primary-50 border border-primary-edge-soft'
              }`}
            >
              <Compass size={14} />
              <span>4. 🧬 プレイスタイル特性タイプ診断（独自スタッツ分析）</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* タブ 1: 📊 5大レーダー ＆ 展開4分類 */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 試合展開4タイプ分類 */}
              {report.sessionAnalytics?.gameOutcomeBreakdown && (
                <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 gap-2">
                    <div>
                      <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                        <PieChart size={16} className="text-primary-600" />
                        <span>⚖️ 試合展開4タイプ自動分類 (Carry vs ACE Loss Index)</span>
                      </h3>
                      <p className="text-[11px] text-muted-strong font-medium mt-0.5">
                        直近の全試合を「自力勝利」「味方連携」「不運な負け」「防げた負け」の4パターンに客観分類
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-primary-800 bg-primary-100/80 px-2.5 py-1 rounded-xl font-mono self-start sm:self-auto">
                      実戦 {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}試合 抽出解析
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                    {/* 1. ハードキャリー勝利 */}
                    <div className="p-4 rounded-2xl bg-primary-50/90 border border-primary-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-primary-950 flex items-center gap-1">
                            👑 ハードキャリー勝利
                          </span>
                          <span className="text-[9.5px] font-black text-primary-800 bg-primary-200/70 px-1.5 py-0.5 rounded">自力主導</span>
                        </div>
                        <div className="text-2xl font-black text-primary-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.percent}%{' '}
                          <span className="text-xs font-bold text-primary-800">({report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-primary-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身が高いキル・大ダメージ・CCで試合を動かし、圧倒的なリードを作って自らチームを勝利に導いた試合。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-primary-edge-soft/70 text-[10px] text-primary-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 勝利 ＋ KDA 5.0以上 または ダメージシェア24%以上</div>
                        <div>💡 <strong>意味:</strong> あなたの勝ちパターン。再現性を高めることが昇格の最短ルート。</div>
                      </div>
                    </div>

                    {/* 2. チーム協調勝利 */}
                    <div className="p-4 rounded-2xl bg-success-50/90 border border-success-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-success-950 flex items-center gap-1">
                            🛡️ チーム協調勝利
                          </span>
                          <span className="text-[9.5px] font-black text-success-800 bg-success-200/70 px-1.5 py-0.5 rounded">堅実連携</span>
                        </div>
                        <div className="text-2xl font-black text-success-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.percent}%{' '}
                          <span className="text-xs font-bold text-success-800">({report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-success-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 無理なキルを追わず低デスを維持。視界管理・味方キャリーの防衛（ピール）・オブジェクト確保で手堅く掴んだ勝利。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-success-edge-soft/70 text-[10px] text-success-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 勝利 ＋ 安定した低被デス・視界貢献・アシスト中心</div>
                        <div>💡 <strong>意味:</strong> 「自分が育たなくても勝てる」高い安定性とチーム貢献力の証拠。</div>
                      </div>
                    </div>

                    {/* 3. エース敗北 */}
                    <div className="p-4 rounded-2xl bg-primary-50/90 border border-primary-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-primary-950 flex items-center gap-1">
                            😭 エース敗北 (味方崩壊)
                          </span>
                          <span className="text-[9.5px] font-black text-primary-800 bg-primary-200/70 px-1.5 py-0.5 rounded">不運・奮闘</span>
                        </div>
                        <div className="text-2xl font-black text-primary-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.percent}%{' '}
                          <span className="text-xs font-bold text-primary-800">({report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-primary-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身は好調（低デス・高KDA）で有利を作っていたが、他レーンの大量崩壊や味方のミスで押し切られた悔しい敗北。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-primary-edge-soft/70 text-[10px] text-primary-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 敗北 ＋ 自身はKDA 3.8以上 ＆ 低被デス（4デス以下）</div>
                        <div>💡 <strong>意味:</strong> あなた自身に大きな非はない「不運な負け」。引きずらず割り切るべき試合。</div>
                      </div>
                    </div>

                    {/* 4. 集団戦・逆転負け */}
                    <div className="p-4 rounded-2xl bg-danger-50/90 border border-danger-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-danger-950 flex items-center gap-1">
                            ⚠️ 集団戦・逆転負け
                          </span>
                          <span className="text-[9.5px] font-black text-danger-800 bg-danger-200/70 px-1.5 py-0.5 rounded">要改善</span>
                        </div>
                        <div className="text-2xl font-black text-danger-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.percent}%{' '}
                          <span className="text-xs font-bold text-danger-800">({report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-danger-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身のデスが嵩んだり、終盤のオブジェクト前や視界のない場所での孤立被キャッチから形勢を逆転されてしまった敗北。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-danger-edge-soft/70 text-[10px] text-danger-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 敗北 ＋ 被デス5回以上 または 終盤の重要局面でのデス</div>
                        <div>💡 <strong>意味:</strong> 最も改善価値の高い「防げた負け筋」。このデスの原因を無くせば即昇格。</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-background border border-border/80 text-xs text-foreground-subtle space-y-1">
                    <div className="font-black text-foreground flex items-center gap-1.5">
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
                  <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-primary-600" />
                        <h3 className="font-black text-sm text-foreground">
                          プレイスタイル 5大レーダー客観解析
                        </h3>
                        {report.sessionAnalytics?.roleConfig && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge">
                            {report.sessionAnalytics.roleConfig.roleIcon} {report.sessionAnalytics.roleConfig.roleName} 特化診断
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-faint">
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
                          score: number | null;
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
                              valueText: `分間視界 ${report.metrics.vision.visionScorePerMin}/分`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Eye,
                              badge: visionScore < 50 ? '要改善' : undefined,
                            },
                            {
                              label: '② 序盤ローム・他レーン支援力',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '③ 集団戦CC・キャリー防衛 (ピール)',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Shield,
                            },
                            {
                              label: '④ オブジェクト先制視界管理',
                              score: report.metrics.objectives.score,
                              valueText: `${report.sessionAnalytics?.earlyTimelineImpact?.objLabel || 'ドラゴン確保時勝率'}: ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 低被デス・生存ポジショニング',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isJg) {
                          radarItems = [
                            {
                              label: '① 生存力・被デス回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② ファーム効率 (CS/分)',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ 15分キル関与 (KP@15)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ オブジェクト確保 (Obj Control)',
                              score: report.metrics.objectives.score,
                              valueText: `グラブ/ドラゴン優位時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 集団戦ポジショニング (Teamfight)',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isMid) {
                          radarItems = [
                            {
                              label: '① 生存力・被ガンク回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② CS精度 ＆ プッシュ主導権',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ ローム・サイド介入率 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ リバー・オブジェクト主導権',
                              score: report.metrics.objectives.score,
                              valueText: `オブジェクト優位時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 集団戦DPS ＆ KDA',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isBot) {
                          radarItems = [
                            {
                              label: '① 集団戦ポジショニング・低デス',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② 分間CS ＆ リソース回収',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ 終盤DPS占有 ＆ キル関与 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ オブジェクトバースト力',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン確保時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ KDA ＆ キャリー力',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
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
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② CS精度 ＆ ウェーブ管理',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ TP・集団戦合流力 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ スプリットプッシュ圧力 ＆ グラブ確保',
                              score: report.metrics.objectives.score,
                              valueText: `グラブ確保時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ フロントライン耐久 ＆ KDA',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
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
                                    <span className="text-[10px] bg-danger-100 text-danger-800 px-1.5 py-0.2 rounded font-black">
                                      {item.badge}
                                    </span>
                                  )}
                                </span>
                                <span className="text-foreground font-black">
                                  {item.score == null ? '—' : `${item.score}点`}{' '}
                                  <span className={`text-[10px] ${item.subTextColor} font-normal`}>
                                    ({item.valueText})
                                  </span>
                                </span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden">
                                <div
                                  className={`h-full ${item.barBg} rounded-full`}
                                  style={{ width: item.score == null ? '0%' : `${Math.min(100, Math.max(5, item.score))}%` }}
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
                      <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-2.5">
                        <div className="text-xs font-black text-foreground flex items-center gap-1.5 border-b border-stone-100 pb-2">
                          <Skull size={14} className="text-danger-600" />
                          <span>致命的デス (Throw) 検知</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-foreground-subtle">
                          <div className="flex justify-between font-bold">
                            <span>Obj直前デス:</span>
                            <span className="font-mono text-foreground">
                              {report.sessionAnalytics.fatalDeathAnalytics.objPreSpawnDeathsCount}回 ({report.sessionAnalytics.fatalDeathAnalytics.objPreSpawnDeathsRate}%)
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>孤立被キャッチ率:</span>
                            <span className="font-mono text-foreground">
                              {report.sessionAnalytics.fatalDeathAnalytics.isolatedDeathsPercent}%
                            </span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 border-t border-stone-100">
                            <span>スロー危険度:</span>
                            <span className="font-black text-success-700">
                              {report.sessionAnalytics.fatalDeathAnalytics.fatalThrowRating}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {report.sessionAnalytics?.earlyTimelineImpact && (
                      <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-2.5">
                        <div className="text-xs font-black text-foreground flex items-center gap-1.5 border-b border-stone-100 pb-2">
                          <Timer size={14} className="text-primary-600" />
                          <span>序盤14分 タイムライン因果</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-foreground-subtle">
                          <div className="flex justify-between font-bold">
                            <span>初デス平均時間:</span>
                            <span className="font-mono text-foreground">
                              {report.sessionAnalytics.earlyTimelineImpact.firstDeathAvgMinute}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>{report.sessionAnalytics.earlyTimelineImpact.objLabel || '序盤オブジェクト獲得時勝率'}:</span>
                            <span className="font-mono text-success-700">
                              {report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate != null
                                ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%`
                                : '未計測 (データ不足)'}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-strong pt-1 border-t border-stone-100 font-medium space-y-1">
                            <div>{report.sessionAnalytics.earlyTimelineImpact.plateGoldImpact}</div>
                            <div className="text-[10px] text-faint">
                              ※試合優位チームがオブジェクトを確保しやすい相関を含みます
                            </div>
                          </div>
                          {report.sessionAnalytics.earlyTimelineImpact.roleObjectiveFocus && (
                            <div className="text-[10.5px] text-primary-700 bg-primary-50/70 p-2 rounded-xl font-medium leading-relaxed">
                              🎯 {report.sessionAnalytics.earlyTimelineImpact.roleObjectiveFocus}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 視界客観データ */}
                  <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                        <Eye size={16} className="text-primary-600" />
                        <span>視界・コントロール客観解析 (League of Graphs / Riot API連動)</span>
                      </h3>
                      <span className="text-xs font-black text-primary-700">
                        分間視界 {report.metrics.vision.visionScorePerMin}/分
                      </span>
                    </div>

                    {/* 2026-10-07: 「自陣防衛/敵陣ディープ」のワード比率は計測しておらず視界スコアから作った値だったため削除 */}
                    <p className="text-xs text-muted leading-relaxed font-medium bg-background p-3 rounded-2xl border border-border/60">
                      {report.analysis.visionAnalysis}
                    </p>
                  </div>
                </div>

                {/* 右側 (5カラム): AI総合深層診断・最大の敗因・アクション */}
                <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-4">
                  {/* 3大強み */}
                  <div className="rounded-3xl border border-success-edge-soft bg-success-50/60 p-5 shadow-xs space-y-2.5">
                    <div className="text-xs font-black text-success-950 flex items-center gap-1.5">
                      <span>🌟</span>
                      <span>実測データから導かれた「3大強み」</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-foreground-subtle font-medium">
                      {report.analysis.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 size={13} className="text-success-600 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 最大の敗因・ボトルネック */}
                  <div className="rounded-3xl border border-primary-edge bg-primary-50/80 p-5 shadow-xs space-y-2.5">
                    <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-primary-200 text-primary-900">⚠️</span>
                      <span>【{targetTier}】到達を阻む最大のボトルネック</span>
                    </div>
                    <p className="text-xs text-foreground-soft leading-relaxed font-medium bg-surface p-3 rounded-2xl border border-primary-edge-soft">
                      {report.analysis.coreBottleNeck}
                    </p>
                  </div>

                  {/* 決定版・次戦の具体的急所アクション */}
                  <div className="rounded-3xl border border-primary-edge bg-primary-50/80 p-5 shadow-xs space-y-3">
                    <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-primary-600" />
                      <span>【{targetTier}】昇格への決定版アクション</span>
                    </div>

                    <div className="bg-surface p-3.5 rounded-2xl border border-primary-edge-soft space-y-2">
                      <div className="text-xs font-bold text-foreground leading-relaxed">
                        {report.analysis.actionPlan}
                      </div>

                      {report.analysis.goldenDeepWard && (
                        <div className="pt-2 border-t border-primary-edge-soft text-[11px] text-muted space-y-1">
                          <div className="font-bold text-primary-900 flex items-center gap-1">
                            <MapPin size={12} className="text-primary-600" />
                            <span>推奨: {report.analysis.goldenDeepWard.spot}</span>
                          </div>
                          <div>⏰ {report.analysis.goldenDeepWard.timing}</div>
                          <div className="text-muted-strong">{report.analysis.goldenDeepWard.reason}</div>
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
                        ? 'bg-primary-600 text-white border-primary-edge-strong shadow-xs'
                        : 'bg-surface text-foreground-subtle hover:bg-background border-border'
                    }`}
                  >
                    <span>{champ.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        selectedChampion.id === champ.id
                          ? 'bg-primary-800/80 text-white'
                          : 'bg-surface-subtle text-muted'
                      }`}
                    >
                      {champ.gamesCount}戦 勝率 {champ.winRate}% (KDA {champ.kda})
                    </span>
                  </button>
                ))}
              </div>

              {/* チャンピオン詳細カード */}
              <div className="rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-foreground">{selectedChampion.name}</h3>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft">
                        {selectedChampion.powerRating}
                      </span>
                    </div>
                    <p className="text-xs text-muted-strong font-medium mt-0.5">
                      実戦サンプル: {selectedChampion.gamesCount}試合 | 分間CS: {selectedChampion.csPerMin} | 平均K/D/A:{' '}
                      {selectedChampion.avgKills} / {selectedChampion.avgDeaths} / {selectedChampion.avgAssists}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-faint font-bold">勝率 / KDA</div>
                      <div className="text-lg font-black text-foreground font-mono">
                        {selectedChampion.winRate}%{' '}
                        <span className="text-xs font-normal text-muted-strong">({selectedChampion.kda})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. パワースパイク分析 */}
                <div className="space-y-3">
                  <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                    <Zap size={14} className="text-primary-600" />
                    <span>⚡ パワースパイク ＆ 立ち回り時間軸</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1">
                      <div className="text-[11px] font-black text-muted-strong">序盤 (Lv1〜5)</div>
                      <p className="text-xs text-foreground-soft font-medium leading-relaxed">
                        {selectedChampion.powerSpikes.earlyLvl1to5}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-primary-50/80 border border-primary-edge-soft space-y-1">
                      <div className="text-[11px] font-black text-primary-900">中盤 (1〜2コア完成時)</div>
                      <p className="text-xs text-foreground font-bold leading-relaxed">
                        {selectedChampion.powerSpikes.mid1to2Core}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-primary-50/80 border border-primary-edge-soft space-y-1">
                      <div className="text-[11px] font-black text-primary-900">終盤 (3コア以降 / 集団戦)</div>
                      <p className="text-xs text-foreground font-medium leading-relaxed">
                        {selectedChampion.powerSpikes.late3CorePlus}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. 得意・天敵 相性マトリクス */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-success-900 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-success-600" />
                      <span>カモにできる相手 (有利マッチアップ)</span>
                    </h4>
                    <div className="space-y-2">
                      {(!selectedChampion.favoredMatchups || selectedChampion.favoredMatchups.length === 0) && (
                        <p className="text-[11px] text-muted-strong font-medium p-3 rounded-2xl bg-background border border-border">
                          このチャンピオンの有利マッチアップはまだ登録されていません。
                        </p>
                      )}
                      {selectedChampion.favoredMatchups?.map((fav: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-success-50/60 border border-success-edge-soft space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-black text-success-950">
                            <span>vs {fav.enemy}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-success-100/80 text-success-800 font-bold border border-success-edge-soft/60">
                              有利相性
                            </span>
                          </div>
                          <p className="text-xs text-foreground-subtle font-medium leading-relaxed">{fav.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-danger-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-danger-600" />
                      <span>天敵・警戒マッチアップ ＆ 対処法</span>
                    </h4>
                    <div className="space-y-2">
                      {(!selectedChampion.hardMatchups || selectedChampion.hardMatchups.length === 0) && (
                        <p className="text-[11px] text-muted-strong font-medium p-3 rounded-2xl bg-background border border-border">
                          このチャンピオンの天敵マッチアップはまだ登録されていません。
                        </p>
                      )}
                      {selectedChampion.hardMatchups?.map((hard: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-danger-50/60 border border-danger-edge-soft space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-black text-danger-950">
                            <span>vs {hard.enemy}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-danger-100/80 text-danger-800 font-bold border border-danger-edge-soft/60">
                              要警戒
                            </span>
                          </div>
                          <p className="text-xs text-foreground-subtle font-medium leading-relaxed">
                            <strong className="text-danger-900">対策:</strong> {hard.counterPlay}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. 勝利時 vs 敗北時の客観スタッツ差分 */}
                <div className="p-5 rounded-3xl bg-background border border-border space-y-3">
                  <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                    <Swords size={14} className="text-foreground-subtle" />
                    <span>勝利時 vs 敗北時のスタッツ差分（勝敗を分ける境界線）</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">15分CS差</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.cs15Diff}
                      </div>
                    </div>
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">平均被デス</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.deathsDiff}
                      </div>
                    </div>
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">視界・コントロール</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.visionDiff}
                      </div>
                    </div>
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">第1コア完成時間</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.firstCoreTime}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. AI戦術ガイド */}
                <div className="p-4 rounded-2xl bg-primary-50/70 border border-primary-edge-soft flex items-start gap-2.5">
                  <Sparkles size={16} className="text-primary-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-primary-950 font-medium leading-relaxed">
                    <strong className="font-black">専属AI戦術指南:</strong> {selectedChampion.aiTacticsGuide}
                  </div>
                </div>
              </div>

              {/* 🧩 チャンピオン手持ちプール穴診断 */}
              {report.sessionAnalytics?.championPoolDiagnosis && (
                <div className="rounded-3xl border border-primary-edge-soft bg-surface p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-primary-edge-soft pb-3">
                    <h3 className="font-black text-sm text-primary-950 flex items-center gap-2">
                      <Puzzle size={16} className="text-primary-600" />
                      <span>🧩 チャンピオン手持ちプール穴診断 ＆ AI補完処方箋</span>
                    </h3>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft">
                      {report.sessionAnalytics.championPoolDiagnosis.poolArchetype}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-foreground-subtle">
                      <span>手持ちプールの属性バランス:</span>
                      <span>
                        AP {report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}% / AD{' '}
                        {report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}% / タンク{' '}
                        {report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%
                      </span>
                    </div>
                    <div className="h-3.5 w-full rounded-full bg-surface-subtle flex overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}%` }}
                        title={`AP比率: ${report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}%`}
                      />
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}%` }}
                        title={`AD比率: ${report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}%`}
                      />
                      <div
                        className="h-full bg-success-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%` }}
                        title={`タンク比率: ${report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%`}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-primary-50/70 border border-primary-edge-soft space-y-3">
                    <div className="text-xs font-bold text-primary-950 flex items-center gap-1.5">
                      <Lightbulb size={15} className="text-primary-600 shrink-0" />
                      <span>
                        <strong>不足しているピース:</strong> {report.sessionAnalytics.championPoolDiagnosis.missingPiece}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {report.sessionAnalytics.championPoolDiagnosis.recommendedAdditions?.map((rec: any, idx: number) => (
                        <div key={idx} className="p-3.5 bg-surface rounded-2xl border border-primary-edge-soft/80 space-y-1 shadow-2xs">
                          <div className="text-xs font-black text-foreground">{rec.championName}</div>
                          <div className="text-[10px] font-bold text-primary-700">{rec.archetype}</div>
                          <p className="text-[11px] text-muted font-medium leading-relaxed pt-1 border-t border-stone-100">
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
              <div className="rounded-3xl border border-border bg-surface p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                    <Clock size={16} className="text-primary-600" />
                    <span>時間帯別勝率カーブ ＆ 集中力ピーク (実測タイムスタンプ集計)</span>
                  </h3>
                  <span className="text-[10px] font-bold text-faint">JST実測ログ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.sessionAnalytics.timeOfDayPerformance?.map((slot: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-3xl border space-y-2 ${
                        !slot.hasData
                          ? 'bg-background border-border opacity-70'
                          : slot.winRate >= 60
                          ? 'bg-success-50/70 border-success-edge'
                          : slot.winRate <= 45
                          ? 'bg-danger-50/70 border-danger-edge'
                          : 'bg-background border-border'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-foreground">{slot.label}</div>
                          <div className="text-[11px] font-mono text-muted-strong font-bold mt-0.5">
                            {slot.timeSlot}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-black text-foreground">
                            {slot.hasData ? `${slot.winRate}%` : '0試合'}
                          </div>
                          <div className="text-[10px] text-muted-strong">
                            {slot.hasData ? `KDA ${slot.kda} (${slot.gamesCount}戦)` : '直近履歴なし'}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-foreground-subtle font-medium leading-relaxed pt-2 border-t border-border/50">
                        {slot.insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 連戦疲労度 ＆ 即キューティルト判定 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-3xl border border-border bg-surface p-6 shadow-xs space-y-4">
                  <div className="border-b border-stone-100 pb-3">
                    <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                      <Activity size={16} className="text-primary-600" />
                      <span>連続試合数による疲労度・勝率低下分析 (実測セッション)</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {report.sessionAnalytics.sessionFatigueImpact?.map((f: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border space-y-1.5 ${
                          f.hasData ? 'bg-background border-border/80' : 'bg-background/60 border-dashed border-border opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-foreground font-black">
                            {f.gameNumberInSession} - {f.label}
                          </span>
                          <span className="font-mono text-foreground-soft font-black">
                            {f.hasData ? (
                              <>
                                勝率 {f.winRate}%{' '}
                                <span className="text-[10px] text-faint font-normal">
                                  (平均 {f.avgDeaths}デス / {f.gamesCount}戦)
                                </span>
                              </>
                            ) : (
                              <span className="text-faint font-normal">0試合 (連戦なし・健全)</span>
                            )}
                          </span>
                        </div>
                        {f.hasData && (
                          <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                f.winRate >= 60
                                  ? 'bg-success-500'
                                  : f.winRate >= 50
                                  ? 'bg-primary-500'
                                  : 'bg-danger-500'
                              }`}
                              style={{ width: `${f.winRate}%` }}
                            />
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[11px]">
                          <span className={f.hasData ? (f.focusScore >= 80 ? 'text-success-700 font-black' : f.focusScore >= 60 ? 'text-primary-700 font-bold' : 'text-danger-700 font-bold') : 'text-faint'}>
                            {f.hasData ? `集中力スコア: ${f.focusScore}点` : '直近データなし'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            !f.hasData
                              ? 'bg-surface-subtle text-muted-strong'
                              : f.focusScore >= 80
                              ? 'bg-success-100 text-success-800 border border-success-edge'
                              : f.focusScore >= 60
                              ? 'bg-primary-100 text-primary-800 border border-primary-edge'
                              : 'bg-danger-100 text-danger-800 border border-danger-edge'
                          }`}>
                            状態: {f.fatigueLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-3xl border border-primary-edge-soft bg-primary-50/60 p-6 shadow-xs space-y-4">
                  <div className="border-b border-primary-edge-soft/70 pb-3">
                    <h3 className="font-black text-sm text-primary-950 flex items-center gap-2">
                      <Flame size={16} className="text-danger-600" />
                      <span>即キュー・ティルト判定 (実測インターバル)</span>
                    </h3>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-foreground-subtle">負け直後 5分以内即キュー</div>
                      <div className="text-sm font-black font-mono">
                        {report.sessionAnalytics.requeueTiltStats.immediateRequeueGames > 0 ? (
                          <span className={
                            report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate >= 55
                              ? 'text-success-600'
                              : report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate >= 45
                              ? 'text-primary-600'
                              : 'text-danger-600'
                          }>
                            勝率 {report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate}%{' '}
                            <span className="text-[10px] text-faint font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合)
                            </span>
                          </span>
                        ) : (
                          <span className="text-success-700 text-xs font-bold">0試合 (即キューなし・良好)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-foreground-subtle">5分以上休憩後のマッチ</div>
                      <div className="text-sm font-black font-mono">
                        {report.sessionAnalytics.requeueTiltStats.restedRequeueGames > 0 ? (
                          <span className={
                            report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate >= 55
                              ? 'text-success-600'
                              : report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate >= 45
                              ? 'text-primary-600'
                              : 'text-danger-600'
                          }>
                            勝率 {report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate}%{' '}
                            <span className="text-[10px] text-faint font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.restedRequeueGames}試合)
                            </span>
                          </span>
                        ) : (
                          <span className="text-faint text-xs font-normal">0試合</span>
                        )}
                      </div>
                    </div>
                    {report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent > 0 && (
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-black">
                        <span className="text-primary-900">ティルトによる勝率低下</span>
                        <span className="text-danger-600 bg-danger-100 px-2 py-0.5 rounded font-mono">
                          -{report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent}% ドロップ
                        </span>
                      </div>
                    )}
                    {report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent < 0 && (
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-black">
                        <span className="text-primary-900">即キュー時の勢い維持</span>
                        <span className="text-success-700 bg-success-100 px-2 py-0.5 rounded font-mono">
                          +{Math.abs(report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent)}% 勝率アップ
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-foreground-subtle leading-relaxed font-medium bg-surface/70 p-3 rounded-xl border border-primary-edge-soft/50">
                    💡 <strong>実測インサイト:</strong>{' '}
                    {report.sessionAnalytics.requeueTiltStats.insight ||
                      (report.sessionAnalytics.requeueTiltStats.immediateRequeueGames < 3
                        ? `直近の即キューは${report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合のみとサンプル数が少なく、感情的な連戦を自制できています。`
                        : '敗北後は感情に流されず、冷静にセッションを管理できています。')}
                  </p>
                </div>
              </div>

              {/* 3. 黄金プレイルール */}
              <div className="rounded-3xl border border-primary-edge-soft bg-primary-50/70 p-6 shadow-xs space-y-4">
                <h3 className="font-black text-sm text-primary-950 flex items-center gap-2">
                  <Award size={16} className="text-primary-600" />
                  <span>実測データに基づく黄金プレイルール 3箇条</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.sessionAnalytics.goldenSessionRules?.map((rule: string, idx: number) => (
                    <div key={idx} className="p-4 bg-surface rounded-2xl border border-primary-edge-soft space-y-1 shadow-2xs">
                      <div className="text-xs font-bold text-foreground-soft leading-relaxed">{rule}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* タブ 4: 🧬 プレイスタイル特性タイプ診断（独自スタッツ分析） */}
          {/* ========================================================================= */}
          {activeTab === 'psychology' && report.sessionAnalytics?.playstyleMbti && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-primary-edge bg-gradient-to-br from-primary-50/90 via-white to-primary-50/80 p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-primary-edge-soft gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                      🧬
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft font-mono">
                          TYPE: {report.sessionAnalytics.playstyleMbti.typeCode}
                        </span>
                        <h3 className="text-lg md:text-xl font-black text-foreground">
                          {report.sessionAnalytics.playstyleMbti.typeName}
                        </h3>
                      </div>
                      <p className="text-xs text-primary-900 font-bold mt-1">
                        {report.sessionAnalytics.playstyleMbti.tagline}
                      </p>
                      <p className="text-[10px] text-muted-strong font-medium mt-0.5">
                        ※LoLの実測スタッツ（KDA・CS・被デス・視界）から算出した独自の4軸プレイスタイル分類です
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-faint font-bold">意思決定スタッツ分類</span>
                    <div className="text-xs font-black text-primary-700">深層パーソナリティ判定完了</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🛡️ セーフティ計算型 ({report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%)</span>
                      <span className="text-faint">ハイリスク型 ({report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.riskPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-primary-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%` }} />
                      <div className="h-full bg-danger-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.riskPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🌾 自己スケール重視 ({report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.scalePercent}%)</span>
                      <span className="text-faint">献身サポート ({report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.enablerPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-primary-500" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.scalePercent}%` }} />
                      <div className="h-full bg-success-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.enablerPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🏰 自陣テリトリー防衛 ({report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.guardianPercent}%)</span>
                      <span className="text-faint">敵陣侵略 ({report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.invaderPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-success-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.guardianPercent}%` }} />
                      <div className="h-full bg-danger-500" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.invaderPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🧠 慎重観察型 ({report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.deliberatePercent}%)</span>
                      <span className="text-faint">直感即断型 ({report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.reflexPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-primary-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.deliberatePercent}%` }} />
                      <div className="h-full bg-primary-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.reflexPercent}%` }} />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-foreground-subtle leading-relaxed font-medium bg-surface/90 p-4 rounded-2xl border border-primary-edge-soft">
                  {report.sessionAnalytics.playstyleMbti.personalityAnalysis}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.sessionAnalytics.tiltTriggerMatrix && (
                  <div className="rounded-3xl border border-danger-edge-soft bg-danger-50/60 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-danger-edge-soft pb-3">
                      <h4 className="font-black text-xs text-danger-950 flex items-center gap-1.5">
                        <Flame size={15} className="text-danger-600" />
                        <span>メンタル耐久度 ＆ ティルト誘発トリガー</span>
                      </h4>
                      <span className="text-xs font-black text-danger-700 font-mono">
                        耐性指数: {report.sessionAnalytics.tiltTriggerMatrix.mentalResilienceScore}点
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-foreground-soft">
                      <div className="p-3 bg-surface rounded-2xl border border-danger-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">自陣インベード荒らし耐性</div>
                        <div className="font-bold text-foreground">{report.sessionAnalytics.tiltTriggerMatrix.invadeResistanceRating}</div>
                      </div>
                      <div className="p-3 bg-surface rounded-2xl border border-danger-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">味方序盤崩壊時のメンタル</div>
                        <div className="font-bold text-foreground">{report.sessionAnalytics.tiltTriggerMatrix.teammateDeathResistance}</div>
                      </div>
                      <div className="p-3 bg-surface rounded-2xl border border-danger-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">雪だるま連続デス防止率</div>
                        <div className="font-bold text-success-700">
                          {report.sessionAnalytics.tiltTriggerMatrix.snowballDeathAvoidanceRate}% (デス後も冷静さを維持)
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted leading-relaxed font-medium">
                      💡 {report.sessionAnalytics.tiltTriggerMatrix.tiltInsight}
                    </p>
                  </div>
                )}

                {report.sessionAnalytics.goldEfficiency && (
                  <div className="rounded-3xl border border-primary-edge-soft bg-primary-50/60 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-primary-edge-soft pb-3">
                      <h4 className="font-black text-xs text-primary-950 flex items-center gap-1.5">
                        <Coins size={15} className="text-primary-600" />
                        <span>銭勘定 ＆ ゴールド変換効率 (Gold-to-Impact)</span>
                      </h4>
                      <span className="text-xs font-black text-primary-900">
                        {report.sessionAnalytics.goldEfficiency.damagePerGoldRating}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-foreground-soft">
                      <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">ゴールド死蔵率 (リコール遅延)</div>
                        <div className="font-bold text-foreground">{report.sessionAnalytics.goldEfficiency.goldStashRating}</div>
                      </div>
                      <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">1コア完成直後のアクション率</div>
                        <div className="font-bold text-primary-800">
                          {report.sessionAnalytics.goldEfficiency.spikeUtilizationPercent}% (完成直後に即戦力化)
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-foreground-subtle leading-relaxed font-medium bg-surface p-3 rounded-2xl border border-primary-edge-soft/80">
                      {report.sessionAnalytics.goldEfficiency.efficiencyVerdict}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.sessionAnalytics.adversityBehavior && (
                  <div className="rounded-3xl border border-border bg-surface p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                        <ShieldAlert size={15} className="text-primary-600" />
                        <span>逆境・ビハインド時の人間性</span>
                      </h4>
                      <span className="text-xs font-black text-primary-700">
                        逆境勝率 {report.sessionAnalytics.adversityBehavior.behindComebackWinRate}%
                      </span>
                    </div>

                    <div className="p-3.5 bg-primary-50/60 rounded-2xl border border-primary-edge-soft space-y-1">
                      <div className="text-xs font-black text-primary-950">
                        行動タイプ: {report.sessionAnalytics.adversityBehavior.archetype}
                      </div>
                      <p className="text-xs text-foreground-subtle leading-relaxed font-medium">
                        {report.sessionAnalytics.adversityBehavior.behaviorVerdict}
                      </p>
                    </div>

                    <p className="text-xs text-muted leading-relaxed font-medium">
                      🎯 <strong>逆転の鍵:</strong> {report.sessionAnalytics.adversityBehavior.recommendedMindset}
                    </p>
                  </div>
                )}

                {report.sessionAnalytics.cognitiveBiases && (
                  <div className="rounded-3xl border border-primary-edge-soft bg-primary-50/60 p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-primary-edge-soft pb-3">
                      <h4 className="font-black text-xs text-primary-950 flex items-center gap-1.5">
                        <AlertOctagon size={15} className="text-primary-600" />
                        <span>無意識の悪癖・認知バイアス特定</span>
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft">
                        <div className="font-bold text-foreground">{report.sessionAnalytics.cognitiveBiases.recallHabitBias}</div>
                      </div>
                      <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft">
                        <div className="font-bold text-foreground">{report.sessionAnalytics.cognitiveBiases.mapAttentionBias}</div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-surface rounded-2xl border border-primary-edge-soft space-y-1">
                      <div className="text-xs font-black text-primary-950 flex items-center gap-1">
                        <Sparkles size={13} className="text-primary-600" />
                        <span>矯正処方箋:</span>
                      </div>
                      <p className="text-xs text-foreground-soft leading-relaxed font-bold">
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
        </>
      )}
    </div>
  );
}
