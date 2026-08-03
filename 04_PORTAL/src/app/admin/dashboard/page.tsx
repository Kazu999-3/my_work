"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, ShieldAlert, Cpu, Network, Gamepad2, RefreshCw, CheckCircle2, X, ChevronRight, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { supabaseBrowser } from '../../../lib/supabaseBrowserClient';
import Link from 'next/link';


export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [apiUsage, setApiUsage] = useState<number>(0);
  const [systemMetrics, setSystemMetrics] = useState<any>({ queue: { pending: 0, completed: 0 }, cloud_workers: {} });
  const [recentDictUpdates, setRecentDictUpdates] = useState<any[]>([]);
  const [recentLibraryUpdates, setRecentLibraryUpdates] = useState<any[]>([]);
  const [recentYoutubeQueue, setRecentYoutubeQueue] = useState<any[]>([]);
  const [needsAttention, setNeedsAttention] = useState<{ failedTasks: any[]; youtubeErrorCount: number; dictReviewCount: number }>({ failedTasks: [], youtubeErrorCount: 0, dictReviewCount: 0 });
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [setupChecks, setSetupChecks] = useState<Record<string, boolean> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeSystemTab, setActiveSystemTab] = useState<'nodes' | 'queue'>('nodes');

  // システムの稼働状況とジョブキューの状況を監視する状態
  const [systemStatus, setSystemStatus] = useState<{
    worker: { active: boolean; status: string; last_active: string | null };
    queue: any[];
    history: any[];
  }>({
    worker: { active: false, status: 'unknown', last_active: null },
    queue: [],
    history: []
  });

  // 1. 認証の確認（middleware.tsが/admin/*を既にCookieでゲートしているため、
  // ここに到達している時点でCookie自体は有効。UI側のローディング制御のみ。）
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // 2. 認証完了後にステータスチェックを実行
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/system/status');
        if (res.ok) {
          const data = await res.json();
          setSystemStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch system status:', err);
      }
    };
    checkStatus();
  }, [isAuthenticated]);



  // 知識ベースの整備状況（件数のみ・head:trueでエグレスを抑える）
  const [kbStats, setKbStats] = useState<{ facts: number | null; library: number | null; laneGuides: number | null; memos: number | null; matchupLog: number | null }>({
    facts: null, library: null, laneGuides: null, memos: null, matchupLog: null,
  });

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard-stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.worker) setSystemStatus({ worker: data.worker, queue: data.queue || [], history: data.history || [] });
        if (data.kbStats) setKbStats(data.kbStats);
        if (data.systemMetrics) setSystemMetrics(data.systemMetrics);
        if (data.apiUsage !== undefined) setApiUsage(data.apiUsage);
        if (data.recentYoutubeQueue) setRecentYoutubeQueue(data.recentYoutubeQueue);
        if (data.recentDictUpdates) setRecentDictUpdates(data.recentDictUpdates);
        if (data.recentLibraryUpdates) setRecentLibraryUpdates(data.recentLibraryUpdates);
        if (data.needsAttention) setNeedsAttention(data.needsAttention);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setIsLoading(false);
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

  // 「詳細へ」の遷移先をtask_typeごとに正しく振り分ける（以前は全種別が一律/admin/youtubeに
  // 飛んでいて、辞典一括更新等の失敗がYouTube管理画面を開いても何も解決できなかった）
  const TASK_LINKS: Record<string, string> = {
    resolve_youtube_channel: '/admin/youtube',
    resolve_youtube_playlist: '/admin/youtube',
    youtube_channel_monitor: '/admin/youtube',
    reddit_scout: '/champions?tab=ai-update',
    lol_trend_collect: '/champions?tab=ai-update',
    dict_synthesizer: '/champions?tab=ai-update',
    champion_db_bulk_update: '/champions?tab=ai-update',
  };

  const handleRetryFailedTask = async (task: any) => {
    if (task.task_type !== 'champion_trend') return;
    setRetryingTaskId(task.id);
    try {
      const res = await fetch('/api/admin/champions/trend', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: task.payload?.champion, role: task.payload?.role || 'Jungle' }),
      });
      const data = await res.json();
      if (data.success) {
        setNeedsAttention((prev) => ({ ...prev, failedTasks: prev.failedTasks.filter((t) => t.id !== task.id) }));
      } else {
        alert(data.error || '再実行の登録に失敗しました。');
      }
    } catch {
      alert('再実行の登録中に通信エラーが発生しました。');
    } finally {
      setRetryingTaskId(null);
    }
  };




  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
  }, [isAuthenticated]);

  // セットアップ未完了チェックリスト（環境変数の設定有無のみ。値は取得しない）
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setSetupChecks({
        db: !!data.db,
        riotKey: !!data.riotKey,
        geminiKey: !!data.geminiKey,
        vapid: !!data.vapid,
        discordWebhook: !!data.discordWebhook,
        portalBotSecret: !!data.portalBotSecret,
      }))
      .catch(() => {});
  }, [isAuthenticated]);

  const handleResetQueue = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/queue/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsErrorModalOpen(false);
        fetchData(true);
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラーが発生しました: ${e.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 100 }
    }
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ minHeight: '100vh' }} className="flex-1 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-amber-600" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f1e6 0%, #fdfcf9 60%, #f5f1e6 100%)' }}
        className="flex-1 flex items-center justify-center p-4 font-sans text-stone-900"
      >
        <div className="text-center max-w-sm rounded-3xl border border-stone-200 bg-white p-8 shadow-2xl">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2">認証が必要です</h2>
          <p className="text-sm text-stone-500 mb-4 leading-relaxed">
            この管理版コントロールセンターは管理者専用です。Discordアカウントでログインしてからアクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 shadow-lg hover:shadow-amber-500/20"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6 relative overflow-hidden">

      {/* Background Decorative Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-amber-500/10 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-500/10 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Header Section */}
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-2"
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-600 blur opacity-10"></div>
          <h1 className="relative text-2xl md:text-3xl font-black tracking-tighter mb-1">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-700 via-orange-700 to-rose-700">Sovereign OS</span>
            <span className="text-stone-500 ml-2 font-mono text-2xl opacity-80">v5.0</span>
          </h1>
          <p className="text-amber-700 font-bold text-xs uppercase tracking-[0.2em] flex items-center gap-1.5 mt-1">
            <Activity size={14} className="animate-pulse text-amber-600" />
            <span>Advanced Agentic Control Center</span>
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 flex-wrap">
          <Link href="/admin/prompts" className="px-3 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 text-xs font-bold text-stone-600 transition-all flex items-center gap-1.5 shadow-sm">
            <Cpu size={13} className="text-amber-600" />
            <span>AI プロンプト設定 ➔</span>
          </Link>
          {lastUpdated && (
            <span className="text-[11px] text-stone-500 font-mono">最終更新: {lastUpdated}</span>
          )}
        </div>
      </motion.header>

      {/* 要対応パネル: 失敗タスクとエラーをスリム表示 */}
      {(needsAttention.failedTasks.length > 0 || needsAttention.youtubeErrorCount > 0 || needsAttention.dictReviewCount > 0) && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-panel rounded-2xl p-3 border border-rose-300 bg-rose-50/70"
        >
          <h3 className="text-base font-black text-rose-700 flex items-center gap-2 mb-2.5">
            <ShieldAlert size={18} /> ⚠️ 要対応（{needsAttention.failedTasks.length + (needsAttention.youtubeErrorCount > 0 ? 1 : 0) + (needsAttention.dictReviewCount > 0 ? 1 : 0)}件）
          </h3>
          <div className="space-y-1.5">
            {needsAttention.failedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white border border-black/5">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-900">
                    {TASK_LABELS[task.task_type] || task.task_type}
                    {task.payload?.champion && <span className="text-stone-500 font-normal"> （{task.payload.champion}/{task.payload.role || ''}）</span>}
                    {task.executor && <span className="ml-1.5 text-[9px] text-stone-500 font-normal">({task.executor === 'cloud' ? 'クラウド' : 'ローカル'})</span>}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5 truncate" title={task.error_message || ''}>
                    {(task.error_message || '').slice(0, 80) || '(エラー詳細なし)'}
                  </div>
                </div>
                {task.task_type === 'champion_trend' ? (
                  <button
                    onClick={() => handleRetryFailedTask(task)}
                    disabled={retryingTaskId === task.id}
                    className="shrink-0 px-2.5 py-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-700 font-bold text-[11px] rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={retryingTaskId === task.id ? 'animate-spin' : ''} /> 再実行
                  </button>
                ) : (
                  <Link href={TASK_LINKS[task.task_type] || '/admin/dashboard'} className="shrink-0 text-[11px] font-bold text-stone-500 hover:text-stone-900 underline">詳細へ</Link>
                )}
              </div>
            ))}
            {needsAttention.youtubeErrorCount > 0 && (
              <Link
                href="/admin/youtube"
                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white border border-black/5 hover:border-rose-300 transition-colors"
              >
                <span className="text-xs font-bold text-stone-900">YouTube動画キューのエラー・手動対応要 {needsAttention.youtubeErrorCount}件</span>
                <span className="text-[11px] font-bold text-rose-700">管理画面へ →</span>
              </Link>
            )}
            {needsAttention.dictReviewCount > 0 && (
              <Link
                href="/admin/knowledge?tab=maintenance"
                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white border border-black/5 hover:border-rose-300 transition-colors"
              >
                <span className="text-xs font-bold text-stone-900">辞典の鮮度レビューで要対応 {needsAttention.dictReviewCount}件（週次自動検知）</span>
                <span className="text-[11px] font-bold text-rose-700">データ整備へ →</span>
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >

        {/* エッジワーカー依存機能 & 起動コントロールカード (2カラム化) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2 glass-panel rounded-2xl p-3.5 relative overflow-hidden border border-black/5 bg-gradient-to-r from-amber-50/60 via-white/40 to-orange-50/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${systemStatus.worker.active ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-rose-100 border-rose-300 text-rose-700'}`}>
                  <Cpu size={18} className={systemStatus.worker.active ? '' : 'animate-pulse'} />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5 flex-wrap">
                    エッジワーカー
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      systemStatus.worker.active
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                        : 'bg-rose-100 border-rose-300 text-rose-700 animate-pulse'
                    }`}>
                      {systemStatus.worker.active ? '🟢 稼働中' : '🔴 停止中'}
                    </span>
                  </h3>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 mb-3">
              YouTube解析等、PC上でのWorker実行が必要なタスク用ステータスです。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="sovereign-worker://start"
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-[11px] rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                title="ローカルワーカーを起動"
              >
                <Zap size={14} /> 🚀 ワーカー起動
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("d:/my_work/.venv/Scripts/python.exe d:/my_work/03_SYSTEMS/v2_CORE/edge_worker_daemon.py");
                  alert("📋 起動コマンドをクリップボードにコピーしました！\nPowerShell等で実行してください。");
                }}
                className="px-3 py-2 glass-panel glass-panel-hover text-stone-600 hover:text-stone-900 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1"
              >
                📋 コピー
              </button>
            </div>

            <details className="group border-t border-black/5 pt-2">
              <summary className="text-[10px] font-bold text-stone-500 hover:text-stone-700 cursor-pointer select-none list-none flex items-center gap-1">
                <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                内訳詳細
              </summary>
              <div className="pt-2 text-[10px] text-stone-600 space-y-1">
                <div>⚡ <strong>PC起動必須:</strong> YouTube動画解析</div>
                <div>🌐 <strong>クラウド自動:</strong> 辞典更新/プロビルド/5v5/戦績同期</div>
              </div>
            </details>
          </div>
        </motion.div>

        {/* QUOTA Card (2カラム化・コンパクト) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2 glass-panel glass-panel-hover rounded-2xl p-3.5 relative overflow-hidden border border-black/5 bg-gradient-to-b from-black/[0.02] to-transparent flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-400/15 rounded-full blur-[40px] -mr-8 -mt-8 pointer-events-none"></div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 border border-orange-200 rounded-xl text-orange-700">
                <Zap size={18} />
              </div>
              <h3 className="text-base font-black text-stone-900 tracking-tight">API Quota (1500回/日)</h3>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl md:text-4xl font-black text-stone-900 tracking-tight">{apiUsage}</span>
                <span className="text-xs text-stone-500 font-medium">/ 1500 消費</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-500 block">残り</span>
                <span className="text-lg font-bold text-emerald-700">{Math.max(0, 1500 - apiUsage)}</span>
              </div>
            </div>

            <div className="w-full bg-black/[0.05] rounded-full h-2.5 overflow-hidden border border-black/5">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${apiUsage >= 1500 ? 'bg-rose-500' : apiUsage > 1200 ? 'bg-gradient-to-r from-orange-400 to-rose-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                style={{ width: `${Math.min((apiUsage / 1500) * 100, 100)}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[9px] text-stone-500 font-medium">
              <span>0%</span>
              <span>リセット: 16:00 (JST)</span>
              <span>100%</span>
            </div>
          </div>
        </motion.div>

        {/* New Dashboard Widgets */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-3.5">

          {/* Panel B: YouTube Absorber Queue (全幅表示) */}
          <div className="md:col-span-2 lg:col-span-4 glass-panel rounded-2xl p-3.5 border border-black/5 bg-gradient-to-br from-amber-50/70 to-transparent flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                    <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                    YouTube 吸収キュー
                  </h3>
                  {systemMetrics.services?.youtube_absorber?.running && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-black text-amber-700 animate-pulse tracking-wider">
                      RUNNING
                    </span>
                  )}
                </div>
                <Link href="/admin/youtube" className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-0.5">
                  管理画面へ →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-black/[0.03] p-2.5 rounded-xl border border-black/5 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-stone-900 mb-0.5">{systemMetrics.queue?.pending || 0}</span>
                  <span className="text-[11px] text-stone-500 font-bold">待機中 (Pending)</span>
                </div>
                <div className="bg-black/[0.03] p-2.5 rounded-xl border border-black/5 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-stone-900 mb-0.5">{systemMetrics.queue?.completed || 0}</span>
                  <span className="text-[11px] text-stone-500 font-bold">完了 (Completed)</span>
                </div>
              </div>
            </div>

            {recentYoutubeQueue.length > 0 && (
              <div className="space-y-2 mt-3 pt-3 border-t border-black/5">
                <p className="text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-0.5">直近の解析状況</p>
                {recentYoutubeQueue.slice(0, 3).map((item, idx) => {
                  let statusColor = 'text-stone-600';
                  let statusBg = 'bg-stone-100 border-stone-200';
                  let statusText = item.status;

                  if (item.status === 'completed') {
                    statusColor = 'text-green-700';
                    statusBg = 'bg-green-100 border-green-200';
                    statusText = '完了';
                  } else if (item.status === 'pending') {
                    statusColor = 'text-amber-700';
                    statusBg = 'bg-amber-100 border-amber-200';
                    statusText = '解析中';
                  } else if (item.status.startsWith('error') || item.status === 'failed') {
                    statusColor = 'text-red-700';
                    statusBg = 'bg-red-100 border-red-200';
                    statusText = 'エラー';
                  }

                  return (
                    <div key={idx} className="flex justify-between items-center gap-2 bg-black/[0.03] p-2 rounded-xl border border-black/5 text-xs">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-stone-800 text-[11px] truncate" title={item.title}>
                          {item.title}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold shrink-0 ${statusBg} ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* 🛠️ システムコクピット (System Cockpit) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-2">
          <div className="glass-panel rounded-2xl p-3.5 border border-black/5 bg-white/50 space-y-3">

            {/* タブナビゲーション */}
            <div className="flex justify-between items-center border-b border-black/5 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 bg-gradient-to-b from-orange-400 via-amber-400 to-rose-500 rounded-full"></div>
                <h3 className="text-base font-black text-stone-900">🛠️ システムコクピット</h3>
              </div>
              <div className="flex glass-panel p-0.5 rounded-lg items-center border border-black/5 bg-black/[0.03]">
                {[
                  { id: 'nodes', label: '🛰️ サービス監視' },
                  { id: 'queue', label: '⚡ ジョブ実行キュー' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSystemTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      activeSystemTab === tab.id
                        ? 'bg-white text-stone-900 shadow-sm border border-black/5'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* タブコンテンツ */}
            <div className="mt-3">
              {/* 1. 🛰️ サービス監視 (Nodes Sentinel) */}
              {activeSystemTab === 'nodes' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-stone-500">
                    ポータルとBotはクラウドで常時稼働しています。動画解析まわりはPC起動時のみ動くため、<strong className="text-stone-700">「未起動」は正常な状態</strong>です。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {[
                      { id: 'portal', name: 'Next.js Portal', desc: 'ポータル (Vercel)', kind: 'cloud' as const },
                      { id: 'bot', name: 'Discord Bot (KTM)', desc: 'Bot (Workers)', kind: 'cloud' as const },
                      { id: 'edge_worker', name: 'Edge Worker', desc: 'タスク実行 (ローカル)', kind: 'worker' as const },
                      { id: 'youtube_absorber', name: 'YouTube Absorber', desc: '動画解析 (ローカル)', kind: 'local' as const },
                    ].map((service) => {
                      const status = systemMetrics.services?.[service.id] || {};
                      const metricsTime = systemMetrics.updated_at ? Number(systemMetrics.updated_at) * 1000 : 0;
                      const isDaemonOffline = !metricsTime || (Date.now() - metricsTime > 60000);
                      const isRunning = isDaemonOffline ? false : status.running;

                      let statusText = '停止中';
                      let statusColor = 'text-stone-500 bg-stone-100 border-stone-200';
                      let indicatorColor = 'bg-stone-400';

                      if (service.kind === 'cloud') {
                        statusText = '稼働中';
                        statusColor = 'text-emerald-700 bg-emerald-100 border-emerald-200';
                        indicatorColor = 'bg-emerald-400';
                      } else if (service.kind === 'worker') {
                        if (systemStatus.worker.active) {
                          statusText = '稼働中';
                          statusColor = 'text-amber-700 bg-amber-100 border-amber-200';
                          indicatorColor = 'bg-amber-400 animate-pulse';
                        } else {
                          statusText = '未起動';
                          statusColor = 'text-stone-500 bg-black/[0.03] border-black/10';
                          indicatorColor = 'bg-stone-400';
                        }
                      } else if (isRunning) {
                        statusText = service.id === 'youtube_absorber' ? '解析中' : '稼働中';
                        statusColor = 'text-amber-700 bg-amber-100 border-amber-200';
                        indicatorColor = 'bg-amber-400 animate-pulse';
                      } else {
                        statusText = '未起動';
                        statusColor = 'text-stone-500 bg-black/[0.03] border-black/10';
                        indicatorColor = 'bg-stone-400';
                      }

                      return (
                        <div key={service.id} className="bg-black/[0.03] p-3 rounded-xl border border-black/5 flex flex-col justify-between hover:border-black/10 transition-colors">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-stone-800">{service.name}</span>
                              <span className={`w-2 h-2 rounded-full ${indicatorColor}`}></span>
                            </div>
                            <p className="text-[9px] text-stone-500 mb-2">{service.desc}</p>
                          </div>
                          <div className="flex justify-between items-center mt-auto">
                            <span className="text-[9px] font-mono text-stone-400">{service.kind === 'cloud' ? '常時' : '必要時'}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusColor}`}>{statusText}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ☁️ クラウドワーカー (GitHub Actions) の最終実行ログ */}
                  {systemMetrics.cloud_workers && Object.keys(systemMetrics.cloud_workers).length > 0 && (
                    <div className="pt-6 border-t border-black/5">
                      <h4 className="text-xs font-bold text-stone-700 mb-3 flex items-center gap-2">
                        <span>☁️</span> GitHub Actions ワーカー実行ステータス
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(systemMetrics.cloud_workers).map(([workerKey, log]: [string, any]) => {
                          const isOk = log.status === 'ok';
                          const isWarn = log.status === 'warn';
                          const statusBg = isOk ? 'border-emerald-200 bg-emerald-50' : isWarn ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50';
                          const badgeColor = isOk ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : isWarn ? 'text-amber-700 bg-amber-100 border-amber-200' : 'text-rose-700 bg-rose-100 border-rose-200';

                          const updatedTime = log.updated_at ? new Date(log.updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '時刻不明';

                          return (
                            <div key={workerKey} className={`p-4 rounded-2xl border text-xs bg-white/60 ${statusBg}`}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-stone-900 uppercase">{workerKey}</span>
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${badgeColor}`}>
                                  {isOk ? '正常完了' : isWarn ? '一部失敗/警告' : 'エラー'}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-700 mb-2 font-medium">{log.summary}</p>
                              {log.details && log.details.length > 0 && (
                                <div className="space-y-1 mb-2 bg-black/[0.04] p-2 rounded-lg text-[10px] text-stone-600 font-mono">
                                  {log.details.slice(0, 3).map((detail: string, i: number) => (
                                    <div key={i} className="truncate">• {detail}</div>
                                  ))}
                                </div>
                              )}
                              <div className="text-[9px] text-stone-500 text-right">最終実行: {updatedTime}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. ⚡ ジョブ実行キュー (Job Queue) */}
              {activeSystemTab === 'queue' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-black/5 pb-4 flex-wrap gap-2">
                    <p className="text-xs text-stone-500">
                      Discord Bot（エッジワーカー）のジョブ処理状況です。
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black border px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all ${
                        systemStatus.worker.active
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-rose-100 border-rose-300 text-rose-700 animate-pulse'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${systemStatus.worker.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {systemStatus.worker.active ? 'エッジワーカー: 稼働中' : 'エッジワーカー: 停止中'}
                      </span>
                      <span className="text-xs text-stone-500 font-mono">
                        最終更新: {systemStatus.worker.last_active ? new Date(systemStatus.worker.last_active).toLocaleTimeString() : '未受信'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* 現在実行中のタスク */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                        <span>●</span> 現在実行中のタスク
                      </h4>
                      {systemStatus.queue.filter(t => t.status === 'running').length === 0 ? (
                        <div className="text-xs text-stone-500 py-4 text-center rounded-2xl border border-black/5 bg-black/[0.03]">
                          現在実行中のタスクはありません（待機中）
                        </div>
                      ) : (
                        systemStatus.queue.filter(t => t.status === 'running').map(task => (
                          <div key={task.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs bg-amber-100 border border-amber-300 text-amber-700 px-2 py-0.5 rounded font-mono font-bold">
                                {task.task_type}
                              </span>
                              <span className="text-[10px] text-stone-500 font-mono">ID: {task.id.slice(0, 8)}...</span>
                            </div>
                            <div className="text-[10px] text-stone-600 font-mono bg-black/[0.04] p-2 rounded border border-black/5 break-all max-h-24 overflow-y-auto">
                              {JSON.stringify(task.payload, null, 2)}
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-stone-500 pt-1">
                              <span>🔥 実行中</span>
                              <span>開始: {new Date(task.updated_at).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 待機中のキュー一覧 */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                        <span>●</span> 待機中のタスク列 ({systemStatus.queue.filter(t => t.status === 'pending').length})
                      </h4>
                      {systemStatus.queue.filter(t => t.status === 'pending').length === 0 ? (
                        <div className="text-xs text-stone-500 py-4 text-center rounded-2xl border border-black/5 bg-black/[0.03]">
                          待機中のタスクはありません
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {systemStatus.queue.filter(t => t.status === 'pending').map((task, idx) => (
                            <div key={task.id} className="p-3 rounded-xl border border-black/5 bg-black/[0.03] flex justify-between items-center gap-4 hover:border-black/10 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-xs font-bold text-stone-500 font-mono w-5">#{idx + 1}</span>
                                <span className="text-xs bg-black/5 border border-black/10 text-stone-700 px-2 py-0.5 rounded font-mono truncate" title={task.task_type}>
                                  {task.task_type}
                                </span>
                              </div>
                              <span className="text-[9px] text-stone-500 font-mono shrink-0">
                                {new Date(task.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 直近の実行履歴 */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                        <span>●</span> 直近の実行履歴 (直近5件)
                      </h4>
                      {systemStatus.history.length === 0 ? (
                        <div className="text-xs text-stone-500 py-4 text-center rounded-2xl border border-black/5 bg-black/[0.03]">
                          履歴はありません
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {systemStatus.history.map(task => (
                            <div key={task.id} className="p-3 rounded-xl border border-black/5 bg-black/[0.03] space-y-1.5">
                              <div className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-black/5 text-stone-600 px-2 py-0.5 rounded font-mono">
                                    {task.task_type}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                    task.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-100 text-rose-700 border border-rose-200'
                                  }`}>
                                    {task.status === 'completed' ? '成功' : '失敗'}
                                  </span>
                                </div>
                                <span className="text-[9px] text-stone-500 font-mono">
                                  {new Date(task.updated_at).toLocaleTimeString()}
                                </span>
                              </div>
                              {task.status === 'failed' && task.error_message && (
                                <div className="text-[9px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded font-mono break-all max-h-16 overflow-y-auto">
                                  エラー: {task.error_message}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-3.5">

          {/* 知識ベースの整備状況 */}
          <div className="glass-panel rounded-2xl p-3.5 border border-black/5 bg-gradient-to-br from-emerald-50/70 to-transparent lg:col-span-2">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
                知識ベースの整備状況
              </h3>
              <Link href="/admin/knowledge" className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">🛠️ データ整備へ →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: 'チャンピオン辞典', value: kbStats.facts, href: '/champions', color: 'text-amber-700' },
                { label: '未整理の記事', value: kbStats.library, href: '/admin/knowledge', color: 'text-orange-700' },
                { label: 'レーン別ガイド', value: kbStats.laneGuides, href: '/lane-guides', color: 'text-amber-700', suffix: '/6' },
                { label: '対面メモ', value: kbStats.memos, href: '/coach?tab=matchup-memo', color: 'text-amber-700' },
                { label: '対面カルテ', value: kbStats.matchupLog, href: '/coach?tab=matchup-memo', color: 'text-rose-700' },
              ].map((s) => (
                <Link key={s.label} href={s.href}
                  className="bg-black/[0.03] rounded-xl p-2.5 border border-black/5 hover:bg-black/5 transition-colors text-center">
                  <div className={`text-xl font-black ${s.color}`}>
                    {s.value === null ? '—' : s.value}
                    {s.suffix && <span className="text-xs text-stone-400">{s.suffix}</span>}
                  </div>
                  <div className="text-[10px] text-stone-500 font-bold mt-0.5">{s.label}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Dictionary Updates */}
          <div className="glass-panel rounded-2xl p-3.5 border border-black/5 bg-gradient-to-br from-amber-50/70 to-transparent">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                <div className="w-1.5 h-5 bg-amber-500 rounded-full"></div>
                チャンピオン辞典 更新履歴
              </h3>
              <Link href="/champions" className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline">すべて見る →</Link>
            </div>
            <div className="space-y-2">
              {recentDictUpdates.length > 0 ? recentDictUpdates.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/[0.03] p-2.5 rounded-xl border border-black/5 hover:bg-black/5 transition-colors group">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-stone-700 group-hover:text-stone-900 transition-colors truncate">{item.champion}</span>
                    <span className="text-[11px] text-stone-500 truncate max-w-[180px]">{item.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500 px-1.5 py-0.5 bg-black/5 rounded">{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              )) : (
                <p className="text-xs text-stone-500 text-center py-3">データがありません</p>
              )}
            </div>
          </div>

          {/* Library Updates */}
          <div className="glass-panel rounded-2xl p-3.5 border border-black/5 bg-gradient-to-br from-orange-50/70 to-transparent">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                <div className="w-1.5 h-5 bg-orange-500 rounded-full"></div>
                ライブラリ 追加履歴
              </h3>
              <Link href="/admin/knowledge" className="text-xs font-bold text-orange-700 hover:text-orange-800 hover:underline">すべて見る →</Link>
            </div>
            <div className="space-y-2">
              {recentLibraryUpdates.length > 0 ? recentLibraryUpdates.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/[0.03] p-2.5 rounded-xl border border-black/5 hover:bg-black/5 transition-colors group">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-stone-700 truncate max-w-[180px] group-hover:text-stone-900 transition-colors" title={item.title}>{item.title}</span>
                    {item.champion && <span className="text-[10px] text-orange-700 mt-0.5">Champion: {item.champion}</span>}
                  </div>
                  <span className="text-[10px] font-mono text-stone-500 px-1.5 py-0.5 bg-black/5 rounded">{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              )) : (
                <p className="text-xs text-stone-500 text-center py-3">データがありません</p>
              )}
            </div>
          </div>

        </motion.div>




      </motion.main>

    </div>
    </div>
  );
}
