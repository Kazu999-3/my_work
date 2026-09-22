"use client";

import { useState, useEffect } from 'react';
import { toast } from '../../../components/Toaster';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, ShieldAlert, Cpu, RefreshCw, ChevronRight, AlertTriangle, Trophy, Coins, Swords, Users, Shield, Layers, Database, ExternalLink, BookOpen, Calendar, Clock, Sparkles, Flame } from 'lucide-react';
import Link from 'next/link';

function summarizeError(errorStr?: string): { label: string; bg: string } {
  if (!errorStr) return { label: 'エラー発生', bg: 'bg-stone-100 text-stone-700 border-stone-200' };
  const s = errorStr.toLowerCase();
  if (s.includes('429') || s.includes('quota') || s.includes('resource_exhausted')) {
    return { label: 'Gemini API 一時混雑 (429)', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  if (s.includes('404') || s.includes('not found') || s.includes('private') || s.includes('deleted')) {
    return { label: '動画が非公開/削除済み', bg: 'bg-rose-100 text-rose-900 border-rose-300' };
  }
  if (s.includes('timeout') || s.includes('econnreset') || s.includes('network')) {
    return { label: 'ネットワークタイムアウト', bg: 'bg-orange-100 text-orange-900 border-orange-300' };
  }
  if (s.includes('syntax') || s.includes('parse')) {
    return { label: 'JSONパース不整合', bg: 'bg-purple-100 text-purple-900 border-purple-300' };
  }
  return { label: '処理失敗', bg: 'bg-rose-100 text-rose-900 border-rose-300' };
}

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // インフラ・システムステータス
  const [systemStatus, setSystemStatus] = useState<{
    worker: { active: boolean; status: string; last_active: string | null; diff_seconds?: number };
    queue: any[];
    history: any[];
  }>({
    worker: { active: false, status: 'unknown', last_active: null },
    queue: [],
    history: []
  });

  const [systemMetrics, setSystemMetrics] = useState<any>({
    services: {},
    queue: { pending: 0, running: 0, completed: 0 },
    cloud_workers: {}
  });

  // 大会 & カジノ運用メトリクス
  const [ktmStats, setKtmStats] = useState<{
    activePlayers: number;
    totalMatches: number;
    recentMatches: number;
    latestMatchDate: string | null;
  }>({
    activePlayers: 0,
    totalMatches: 0,
    recentMatches: 0,
    latestMatchDate: null
  });

  const [casinoStats, setCasinoStats] = useState<{
    totalCirculatingCoins: number;
    topPlayers?: Array<{ id: number; name: string; coins: number; rank?: string }>;
    pendingBetTotalAmount: number;
    pendingBetCount: number;
    blueAmount: number;
    redAmount: number;
    blueCount: number;
    redCount: number;
  }>({
    totalCirculatingCoins: 0,
    topPlayers: [],
    pendingBetTotalAmount: 0,
    pendingBetCount: 0,
    blueAmount: 0,
    redAmount: 0,
    blueCount: 0,
    redCount: 0
  });

  // 要対応
  const [needsAttention, setNeedsAttention] = useState<{
    failedTasks: any[];
    youtubeErrorCount: number;
    dictReviewCount: number;
  }>({ failedTasks: [], youtubeErrorCount: 0, dictReviewCount: 0 });

  // Sovereign OS 全域ヘルスステータス
  const [healthStatus, setHealthStatus] = useState<{
    allGreen: boolean;
    statusText: string;
    metrics: {
      pendingFeedback: number;
      latestDailyLog: string;
      brokenLinks: number;
      typesPassing: boolean;
    };
  } | null>(null);

  const [isRetryingAll, setIsRetryingAll] = useState(false);

  // 認証チェック
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/dashboard-stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.worker) setSystemStatus({ worker: data.worker, queue: data.queue || [], history: data.history || [] });
        if (data.systemMetrics) setSystemMetrics(data.systemMetrics);
        if (data.ktmStats) setKtmStats(data.ktmStats);
        if (data.casinoStats) setCasinoStats(data.casinoStats);
        if (data.needsAttention) setNeedsAttention(data.needsAttention);
        setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
        setFetchError(null);
      } else {
        const errText = await res.text().catch(() => '');
        setFetchError(`データの取得に失敗しました (HTTP ${res.status}): ${errText.slice(0, 100)}`);
      }

      // ヘルスステータスの取得
      fetch('/api/admin/health')
        .then(r => r.json())
        .then(d => {
          if (d.success) setHealthStatus(d.health);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setFetchError(`ネットワークエラーが発生しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    const timer = setInterval(() => fetchData(true), 30000); // 30秒ごとにバックグラウンド更新
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // 失敗タスクの一括再実行
  const handleRetryAll = async () => {
    if (needsAttention.failedTasks.length === 0) return;
    setIsRetryingAll(true);
    try {
      const res = await fetch('/api/admin/tasks/retry-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: needsAttention.failedTasks }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`⚡ ${data.retriedCount}件の失敗タスクを一括再実行しました。`);
        fetchData(true);
      } else {
        toast.error(data.error || '一括再実行に失敗しました。');
      }
    } catch {
      toast.error('通信エラーが発生しました。');
    } finally {
      setIsRetryingAll(false);
    }
  };

  const TASK_LABELS: Record<string, string> = {
    champion_trend: 'チャンピオントレンド更新',
    resolve_youtube_channel: 'YouTubeチャンネル登録',
    resolve_youtube_playlist: 'YouTubeプレイリスト登録',
    youtube_channel_monitor: 'YouTubeチャンネル監視',
    reddit_scout: 'Redditスカウト',
    lol_trend_collect: 'LoLトレンド収集',
    dict_synthesizer: '辞典シンセサイザー',
    champion_db_bulk_update: 'チャンピオン辞典一括更新',
    youtube_absorb: 'YouTube動画解析',
  };

  const TASK_LINKS: Record<string, string> = {
    resolve_youtube_channel: '/champions?scope=knowledge&tab=video',
    resolve_youtube_playlist: '/champions?scope=knowledge&tab=video',
    youtube_channel_monitor: '/champions?scope=knowledge&tab=video',
    reddit_scout: '/champions?scope=health',
    lol_trend_collect: '/champions?scope=health',
    dict_synthesizer: '/champions?scope=health',
    champion_db_bulk_update: '/champions?scope=health',
  };

  // 認証チェック完了後に未認証であれば即座にログイン案内を表示
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f7f5f0] text-stone-900 font-sans">
        <div className="text-center max-w-sm rounded-3xl border border-stone-200/80 bg-white/90 backdrop-blur-md p-8 shadow-xl">
          <div className="text-4xl mb-3">🔑</div>
          <h2 className="text-lg font-black mb-2">管理者認証が必要です</h2>
          <p className="text-xs text-stone-500 mb-6 leading-relaxed">
            システム運用コントロールセンターは管理者専用です。Discord管理者アカウントでログインしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-500 shadow-md hover:shadow-amber-500/20"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  // 認証中、またはデータ読み込み中のスピナー表示
  if (isAuthenticated === null || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5f0]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-600" />
          <p className="text-xs font-bold text-stone-500">システム運用ダッシュボードを読み込み中...</p>
        </div>
      </div>
    );
  }

  const hasNeedsAttention = needsAttention.failedTasks.length > 0 || needsAttention.youtubeErrorCount > 0 || needsAttention.dictReviewCount > 0;
  const totalBetAmount = casinoStats.blueAmount + casinoStats.redAmount;
  const bluePercent = totalBetAmount > 0 ? Math.round((casinoStats.blueAmount / totalBetAmount) * 100) : 50;
  const redPercent = totalBetAmount > 0 ? 100 - bluePercent : 50;

  return (
    <div className="min-h-screen w-full bg-[#f7f5f0] text-stone-900 relative overflow-hidden">
      {/* Background Decorative Ambient Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-5%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-amber-500/10 blur-[130px] animate-pulse"></div>
        <div className="absolute top-[30%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-orange-500/10 blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[50vw] h-[50vw] rounded-full bg-amber-600/8 blur-[150px] animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 relative z-10">

        {/* 🌟 1. ヘッダー ＆ クイックナビゲーション */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-stone-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 shadow-2xs">
                <Shield size={20} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900">
                システム運用ダッシュボード
              </h1>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20">
                HQ v5.2
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              Sovereign OS 全体の稼働状況、大会・勝敗予想メトリクス、AI知識ベースの総合管制センター
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchData(false)}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-stone-200 hover:bg-white hover:border-stone-300 text-xs font-bold text-stone-700 transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="データを即時更新"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-amber-600' : 'text-stone-500'} />
              <span>{isRefreshing ? '更新中...' : '即時リフレッシュ'}</span>
            </button>

            <a
              href="sovereign-worker://start"
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-black text-white transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="ローカルエッジワーカーを起動"
            >
              <Zap size={13} />
              <span>ワーカー起動</span>
            </a>

            <button
              onClick={() => {
                navigator.clipboard.writeText("d:/my_work/.venv/Scripts/python.exe d:/my_work/03_SYSTEMS/v2_CORE/edge_worker_daemon.py");
                toast.success("📋 起動コマンドをクリップボードにコピーしました！\nPowerShell等で実行してください。");
              }}
              className="px-3 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-stone-200 hover:bg-white hover:border-stone-300 text-xs font-bold text-stone-700 transition shadow-xs flex items-center gap-1 cursor-pointer"
              title="Python起動コマンドをコピー"
            >
              <span>📋 コマンドコピー</span>
            </button>

            <Link
              href="/ktm-admin"
              className="px-3.5 py-2 rounded-xl bg-indigo-50/90 backdrop-blur-md border border-indigo-200 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition shadow-xs flex items-center gap-1.5"
            >
              <Trophy size={13} />
              <span>KTM大会管理</span>
            </Link>

            <Link
              href="/admin/prompts"
              className="px-3.5 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-stone-200 hover:bg-white hover:border-stone-300 text-xs font-bold text-stone-700 transition shadow-xs flex items-center gap-1.5"
            >
              <Cpu size={13} className="text-amber-600" />
              <span>AIプロンプト</span>
            </Link>

            {lastUpdated && (
              <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1 ml-1">
                <Clock size={11} /> {lastUpdated}
              </span>
            )}
          </div>
        </header>

        {/* ⚠️ データ取得エラー通知（APIタイムアウト・ネットワーク障害時） */}
        {fetchError && (
          <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-950 flex items-center gap-2.5 shadow-2xs backdrop-blur-md">
            <ShieldAlert size={16} className="text-rose-600 shrink-0" />
            <span className="text-xs font-bold">{fetchError}</span>
          </div>
        )}

        {/* 🛡️ Sovereign OS ナレッジ ＆ システム全系ヘルスステータス */}
        {healthStatus && (
          <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-2xs backdrop-blur-md ${
            healthStatus.allGreen 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-950'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="text-base">{healthStatus.allGreen ? '🛡️' : '⚠️'}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black">
                    Sovereign OS ナレッジ＆全系健全性: {healthStatus.statusText}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    healthStatus.allGreen 
                      ? 'bg-emerald-500/20 text-emerald-900 border-emerald-500/40' 
                      : 'bg-amber-500/20 text-amber-900 border-amber-500/40'
                  }`}>
                    {healthStatus.allGreen ? 'ALL GREEN' : 'ATTENTION'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-600 flex items-center gap-3 mt-0.5 font-medium flex-wrap">
                  <span>🔗 リンク切れ: <strong className="text-emerald-700 font-bold">{healthStatus.metrics.brokenLinks}件</strong></span>
                  <span>📅 デイリー日誌: <strong className="text-stone-800 font-bold">{healthStatus.metrics.latestDailyLog}</strong></span>
                  <span>📮 指摘インボックス: <strong className={healthStatus.metrics.pendingFeedback > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>{healthStatus.metrics.pendingFeedback}件未対応</strong></span>
                </div>
              </div>
            </div>
            <Link
              href="/admin/knowledge?tab=inbox"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 shadow-2xs transition"
            >
              📮 インボックスを確認
            </Link>
          </div>
        )}

        {/* 🚨 2. アラート ＆ 要対応セクション（問題がある時のみ目立たせて表示） */}
        {!systemStatus.worker.active && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                <Zap size={18} className="animate-pulse" />
              </div>
              <div>
                <span className="font-black text-xs block text-stone-900">
                  ℹ️ ローカルPythonワーカー（エッジワーカー）は待機中/未起動です
                </span>
                <p className="text-[11px] text-stone-600 font-medium mt-0.5">
                  YouTube動画解析タスクなどPCリソースが必要な処理のみワーカー起動が必要です。通常のポータル利用・大会運営はクラウドで自律稼働しています。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <a
                href="sovereign-worker://start"
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition shadow-xs flex items-center gap-1.5"
              >
                <Zap size={12} /> 起動
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("d:/my_work/.venv/Scripts/python.exe d:/my_work/03_SYSTEMS/v2_CORE/edge_worker_daemon.py");
                  toast.success("📋 起動コマンドをクリップボードにコピーしました！\nPowerShell等で実行してください。");
                }}
                className="px-3 py-1.5 rounded-xl bg-white/90 border border-stone-300 hover:bg-white text-stone-700 text-xs font-bold transition shadow-xs"
              >
                コマンドコピー
              </button>
            </div>
          </motion.div>
        )}

        {hasNeedsAttention && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-950 space-y-3 shadow-xs backdrop-blur-md"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/80 pb-2.5">
              <h3 className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-rose-600" />
                <span>⚠️ 要対応タスク ({needsAttention.failedTasks.length + (needsAttention.youtubeErrorCount > 0 ? 1 : 0) + (needsAttention.dictReviewCount > 0 ? 1 : 0)}件)</span>
              </h3>

              {needsAttention.failedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleRetryAll}
                  disabled={isRetryingAll}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw size={12} className={isRetryingAll ? 'animate-spin' : ''} />
                  <span>⚡ 失敗タスクを一括再実行 ({needsAttention.failedTasks.length}件)</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {needsAttention.failedTasks.map((task) => {
                const errSummary = summarizeError(task.error_message);
                return (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-white/90 border border-rose-100 shadow-2xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-black text-stone-900">
                          {TASK_LABELS[task.task_type] || task.task_type}
                          {task.payload?.champion && <span className="text-stone-500 font-normal">（{task.payload.champion}/{task.payload.role || ''}）</span>}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${errSummary.bg}`}>
                          {errSummary.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono truncate" title={task.error_message || ''}>
                        {(task.error_message || '').slice(0, 90) || '(エラー詳細なし)'}
                      </div>
                    </div>

                    <Link href={TASK_LINKS[task.task_type] || '/admin/dashboard'} className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline shrink-0">
                      詳細へ →
                    </Link>
                  </div>
                );
              })}

              {needsAttention.youtubeErrorCount > 0 && (
                <Link
                  href="/admin/youtube"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/90 border border-rose-200 hover:border-rose-300 transition"
                >
                  <span className="text-xs font-bold text-stone-900">YouTube動画キューのエラー・手動対応要 ({needsAttention.youtubeErrorCount}件)</span>
                  <span className="text-[11px] font-bold text-rose-700">管理画面へ →</span>
                </Link>
              )}
              {needsAttention.dictReviewCount > 0 && (
                <Link
                  href="/champions?scope=health"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/90 border border-rose-200 hover:border-rose-300 transition"
                >
                  <span className="text-xs font-bold text-stone-900">チャンピオン辞典 鮮度レビュー要対応 ({needsAttention.dictReviewCount}件)</span>
                  <span className="text-[11px] font-bold text-rose-700">データ整備へ →</span>
                </Link>
              )}
            </div>
          </motion.div>
        )}

        {/* 🏆 3. 大会 ＆ 勝敗予想（カジノ）運用状況 (新規統合) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
              <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                🏆 大会 ＆ コミュニティ運用ステータス
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/ktm-admin" className="text-xs font-bold text-indigo-600 hover:underline">
                大会管理 ➔
              </Link>
              <span className="text-stone-300">|</span>
              <Link href="/casino" className="text-xs font-bold text-amber-600 hover:underline">
                勝敗予想 ➔
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 登録プレイヤー */}
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/80 shadow-xs flex flex-col justify-between hover:border-stone-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-600" />
                  登録プレイヤー
                </span>
                <Link href="/player" className="text-[11px] font-bold text-indigo-600 hover:underline">
                  名簿 →
                </Link>
              </div>
              <div className="text-2xl font-black text-stone-900">
                {ktmStats.activePlayers.toLocaleString()} <span className="text-xs font-bold text-stone-400">名</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                レーティング・ロール設定済みのアクティブメンバー
              </p>
            </div>

            {/* 大会試合数 */}
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/80 shadow-xs flex flex-col justify-between hover:border-stone-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
                  <Trophy size={14} className="text-amber-600" />
                  カスタム大会 試合数
                </span>
                <Link href="/ktm-admin?tab=history" className="text-[11px] font-bold text-amber-600 hover:underline">
                  履歴 →
                </Link>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-black text-stone-900">
                  {ktmStats.totalMatches.toLocaleString()} <span className="text-xs font-bold text-stone-400">試合</span>
                </div>
                {ktmStats.recentMatches > 0 && (
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                    直近7日: +{ktmStats.recentMatches}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                {ktmStats.latestMatchDate ? `最終開催: ${new Date(ktmStats.latestMatchDate).toLocaleDateString('ja-JP')}` : '開催履歴なし'}
              </p>
            </div>

            {/* 総流通コイン */}
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/80 shadow-xs flex flex-col justify-between hover:border-stone-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
                  <Coins size={14} className="text-amber-500" />
                  総流通コイン量
                </span>
                <Link href="/leaderboard" className="text-[11px] font-bold text-amber-600 hover:underline">
                  順位表 →
                </Link>
              </div>
              <div className="text-2xl font-black text-amber-700">
                🪙 {casinoStats.totalCirculatingCoins.toLocaleString()} <span className="text-xs font-bold text-stone-400">pt</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                コミュニティ全体のプレイヤー所持コイン総額
              </p>
            </div>

            {/* 受付中ベット */}
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/80 shadow-xs flex flex-col justify-between hover:border-stone-300 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
                  <Flame size={14} className="text-rose-500" />
                  勝敗予想（未精算）
                </span>
                <Link href="/casino" className="text-[11px] font-bold text-rose-600 hover:underline">
                  カジノ →
                </Link>
              </div>
              <div>
                <div className="text-2xl font-black text-stone-900">
                  {casinoStats.pendingBetTotalAmount > 0 ? (
                    <>
                      {casinoStats.pendingBetTotalAmount.toLocaleString()} <span className="text-xs font-bold text-stone-400">pt ({casinoStats.pendingBetCount}票)</span>
                    </>
                  ) : (
                    <span className="text-base text-stone-400 font-bold">待機中 (受付なし)</span>
                  )}
                </div>
                {totalBetAmount > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="h-2 w-full bg-stone-200/60 rounded-full overflow-hidden flex">
                      <div style={{ width: `${bluePercent}%` }} className="bg-sky-500 h-full"></div>
                      <div style={{ width: `${redPercent}%` }} className="bg-rose-500 h-full"></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-stone-500">
                      <span className="text-sky-600">青 {bluePercent}% ({casinoStats.blueCount}票)</span>
                      <span className="text-rose-600">赤 {redPercent}% ({casinoStats.redCount}票)</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                次回カスタム試合のリアルタイム投票状況
              </p>
            </div>
          </div>
        </section>

        {/* 🛰️ 4. サービス稼働ノード ＆ クラウド自動実行 (インフラコクピット) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
              <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                🛰️ システムインフラ ＆ 自動ワークフロー
              </h2>
            </div>
            <span className="text-[11px] text-stone-400 font-medium">常時自律監視中</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { id: 'portal', name: 'Webポータル', desc: 'Vercel / Next.js 16', kind: 'cloud' as const },
              { id: 'bot', name: 'Discord Bot (KTM)', desc: 'Cloudflare Workers', kind: 'cloud' as const },
              { id: 'edge_worker', name: 'エッジワーカー', desc: 'ローカルPython実行エンジン', kind: 'worker' as const },
              { id: 'youtube_absorber', name: 'YouTube解析', desc: '動画知識吸収ノード', kind: 'local' as const },
            ].map((service) => {
              let statusText = '稼働中';
              let statusColor = 'text-emerald-700 bg-emerald-100/80 border-emerald-300';
              let indicatorColor = 'bg-emerald-500';

              if (service.kind === 'worker') {
                if (systemStatus.worker.active) {
                  statusText = '稼働中';
                  statusColor = 'text-emerald-700 bg-emerald-100/80 border-emerald-300';
                  indicatorColor = 'bg-emerald-500';
                } else {
                  statusText = '待機中 (必要時起動)';
                  statusColor = 'text-stone-600 bg-stone-100 border-stone-200';
                  indicatorColor = 'bg-stone-400';
                }
              } else if (service.kind === 'local') {
                if (systemStatus.worker.active) {
                  statusText = '待機中 (即時実行可)';
                  statusColor = 'text-emerald-700 bg-emerald-100/80 border-emerald-300';
                  indicatorColor = 'bg-emerald-500 animate-pulse';
                } else {
                  statusText = '待機中';
                  statusColor = 'text-stone-600 bg-stone-100 border-stone-200';
                  indicatorColor = 'bg-stone-400';
                }
              }

              return (
                <div key={service.id} className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/80 shadow-xs flex flex-col justify-between hover:border-stone-300 transition">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-black text-stone-900">{service.name}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${indicatorColor}`}></span>
                    </div>
                    <p className="text-[10px] text-stone-400 mb-2">{service.desc}</p>
                    
                    {service.id === 'edge_worker' && (
                      <div className="flex items-center gap-1.5 my-2">
                        <a
                          href="sovereign-worker://start"
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="ローカルワーカーを起動"
                        >
                          <Zap size={11} /> 起動
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText("d:/my_work/.venv/Scripts/python.exe d:/my_work/03_SYSTEMS/v2_CORE/edge_worker_daemon.py");
                            toast.success("📋 起動コマンドをクリップボードにコピーしました！\nPowerShell等で実行してください。");
                          }}
                          className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold border border-stone-200 transition cursor-pointer"
                          title="Python起動コマンドをコピー"
                        >
                          📋 コピー
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-stone-100 mt-1">
                    <span className="text-[10px] font-bold text-stone-400">{service.kind === 'cloud' ? '常時稼働' : 'オンデマンド'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusColor}`}>{statusText}</span>
                  </div>
                </div>
              );
            })}
          </div>

        </section>

      </div>
    </div>
  );
}
