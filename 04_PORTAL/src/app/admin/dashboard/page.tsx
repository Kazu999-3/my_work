"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, TrendingUp, ShieldAlert, Cpu, Network, Gamepad2, Users, RefreshCw, CheckCircle2, X, ChevronRight, Brain } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { supabaseBrowser } from '../../../lib/supabaseBrowserClient';
import Link from 'next/link';


export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [apiUsage, setApiUsage] = useState<number>(0);
  const [systemMetrics, setSystemMetrics] = useState<any>({ queue: { pending: 0, error: 0, completed: 0, error_details: [] }, logs: [] });
  const [recentDictUpdates, setRecentDictUpdates] = useState<any[]>([]);
  const [recentLibraryUpdates, setRecentLibraryUpdates] = useState<any[]>([]);
  const [recentYoutubeQueue, setRecentYoutubeQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeSystemTab, setActiveSystemTab] = useState<'nodes' | 'queue' | 'logs'>('nodes');

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
  const fetchKbStats = async () => {
    try {
      const count = async (table: string, build?: (q: any) => any) => {
        let q = supabase.from(table).select('*', { count: 'exact', head: true });
        if (build) q = build(q);
        const { count: c } = await q;
        return c ?? 0;
      };
      const [facts, library, laneGuides, memos, matchupLog] = await Promise.all([
        count('champion_facts'),
        // 未整理＝まだ辞典/ガイドへ統合されていない記事
        count('personal_knowledge', (q: any) => q.or('tags.is.null,tags.not.cs.{__DELETED__}')),
        count('lane_guides'),
        count('matchup_sentinel', (q: any) => q.neq('enemy', 'GLOBAL')),
        count('matchup_log'),
      ]);
      setKbStats({ facts, library, laneGuides, memos, matchupLog });
    } catch (e) {
      console.warn('知識ベース統計の取得に失敗:', e);
    }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      // 1. SYSTEM_METRICS の取得
      const { data: metricsData } = await supabase
        .from('matchup_sentinel')
        .select('raw_data')
        .eq('matchup_id', 'SYSTEM_METRICS')
        .maybeSingle();
      if (metricsData && metricsData.raw_data) {
        setSystemMetrics(metricsData.raw_data);
      }

      // API使用量の取得
      // Gemini APIのリセット時間（太平洋標準時 PST/PDT: 深夜0時）に合わせるため UTC-8 を基準とする
      const ptObj = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const yyyy = ptObj.getUTCFullYear();
      const mm = String(ptObj.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(ptObj.getUTCDate()).padStart(2, '0');
      const todayFormatted = `${yyyy}-${mm}-${dd}`;

      const { data: apiData, error: apiError } = await supabase
        .from('api_usage_logs')
        .select('usage_data')
        .eq('date', todayFormatted)
        .single();

      if (!apiError && apiData && apiData.usage_data) {
        // クォータはエラー(429等)も消費に含まれるため、成功・失敗を合算して表示する
        let total = 0;
        for (const [key, value] of Object.entries(apiData.usage_data)) {
          if (key.startsWith('__limit_')) continue; // 上限値の定義行は使用量ではない
          total += Number(value);
        }
        setApiUsage(total);
      }

      // 5. 辞典更新履歴 (GLOBAL)
      const { data: dictData, error: dictError } = await supabase
        .from('matchup_sentinel')
        .select('matchup_id, champion, title, created_at')
        .eq('enemy', 'GLOBAL')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!dictError && dictData) setRecentDictUpdates(dictData);

      // 6. ライブラリ更新履歴
      const { data: libData, error: libError } = await supabase
        .from('personal_knowledge')
        .select('id, title, champion, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!libError && libData) setRecentLibraryUpdates(libData);



      // 8. 最新のYouTubeキュー取得
      const { data: ytQueueData, error: ytQueueError } = await supabase
        .from('youtube_queue')
        .select('id, title, status, channel_name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3);
      if (!ytQueueError && ytQueueData) setRecentYoutubeQueue(ytQueueData);


    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };




  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    fetchKbStats();
    setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
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
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            この管理版コントロールセンターは管理者専用です。Discordアカウントでログインしてからアクセスしてください。
          </p>
          <a
            href="/login?next=/admin/dashboard"
            className="inline-block w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 shadow-lg hover:shadow-blue-500/20"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-10 relative overflow-hidden">
      
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
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 blur opacity-20"></div>
          <h1 className="relative text-5xl md:text-6xl font-black tracking-tighter mb-2 drop-shadow-2xl">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Sovereign OS</span> 
            <span className="text-white/90 ml-3 font-mono text-3xl opacity-80">v5.0</span>
          </h1>
          <p className="text-blue-400 font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-2 mt-3">
            <Activity size={16} className="animate-pulse text-blue-500" />
            <span className="text-glow">Advanced Agentic Control Center</span>
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4 flex-wrap">
          {/* よく使う運用画面への導線。ダッシュボードから辿れず迷いやすかったため追加 */}
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
          <Link href="/admin/analytics" className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 border border-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 hover:border-indigo-400/30 text-xs font-bold text-white transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center gap-2">
            <TrendingUp size={14} />
            <span>note 分析 ➔</span>
          </Link>
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



      {/* Main Content */}
      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        
        {/* QUOTA Card (Simplified & Full-width) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6">
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
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-4 grid grid-cols-1 gap-6">

          {/* Panel B: YouTube Absorber Queue */}
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
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

        </motion.div>

        {/* 🛠️ システムコクピット (System Cockpit) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-8">
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-[#07080e]/60 space-y-6">
            
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
                  { id: 'logs', label: '📋 リアルタイムログ' }
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
                <div className="space-y-6">
                  <p className="text-xs text-gray-400">
                    ポータルとBotはクラウドで常時稼働しています。動画解析まわりはPCで起動したときだけ動くため、
                    <strong className="text-gray-300">「未起動」は正常な状態</strong>です。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {[
                      // 常時稼働するクラウド側
                      { id: 'portal', name: 'Next.js Portal', desc: 'ポータル・管理画面 (Vercel)', kind: 'cloud' as const },
                      { id: 'bot', name: 'Discord Bot (KTM)', desc: '大会運営Bot (Cloudflare Workers)', kind: 'cloud' as const },
                      // PCで起動したときだけ動くローカル側
                      { id: 'edge_worker', name: 'Edge Worker', desc: 'タスクキューの実行役 (ローカル)', kind: 'worker' as const },
                      { id: 'youtube_absorber', name: 'YouTube Absorber', desc: '動画の文字起こし・解析 (ローカル)', kind: 'local' as const },
                      { id: 'sre', name: 'SRE Daemon', desc: '定期タスクの投入・監視 (ローカル)', kind: 'local' as const },
                    ].map((service) => {
                      const status = systemMetrics.services?.[service.id] || {};
                      const metricsTime = systemMetrics.updated_at ? Number(systemMetrics.updated_at) * 1000 : 0;
                      const isDaemonOffline = !metricsTime || (Date.now() - metricsTime > 60000);
                      const isRunning = isDaemonOffline ? false : status.running;
                      const log = systemMetrics.logs_status?.[service.id] || {};
                      const hasErrors = log.error_count > 0;

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
                        if (hasErrors) {
                          statusText = '警告あり';
                          statusColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                          indicatorColor = 'bg-yellow-400 animate-pulse';
                        } else {
                          statusText = service.id === 'youtube_absorber' ? '解析中' : '稼働中';
                          statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                          indicatorColor = 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]';
                        }
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

                  <div className="pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(systemMetrics.logs_status || {}).map(([key, val]: [string, any]) => {
                      if (!val) return null;
                      const nameMap: Record<string, string> = {
                        portal: 'Next.js Portal ログ',
                        bot: 'Discord Bot ログ',
                        api: 'Core API ログ',
                        sre: 'SRE Daemon ログ'
                      };
                      const hasErrors = (val.error_count || 0) > 0;
                      const recentErrors = val.recent_errors || [];
                      
                      return (
                        <div key={key} className={`p-4 rounded-2xl border text-xs bg-black/20 ${hasErrors ? 'border-rose-500/20 bg-rose-500/5' : 'border-white/5'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-bold ${hasErrors ? 'text-rose-400' : 'text-gray-300'}`}>{nameMap[key] || key}</span>
                            <span className="text-[9px] text-gray-500">
                              最終更新: {val.last_updated ? new Date(val.last_updated).toLocaleTimeString('ja-JP') : '不明'}
                            </span>
                          </div>
                          {hasErrors ? (
                            <div className="space-y-1.5 mt-2">
                              <span className="text-[9px] font-bold text-rose-400/80 block">⚠️ 直近のエラーログ:</span>
                              {recentErrors.slice(0, 2).map((err: string, i: number) => (
                                <p key={i} className="font-mono text-[9px] text-rose-300/90 truncate bg-black/40 p-1.5 rounded border border-rose-500/10" title={err}>{err}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[9px] text-emerald-400/80 mt-1 flex items-center gap-1">
                              <CheckCircle2 size={10} /> エラーは検知されていません
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. ⚡ ジョブ実行キュー (Job Queue) */}
              {activeSystemTab === 'queue' && (
                <div className="space-y-6">
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

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 現在実行中のタスク */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>●</span> 現在実行中のタスク
                      </h4>
                      {systemStatus.queue.filter(t => t.status === 'running').length === 0 ? (
                        <div className="text-xs text-gray-500 py-6 text-center rounded-2xl border border-white/5 bg-black/20">
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
                        <div className="text-xs text-gray-500 py-6 text-center rounded-2xl border border-white/5 bg-black/20">
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
                        <div className="text-xs text-gray-500 py-6 text-center rounded-2xl border border-white/5 bg-black/20">
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

              {/* 3. 📋 リアルタイムログ (System Logs) */}
              {activeSystemTab === 'logs' && (
                <div className="flex flex-col h-[350px] space-y-3">
                  <p className="text-xs text-gray-400">
                    動画解析を実行したときに、ローカルのデーモンが残した最終ログ（直近15行）です。解析していない間は更新されません。
                  </p>
                  <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-4 font-mono text-[9px] md:text-[10px] leading-relaxed text-gray-400 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-black/80 to-transparent z-10"></div>
                    <div className="flex flex-col justify-end h-full space-y-1 z-0 relative pt-2 overflow-y-auto max-h-[280px]">
                      {systemMetrics.logs && systemMetrics.logs.length > 0 ? (
                        systemMetrics.logs.slice(-15).map((log: string, idx: number) => {
                          const isError = log.includes('[ERROR]');
                          const isWarn = log.includes('[WARNING]');
                          const cleanLog = log.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} /, '');
                          return (
                            <div key={idx} className={`truncate ${isError ? 'text-rose-400' : isWarn ? 'text-yellow-400' : 'text-emerald-400/80'}`}>
                              {cleanLog}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-gray-500 flex items-center justify-center h-full">Waiting for logs...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 知識ベースの整備状況: 各データがどれだけ溜まっているかを一目で把握する */}
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-emerald-500/5 to-transparent lg:col-span-2">
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
                { label: '対面メモ', value: kbStats.memos, href: '/matchups', color: 'text-cyan-400' },
                { label: '対面カルテ', value: kbStats.matchupLog, href: '/matchups', color: 'text-rose-400' },
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
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex justify-between items-center mb-6">
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
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-purple-500/5 to-transparent">
            <div className="flex justify-between items-center mb-6">
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
