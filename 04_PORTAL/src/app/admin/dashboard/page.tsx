"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, ShieldAlert, Cpu, Network, Gamepad2, Users, RefreshCw, CheckCircle2, X, ChevronRight, Brain, Sparkles } from 'lucide-react';
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
  const [needsAttention, setNeedsAttention] = useState<{ failedTasks: any[]; youtubeErrorCount: number }>({ failedTasks: [], youtubeErrorCount: 0 });
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [recruitActivity, setRecruitActivity] = useState<{ openCount: number; recent: any[] }>({ openCount: 0, recent: [] });
  const [setupChecks, setSetupChecks] = useState<Record<string, boolean> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
    else setIsRefreshing(true);
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
        if (data.recruitActivity) setRecruitActivity(data.recruitActivity);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
      <div style={{ minHeight: '100vh' }} className="flex-1 flex items-center justify-center bg-[#06070a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #07080e 0%, #0f111a 60%, #07080e 100%)' }}
        className="flex-1 flex items-center justify-center p-4 font-sans text-white"
      >
        <div className="text-center max-w-sm rounded-3xl border border-gray-800 bg-[#0f111a] p-8 shadow-2xl">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2">認証が必要です</h2>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">
            この管理版コントロールセンターは管理者専用です。Discordアカウントでログインしてからアクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 shadow-lg hover:shadow-blue-500/20"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6 relative overflow-hidden">
      
      {/* Background Decorative Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-blue-600/5 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/5 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Header Section */}
      <motion.header 
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 blur opacity-20"></div>
          <h1 className="relative text-3xl md:text-4xl font-black tracking-tighter mb-2 drop-shadow-2xl">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Sovereign OS</span> 
            <span className="text-white/90 ml-3 font-mono text-3xl opacity-80">v5.0</span>
          </h1>
          <p className="text-blue-400 font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-2 mt-3">
            <Activity size={16} className="animate-pulse text-blue-500" />
            <span className="text-glow">Advanced Agentic Control Center</span>
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4 flex-wrap">
          <Link href="/admin/knowledge" className="px-4 py-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 text-xs font-bold text-pink-300 transition-all flex items-center gap-2">
            <Brain size={14} />
            <span>ナレッジ / データ整備 ➔</span>
          </Link>
          <Link href="/ktm-admin" className="px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-xs font-bold text-indigo-300 transition-all flex items-center gap-2">
            <Users size={14} />
            <span>名簿 / 試合管理 ➔</span>
          </Link>
          <Link href="/admin/prompts" className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 transition-all flex items-center gap-2">
            <Cpu size={14} className="text-cyan-400" />
            <span>AI プロンプト設定 ➔</span>
          </Link>
          {/* note分析(/admin/analytics)は2026-07-26の収益化パイプライン削除で参照元データが
              止まっており(analyticsは1ヶ月以上前の1件のみ、note_draftsは空)、現状は死んだ導線
              のためナビから外す。パイプライン再実装時に復活させる。 */}
          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              await fetchData(true);
              try {
                const res = await fetch('/api/admin/system/status');
                if (res.ok) {
                  const data = await res.json();
                  setSystemStatus(data);
                }
              } catch (err) {
                console.error(err);
              }
              setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-400' : 'text-blue-400'} />
            <span>最新情報を取得（手動同期）</span>
          </button>
          {lastUpdated && (
            <span className="text-xs text-gray-500 font-mono">最終更新: {lastUpdated}</span>
          )}
        </div>
      </motion.header>



      {/* 要対応パネル: champion_trend等の失敗タスクとYouTubeキューのエラーを1箇所に集約。
          何も無ければ表示しない（平時は場所を取らない）。 */}
      {(needsAttention.failedTasks.length > 0 || needsAttention.youtubeErrorCount > 0) && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-panel rounded-3xl p-4 border border-rose-500/30 bg-rose-500/5"
        >
          <h3 className="text-lg font-black text-rose-300 flex items-center gap-2 mb-4">
            <ShieldAlert size={20} /> ⚠️ 要対応（{needsAttention.failedTasks.length + (needsAttention.youtubeErrorCount > 0 ? 1 : 0)}件）
          </h3>
          <div className="space-y-2">
            {needsAttention.failedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">
                    {TASK_LABELS[task.task_type] || task.task_type}
                    {task.payload?.champion && <span className="text-gray-400 font-normal"> （{task.payload.champion}/{task.payload.role || ''}）</span>}
                    {task.executor && <span className="ml-2 text-[10px] text-gray-500 font-normal">({task.executor === 'cloud' ? 'クラウド実行' : 'ローカルPC実行'})</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate" title={task.error_message || ''}>
                    {(task.error_message || '').slice(0, 100) || '(エラー詳細なし)'}
                  </div>
                </div>
                {task.task_type === 'champion_trend' ? (
                  <button
                    onClick={() => handleRetryFailedTask(task)}
                    disabled={retryingTaskId === task.id}
                    className="shrink-0 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className={retryingTaskId === task.id ? 'animate-spin' : ''} /> 再実行
                  </button>
                ) : (
                  <Link href={TASK_LINKS[task.task_type] || '/admin/dashboard'} className="shrink-0 text-xs font-bold text-gray-400 hover:text-white underline">詳細へ</Link>
                )}
              </div>
            ))}
            {needsAttention.youtubeErrorCount > 0 && (
              <Link
                href="/admin/youtube"
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-rose-500/30 transition-colors"
              >
                <span className="text-sm font-bold text-white">YouTube動画キューのエラー・手動対応要 {needsAttention.youtubeErrorCount}件</span>
                <span className="text-xs font-bold text-rose-300">管理画面へ →</span>
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
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        
        {/* エッジワーカー依存機能 & 起動コントロールカード */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 glass-panel rounded-3xl p-4 relative overflow-hidden border border-white/10 bg-gradient-to-r from-blue-950/30 via-slate-900/40 to-purple-950/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2.5 rounded-xl border ${systemStatus.worker.active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  <Cpu size={22} className={systemStatus.worker.active ? '' : 'animate-pulse'} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2 flex-wrap">
                    エッジワーカー（ローカルDaemon）ステータス
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                      systemStatus.worker.active
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                    }`}>
                      {systemStatus.worker.active ? '🟢 稼働中 (待機中)' : '🔴 停止中（起動を推奨）'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    以下の重いAI・データ収集処理を実行するには、PC上でのエッジワーカー起動が必要です。
                  </p>
                </div>
              </div>
            </div>

            {/* 起動アクションボタン */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <a
                href="sovereign-worker://start"
                className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all flex items-center gap-2 cursor-pointer"
                title="ブラウザから「Sovereign Worker を開きますか？」ポップアップを表示してローカルワーカーを起動"
              >
                <Zap size={16} /> 🚀 エッジワーカーを起動 (ポップアップ)
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("d:/my_work/.venv/Scripts/python.exe d:/my_work/03_SYSTEMS/v2_CORE/edge_worker_daemon.py");
                  alert("📋 起動コマンドをクリップボードにコピーしました！\nPowerShell等で実行してください。");
                }}
                className="px-4 py-3 glass-panel glass-panel-hover text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                📋 コマンドをコピー
              </button>
            </div>
          </div>

          {/* 必要機能 ＆ クラウド完結機能の一覧比較
              2026-07-29時点: champion_trend/matchup_simulation_5v5/YouTubeチャンネル監視/
              reddit_scout/lol_trend_collect/dict_synthesizer は edge_cloud_worker.py
              (GitHub Actions, 数分おき) が既に代行しており、辞典一括更新も champ-dict-update.yml
              (毎週月曜)、戦績補完も api/cron/sync-matches (Vercel Cron) でクラウド完結している。
              以前の表示はこの移行前のままで「PCを起動しないと止まる」という誤った危機感を
              与えていたため、実態に合わせて書き換える。 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div className="space-y-2 bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 mb-2">
                <ShieldAlert size={14} /> ⚡ PC起動が今も意味を持つ場面
              </span>
              <ul className="space-y-1.5 text-xs text-gray-300">
                <li className="flex items-center gap-2">🚀 <strong>クラウド巡回を待たず即座に処理したい時</strong> <span className="text-[10px] text-gray-500">(GitHub Actionsは数分〜週次の巡回間隔)</span></li>
                <li className="flex items-center gap-2">🔑 <strong>クラウド側のAPIキー無料枠を使い切った時の代替実行</strong></li>
              </ul>
              <p className="text-[10px] text-gray-500 pt-1">※ 上記以外は起動しなくても自動的に処理されます。</p>
            </div>

            <div className="space-y-2 bg-black/30 p-4 rounded-2xl border border-white/5">
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={14} /> 🌐 クラウドだけで自動的に動く機能 (PC起動不要)
              </span>
              <ul className="space-y-1.5 text-xs text-gray-300">
                <li className="flex items-center gap-2">📚 <strong>チャンピオン辞典の一括AI更新</strong> <span className="text-[10px] text-gray-500">(champ-dict-update.yml・毎週月曜)</span></li>
                <li className="flex items-center gap-2">📊 <strong>個別トレンド取得・プロビルド追跡・5v5シミュレータ</strong> <span className="text-[10px] text-gray-500">(edge_cloud_worker.py・数分おき)</span></li>
                <li className="flex items-center gap-2">🎬 <strong>YouTube動画解析</strong> <span className="text-[10px] text-gray-500">(Groq Whisper API・absorber.yml)</span></li>
                <li className="flex items-center gap-2">🛠️ <strong>戦績スマート補完</strong> <span className="text-[10px] text-gray-500">(Vercel Cron・sync-matches)</span></li>
                <li className="flex items-center gap-2">✨ <strong>パーソナルコーチ AI 相談 ＆ 対面メモ</strong></li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* QUOTA Card (Simplified & Full-width) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 glass-panel glass-panel-hover rounded-3xl p-4 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Zap size={22} />
              </div>
              <h3 className="text-base md:text-xl font-black text-white tracking-tight">API Quota (1500回/日)</h3>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end gap-2">
                <div className="flex items-baseline gap-1 md:gap-2">
                  <span className="text-3xl md:text-5xl font-black text-white tracking-tight">{apiUsage}</span>
                  <span className="text-xs md:text-lg text-gray-400 font-medium">/ 1500 消費</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] md:text-sm text-gray-500 block">残り</span>
                  <span className="text-xl md:text-2xl font-bold text-emerald-400">{Math.max(0, 1500 - apiUsage)}</span>
                </div>
              </div>
              
              <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5 mt-2">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${apiUsage >= 1500 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : apiUsage > 1200 ? 'bg-gradient-to-r from-orange-400 to-rose-500' : 'bg-gradient-to-r from-blue-400 to-purple-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} 
                  style={{ width: `${Math.min((apiUsage / 1500) * 100, 100)}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1 font-medium">
                <span>0%</span>
                <span>リセット時間: 日本時間 16:00 (または17:00)</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* New Dashboard Widgets */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-4 grid grid-cols-1 gap-4">

          {/* Panel B: YouTube Absorber Queue */}
          <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                    YouTube 吸収キュー
                  </h3>
                  {systemMetrics.services?.youtube_absorber?.running && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 animate-pulse tracking-wider">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                      </span>
                      RUNNING
                    </span>
                  )}
                </div>
                <Link href="/admin/youtube" className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                  管理画面へ →
                </Link>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white mb-1">{systemMetrics.queue?.pending || 0}</span>
                  <span className="text-xs text-gray-400 font-bold">待機中 (Pending)</span>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white mb-1">{systemMetrics.queue?.completed || 0}</span>
                  <span className="text-xs text-gray-400 font-bold">完了 (Completed)</span>
                </div>
              </div>
            </div>

            {recentYoutubeQueue.length > 0 && (
              <div className="space-y-2.5 mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">直近の解析状況</p>
                {recentYoutubeQueue.map((item, idx) => {
                  let statusColor = 'text-gray-500';
                  let statusBg = 'bg-gray-500/10 border-gray-500/20';
                  let statusText = item.status;
                  
                  if (item.status === 'completed') {
                    statusColor = 'text-green-400';
                    statusBg = 'bg-green-500/10 border-green-500/20';
                    statusText = '完了';
                  } else if (item.status === 'pending') {
                    statusColor = 'text-cyan-400';
                    statusBg = 'bg-cyan-500/10 border-cyan-500/20';
                    statusText = '解析中';
                  } else if (item.status.startsWith('error') || item.status === 'failed') {
                    statusColor = 'text-red-400';
                    statusBg = 'bg-red-500/10 border-red-500/20';
                    statusText = 'エラー';
                  }
                  
                  return (
                    <div key={idx} className="flex justify-between items-center gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-gray-200 truncate" title={item.title}>
                          {item.title}
                        </span>
                        {item.channel_name && (
                          <span className="text-[10px] text-gray-500 mt-0.5">{item.channel_name}</span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${statusBg} ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel C: 募集アクティビティ ＆ セットアップチェックリスト */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-gradient-to-br from-rose-500/5 to-transparent">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <div className="w-2 h-6 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.6)]"></div>
                  募集アクティビティ
                </h3>
                <span className="text-xs font-black text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                  現在募集中 {recruitActivity.openCount}件
                </span>
              </div>
              <div className="space-y-2">
                {recruitActivity.recent.length > 0 ? recruitActivity.recent.map((r) => (
                  <div key={r.id} className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-gray-200">{r.mode}（{r.max_count}人）</span>
                      <span className="text-[10px] text-gray-500">募集主: {r.owner_name || '不明'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${
                      r.status === 'open' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      r.status === 'closed' ? 'bg-gray-500/10 border-gray-500/20 text-gray-400' :
                      'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {r.status === 'open' ? '募集中' : r.status === 'closed' ? '終了' : '削除済'}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500 text-center py-4">直近の募集はありません</p>
                )}
              </div>
              <p className="text-[10px] text-gray-600 mt-3">参加人数はDiscordメッセージ側で管理されているため、ここでは開催状況のみ表示しています。</p>
            </div>

            <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-gradient-to-br from-amber-500/5 to-transparent">
              <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4">
                <div className="w-2 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.6)]"></div>
                セットアップ状況
              </h3>
              {setupChecks ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { key: 'db', label: 'Supabase 接続' },
                    { key: 'riotKey', label: 'Riot API キー' },
                    { key: 'geminiKey', label: 'Gemini API キー' },
                    { key: 'vapid', label: 'Web Push (VAPID) キー' },
                    { key: 'discordWebhook', label: 'Discord Webhook' },
                    { key: 'portalBotSecret', label: 'PORTAL_BOT_SECRET' },
                  ].map((c) => (
                    <div key={c.key} className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/20 border border-white/5 text-xs">
                      <span className="text-gray-300">{c.label}</span>
                      <span className={`font-bold flex items-center gap-1 ${setupChecks[c.key] ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {setupChecks[c.key] ? <><CheckCircle2 size={12} /> 設定済み</> : <><ShieldAlert size={12} /> 未設定</>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">確認中...</p>
              )}
            </div>
          </div>

        </motion.div>

        {/* 🛠️ システムコクピット (System Cockpit) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-5">
          <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-[#07080e]/60 space-y-4">
            
            {/* タブナビゲーション */}
            <div className="flex justify-between items-center border-b border-white/5 pb-4 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-gradient-to-b from-indigo-400 via-cyan-400 to-rose-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                <h3 className="text-xl font-black text-white">🛠️ システムコクピット</h3>
              </div>
              <div className="flex glass-panel p-1 rounded-xl items-center border border-white/5 bg-black/40">
                {[
                  { id: 'nodes', label: '🛰️ サービス監視' },
                  { id: 'queue', label: '⚡ ジョブ実行キュー' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSystemTab(tab.id as any)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeSystemTab === tab.id
                        ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)] border border-white/10'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* タブコンテンツ */}
            <div className="mt-4">
              {/* 1. 🛰️ サービス監視 (Nodes Sentinel) */}
              {activeSystemTab === 'nodes' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    ポータルとBotはクラウドで常時稼働しています。動画解析まわりはPCで起動したときだけ動くため、
                    <strong className="text-gray-300">「未起動」は正常な状態</strong>です。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[
                      // 常時稼働するクラウド側
                      { id: 'portal', name: 'Next.js Portal', desc: 'ポータル・管理画面 (Vercel)', kind: 'cloud' as const },
                      { id: 'bot', name: 'Discord Bot (KTM)', desc: '大会運営Bot (Cloudflare Workers)', kind: 'cloud' as const },
                      // PCで起動したときだけ動くローカル側
                      { id: 'edge_worker', name: 'Edge Worker', desc: 'タスクキューの実行役 (ローカル)', kind: 'worker' as const },
                      { id: 'youtube_absorber', name: 'YouTube Absorber', desc: '動画の文字起こし・解析 (ローカル)', kind: 'local' as const },
                    ].map((service) => {
                      const status = systemMetrics.services?.[service.id] || {};
                      const metricsTime = systemMetrics.updated_at ? Number(systemMetrics.updated_at) * 1000 : 0;
                      const isDaemonOffline = !metricsTime || (Date.now() - metricsTime > 60000);
                      const isRunning = isDaemonOffline ? false : status.running;

                      let statusText = '停止中';
                      let statusColor = 'text-gray-500 bg-gray-500/10 border-gray-500/20';
                      let indicatorColor = 'bg-gray-600';

                      // クラウド側は常時稼働。ローカル側は必要なときだけ起動するので、
                      // 止まっていること自体は異常ではない（赤くしない）。
                      if (service.kind === 'cloud') {
                        // サーバーレスなので死活監視の対象ではない。この画面が出ている＝配信されている。
                        statusText = '稼働中';
                        statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                        indicatorColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
                      } else if (service.kind === 'worker') {
                        // Edge Worker は edge_tasks のハートビートで判定する
                        if (systemStatus.worker.active) {
                          statusText = '稼働中';
                          statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                          indicatorColor = 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]';
                        } else {
                          statusText = '未起動';
                          statusColor = 'text-gray-400 bg-white/5 border-white/10';
                          indicatorColor = 'bg-gray-600';
                        }
                      } else if (isRunning) {
                        statusText = service.id === 'youtube_absorber' ? '解析中' : '稼働中';
                        statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                        indicatorColor = 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]';
                      } else {
                        statusText = '未起動';
                        statusColor = 'text-gray-400 bg-white/5 border-white/10';
                        indicatorColor = 'bg-gray-600';
                      }

                      return (
                        <div key={service.id} className="bg-black/30 p-4 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-gray-200">{service.name}</span>
                              <span className={`w-2 h-2 rounded-full ${indicatorColor}`}></span>
                            </div>
                            <p className="text-[9px] text-gray-500 mb-4">{service.desc}</p>
                          </div>
                          <div className="flex justify-between items-center mt-auto">
                            <span className="text-[9px] font-mono text-gray-600">{service.kind === 'cloud' ? '常時稼働' : '必要時のみ起動'}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusColor}`}>{statusText}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ☁️ クラウドワーカー (GitHub Actions) の最終実行ログ */}
                  {systemMetrics.cloud_workers && Object.keys(systemMetrics.cloud_workers).length > 0 && (
                    <div className="pt-6 border-t border-white/5">
                      <h4 className="text-xs font-bold text-gray-300 mb-3 flex items-center gap-2">
                        <span>☁️</span> GitHub Actions ワーカー実行ステータス
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(systemMetrics.cloud_workers).map(([workerKey, log]: [string, any]) => {
                          const isOk = log.status === 'ok';
                          const isWarn = log.status === 'warn';
                          const statusBg = isOk ? 'border-emerald-500/20 bg-emerald-500/5' : isWarn ? 'border-amber-500/20 bg-amber-500/5' : 'border-rose-500/20 bg-rose-500/5';
                          const badgeColor = isOk ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : isWarn ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

                          const updatedTime = log.updated_at ? new Date(log.updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '時刻不明';

                          return (
                            <div key={workerKey} className={`p-4 rounded-2xl border text-xs bg-black/20 ${statusBg}`}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-white uppercase">{workerKey}</span>
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${badgeColor}`}>
                                  {isOk ? '正常完了' : isWarn ? '一部失敗/警告' : 'エラー'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-300 mb-2 font-medium">{log.summary}</p>
                              {log.details && log.details.length > 0 && (
                                <div className="space-y-1 mb-2 bg-black/40 p-2 rounded-lg text-[10px] text-gray-400 font-mono">
                                  {log.details.slice(0, 3).map((detail: string, i: number) => (
                                    <div key={i} className="truncate">• {detail}</div>
                                  ))}
                                </div>
                              )}
                              <div className="text-[9px] text-gray-500 text-right">最終実行: {updatedTime}</div>
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
                  <div className="flex justify-between items-center border-b border-white/5 pb-4 flex-wrap gap-2">
                    <p className="text-xs text-gray-400">
                      Discord Bot（エッジワーカー）のジョブ処理状況です。
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black border px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all ${
                        systemStatus.worker.active 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${systemStatus.worker.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {systemStatus.worker.active ? 'エッジワーカー: 稼働中' : 'エッジワーカー: 停止中'}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        最終更新: {systemStatus.worker.last_active ? new Date(systemStatus.worker.last_active).toLocaleTimeString() : '未受信'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* 現在実行中のタスク */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>●</span> 現在実行中のタスク
                      </h4>
                      {systemStatus.queue.filter(t => t.status === 'running').length === 0 ? (
                        <div className="text-xs text-gray-500 py-4 text-center rounded-2xl border border-white/5 bg-black/20">
                          現在実行中のタスクはありません（待機中）
                        </div>
                      ) : (
                        systemStatus.queue.filter(t => t.status === 'running').map(task => (
                          <div key={task.id} className="p-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold">
                                {task.task_type}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">ID: {task.id.slice(0, 8)}...</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono bg-black/40 p-2 rounded border border-white/5 break-all max-h-24 overflow-y-auto">
                              {JSON.stringify(task.payload, null, 2)}
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1">
                              <span>🔥 実行中</span>
                              <span>開始: {new Date(task.updated_at).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 待機中のキュー一覧 */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <span>●</span> 待機中のタスク列 ({systemStatus.queue.filter(t => t.status === 'pending').length})
                      </h4>
                      {systemStatus.queue.filter(t => t.status === 'pending').length === 0 ? (
                        <div className="text-xs text-gray-500 py-4 text-center rounded-2xl border border-white/5 bg-black/20">
                          待機中のタスクはありません
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {systemStatus.queue.filter(t => t.status === 'pending').map((task, idx) => (
                            <div key={task.id} className="p-3 rounded-xl border border-white/5 bg-black/20 flex justify-between items-center gap-4 hover:border-white/10 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-xs font-bold text-gray-500 font-mono w-5">#{idx + 1}</span>
                                <span className="text-xs bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded font-mono truncate" title={task.task_type}>
                                  {task.task_type}
                                </span>
                              </div>
                              <span className="text-[9px] text-gray-500 font-mono shrink-0">
                                {new Date(task.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 直近の実行履歴 */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <span>●</span> 直近の実行履歴 (直近5件)
                      </h4>
                      {systemStatus.history.length === 0 ? (
                        <div className="text-xs text-gray-500 py-4 text-center rounded-2xl border border-white/5 bg-black/20">
                          履歴はありません
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {systemStatus.history.map(task => (
                            <div key={task.id} className="p-3 rounded-xl border border-white/5 bg-black/20 space-y-1.5">
                              <div className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded font-mono">
                                    {task.task_type}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                    task.status === 'completed' 
                                      ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/40' 
                                      : 'bg-rose-950/20 text-rose-400 border border-rose-900/40'
                                  }`}>
                                    {task.status === 'completed' ? '成功' : '失敗'}
                                  </span>
                                </div>
                                <span className="text-[9px] text-gray-500 font-mono">
                                  {new Date(task.updated_at).toLocaleTimeString()}
                                </span>
                              </div>
                              {task.status === 'failed' && task.error_message && (
                                <div className="text-[9px] text-rose-400 bg-rose-950/10 border border-rose-900/20 p-2 rounded font-mono break-all max-h-16 overflow-y-auto">
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

        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 知識ベースの整備状況: 各データがどれだけ溜まっているかを一目で把握する */}
          <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-gradient-to-br from-emerald-500/5 to-transparent lg:col-span-2">
            <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                知識ベースの整備状況
              </h3>
              <Link href="/admin/knowledge" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline">🛠️ データ整備へ →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'チャンピオン辞典', value: kbStats.facts, href: '/champions', color: 'text-blue-400' },
                { label: '未整理の記事', value: kbStats.library, href: '/admin/knowledge', color: 'text-purple-400' },
                { label: 'レーン別ガイド', value: kbStats.laneGuides, href: '/lane-guides', color: 'text-amber-400', suffix: '/6' },
                { label: '対面メモ', value: kbStats.memos, href: '/coach?tab=matchup-memo', color: 'text-cyan-400' },
                { label: '対面カルテ', value: kbStats.matchupLog, href: '/coach?tab=matchup-memo', color: 'text-rose-400' },
              ].map((s) => (
                <Link key={s.label} href={s.href}
                  className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:bg-white/5 transition-colors text-center">
                  <div className={`text-2xl font-black ${s.color}`}>
                    {s.value === null ? '—' : s.value}
                    {s.suffix && <span className="text-sm text-gray-600">{s.suffix}</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold mt-1">{s.label}</div>
                </Link>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-3">
              「未整理の記事」は、まだ辞典やレーンガイドへ統合されていない攻略ライブラリの記事数です。データ整備タブで①→③を実行すると減っていきます。
            </p>
          </div>

          {/* Dictionary Updates */}
          <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                チャンピオン辞典 更新履歴
              </h3>
              <Link href="/champions" className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline">すべて見る →</Link>
            </div>
            <div className="space-y-3">
              {recentDictUpdates.length > 0 ? recentDictUpdates.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-colors group">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{item.champion}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{item.title}</span>
                  </div>
                  <span className="text-xs font-mono text-gray-400 px-2 py-1 bg-white/5 rounded-md">{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-4">データがありません</p>
              )}
            </div>
          </div>

          {/* Library Updates */}
          <div className="glass-panel rounded-3xl p-4 border border-white/5 bg-gradient-to-br from-purple-500/5 to-transparent">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.6)]"></div>
                ライブラリ 追加履歴
              </h3>
              {/* /library は存在しないページだった。実体は管理画面の攻略ライブラリタブ */}
              <Link href="/admin/knowledge" className="text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline">すべて見る →</Link>
            </div>
            <div className="space-y-3">
              {recentLibraryUpdates.length > 0 ? recentLibraryUpdates.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-colors group">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-200 truncate max-w-[200px] group-hover:text-white transition-colors" title={item.title}>{item.title}</span>
                    {item.champion && <span className="text-xs text-purple-400 mt-0.5">Champion: {item.champion}</span>}
                  </div>
                  <span className="text-xs font-mono text-gray-400 px-2 py-1 bg-white/5 rounded-md">{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-4">データがありません</p>
              )}
            </div>
          </div>

        </motion.div>




      </motion.main>


    </div>
  );
}
