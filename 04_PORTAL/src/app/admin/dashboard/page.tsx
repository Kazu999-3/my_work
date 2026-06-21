"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, TrendingUp, ShieldAlert, Cpu, Network, Gamepad2, Users, RefreshCw, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import Link from 'next/link';

const dummyData = [
  { name: 'Mon', value: 4000 },
  { name: 'Tue', value: 3000 },
  { name: 'Wed', value: 2000 },
  { name: 'Thu', value: 2780 },
  { name: 'Fri', value: 1890 },
  { name: 'Sat', value: 2390 },
  { name: 'Sun', value: 3490 },
];

export default function Home() {

  const [totalAssets, setTotalAssets] = useState<number>(0);
  const [pendingTasks, setPendingTasks] = useState<number>(0);
  const [pendingTaskList, setPendingTaskList] = useState<any[]>([]);
  const [apiUsage, setApiUsage] = useState<number>(0);
  const [apiErrors, setApiErrors] = useState<number>(0);
  const [apiLimit, setApiLimit] = useState<number>(780);
  const [apiUsageDetails, setApiUsageDetails] = useState<Record<string, { used: number, limit: number }>>({});
  const [systemMetrics, setSystemMetrics] = useState<any>({ queue: { pending: 0, error: 0, completed: 0, error_details: [] }, logs: [] });
  const [recentDictUpdates, setRecentDictUpdates] = useState<any[]>([]);
  const [recentLibraryUpdates, setRecentLibraryUpdates] = useState<any[]>([]);
  const [recentYoutubeQueue, setRecentYoutubeQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // エラー詳細モーダル用
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);



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

      // 2. 総データ数の取得
      const { count: totalCount, error: totalError } = await supabase
        .from('matchup_sentinel')
        .select('*', { count: 'exact', head: true });
      
      if (!totalError && totalCount !== null) {
        setTotalAssets(totalCount);
      }

      // 3. 要確認タスク数の取得 (raw_data内のstrategyが空のものを未処理とみなす)
      const { data: pendingData, count: pendingCount, error: pendingError } = await supabase
        .from('matchup_sentinel')
        .select('matchup_id, champion, enemy, title', { count: 'exact' })
        .neq('champion', 'SYSTEM')
        .neq('enemy', 'GLOBAL')
        .or('raw_data->>strategy.is.null,raw_data->>strategy.eq.')
        .limit(3);

      if (!pendingError) {
        if (pendingCount !== null) setPendingTasks(pendingCount);
        if (pendingData) setPendingTaskList(pendingData);
      }

      // 4. API使用量の取得
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
        let totalSuccess = 0;
        let totalErrors = 0;
        let totalLimit = 0;
        const details: Record<string, { used: number, limit: number }> = {};
        
        // First pass: extract limits and initialize details
        for (const [key, value] of Object.entries(apiData.usage_data)) {
          if (key.startsWith('__limit_')) {
            const featureName = key.replace('__limit_', '');
            totalLimit += Number(value);
            if (!details[featureName]) details[featureName] = { used: 0, limit: Number(value) };
            else details[featureName].limit = Number(value);
          }
        }
        
        // Second pass: extract usage
        for (const [key, value] of Object.entries(apiData.usage_data)) {
          if (key.startsWith('__limit_')) continue;
          if (key.startsWith('error_')) {
            totalErrors += Number(value);
          } else {
            totalSuccess += Number(value);
            if (!details[key]) details[key] = { used: Number(value), limit: 0 };
            else details[key].used = Number(value);
          }
        }
        
        // クォータ制限（1500回制限等）はエラー（429等）も消費カウントに含まれるため、総数をセット
        setApiUsage(totalSuccess + totalErrors);
        setApiErrors(totalErrors);
        if (totalLimit > 0) setApiLimit(totalLimit);
        
        // Filter out features with 0 limit and 0 usage to keep it clean
        const cleanedDetails = Object.fromEntries(
          Object.entries(details).filter(([k, v]) => v.limit > 0 || v.used > 0)
        );
        setApiUsageDetails(cleanedDetails);
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
    fetchData();

    // 30秒ごとに自動リフレッシュ
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
            <span className="text-white/90 ml-3 font-mono text-3xl opacity-80">v4.0</span>
          </h1>
          <p className="text-blue-400 font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-2 mt-3">
            <Activity size={16} className="animate-pulse text-blue-500" />
            <span className="text-glow">Advanced Agentic Control Center</span>
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
          <Link href="/admin/analytics" className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 border border-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 hover:border-indigo-400/30 text-xs font-bold text-white transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center gap-2">
            <TrendingUp size={14} />
            <span>note 分析 ➔</span>
          </Link>
          {lastUpdated && (
            <span className="text-xs text-gray-500 font-mono">最終更新: {lastUpdated}</span>
          )}
          <div className="glass-panel border border-white/5 rounded-2xl px-6 py-3 flex gap-6 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="flex items-center gap-3 relative z-10">
              {isRefreshing ? (
                <RefreshCw size={14} className="animate-spin text-blue-400" />
              ) : (
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                </div>
              )}
              <span className="text-sm font-bold text-emerald-100 tracking-wide">
                {isRefreshing ? 'REFRESHING' : 'SYSTEM ONLINE'}
              </span>
            </div>
          </div>
        </div>
      </motion.header>



      {/* Main Content */}
      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        
        {/* Stat Cards */}
        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Network size={22} />
            </div>
            <p className="text-xs font-bold text-blue-400/80 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">SYNCED</p>
          </div>
          <div>
            <h3 className="text-4xl font-black text-white mb-1 tracking-tight">{isLoading ? '-' : totalAssets}</h3>
            <p className="text-sm text-gray-400 font-medium">同期済みデータ総数</p>
          </div>
        </motion.div>

        {/* QUOTA Card (Simplified) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2 glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
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
                  className={`h-full rounded-full transition-all duration-1000 ${apiUsage >= 1500 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : apiUsage > 1200 ? 'bg-gradient-to-r from-orange-400 to-rose-500' : 'bg-gradient-to-r from-blue-400 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'}`} 
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

        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Cpu size={22} />
            </div>
            <p className="text-xs font-bold text-emerald-400/80 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 animate-pulse">ACTIVE</p>
          </div>
          <div>
            <h3 className="text-4xl font-black text-white mb-1 tracking-tight">正常</h3>
            <p className="text-sm text-gray-400 font-medium">システム・ワーカー状態</p>
          </div>
        </motion.div>

        {/* New Dashboard Widgets (A, B, C) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Panel A: Pending Tasks */}
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-rose-500/5 to-transparent flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.6)]"></div>
                要確認タスク
              </h3>
            </div>
            <div className="flex-1 space-y-3">
              {pendingTaskList.length > 0 ? pendingTaskList.map((task, idx) => (
                <Link href={`/champions`} key={idx} className="block bg-black/20 p-4 rounded-xl border border-white/5 hover:bg-white/5 hover:border-rose-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-gray-200 group-hover:text-rose-300 transition-colors">{task.champion}</span>
                    <span className="text-[10px] font-bold tracking-widest uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full">Missing</span>
                  </div>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400">対面: {task.enemy} (戦略データ不足)</p>
                </Link>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-emerald-400/80 gap-2 py-8">
                  <Activity size={32} className="opacity-50" />
                  <p className="text-sm font-bold">すべてのタスクが完了</p>
                </div>
              )}
            </div>
            {pendingTasks > 3 && (
              <p className="text-xs text-center text-gray-500 mt-4 pt-4 border-t border-white/5">他 {pendingTasks - 3} 件のタスクがあります</p>
            )}
          </div>

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

          {/* Panel C: System Logs */}
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-emerald-500/5 to-transparent flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                System Logs
              </h3>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-4 font-mono text-[9px] md:text-[10px] leading-relaxed text-gray-400 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-black/80 to-transparent z-10"></div>
              <div className="flex flex-col justify-end h-full space-y-1 z-0 relative pt-2">
                {systemMetrics.logs && systemMetrics.logs.length > 0 ? (
                  systemMetrics.logs.slice(-7).map((log: string, idx: number) => {
                    const isError = log.includes('[ERROR]');
                    const isWarn = log.includes('[WARNING]');
                    // Remove timestamps to fit more text
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

        </motion.div>

        {/* Sovereign Nodes Sentinel */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-8">
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-indigo-500/5 via-rose-500/5 to-transparent">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <div className="w-2 h-6 bg-gradient-to-b from-indigo-400 to-rose-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.6)]"></div>
                <span>Sovereign OS ノード監視 (Nodes Sentinel)</span>
              </h3>
              <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2.5 py-1 rounded-full border border-white/5">15秒おきに自動更新</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                { id: 'ollama', name: 'Ollama (LLM)', port: 11434, desc: 'ローカルAI推論エンジン' },
                { id: 'portal', name: 'Next.js Portal', port: 3000, desc: '本管理画面・フロント' },
                { id: 'bot', name: 'Discord Bot (KTM)', port: 8787, desc: '大会運営・Discordボット' },
                { id: 'api', name: 'Core API', port: 8000, desc: 'Sovereign OS API' },
                { id: 'sre', name: 'SRE Daemon', port: null, desc: '自律監視・自己修復デモ' },
                { id: 'youtube_absorber', name: 'YouTube Absorber', port: null, desc: '動画音声の文字起こし・解析' }
              ].map((service) => {
                const status = systemMetrics.services?.[service.id] || {};
                
                // 監視データの最終更新時刻が1分（60秒）以上経過している場合は監視デーモンオフラインとみなす
                const metricsTime = systemMetrics.updated_at ? Number(systemMetrics.updated_at) * 1000 : 0;
                const isDaemonOffline = !metricsTime || (Date.now() - metricsTime > 60000);
                
                const isRunning = isDaemonOffline ? false : status.running;
                const log = systemMetrics.logs_status?.[service.id] || {};
                const hasErrors = log.error_count > 0;

                let statusText = '停止中';
                let statusColor = 'text-gray-500 bg-gray-500/10 border-gray-500/20';
                let indicatorColor = 'bg-gray-600';

                if (isRunning) {
                  if (service.id === 'youtube_absorber') {
                    statusText = '解析中';
                    statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                    indicatorColor = 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]';
                  } else if (hasErrors) {
                    statusText = '警告あり';
                    statusColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                    indicatorColor = 'bg-yellow-400 animate-pulse';
                  } else {
                    statusText = '稼働中';
                    statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                    indicatorColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
                  }
                } else if (service.id === 'youtube_absorber') {
                  statusText = '待機中 (アイドル)';
                  statusColor = 'text-gray-400 bg-white/5 border-white/5';
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
                      <span className="text-[9px] font-mono text-gray-600">{service.port ? `Port: ${service.port}` : 'Background'}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusColor}`}>{statusText}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ログエラー状況 */}
            <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </motion.div>

        {/* Update History Section */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
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
              <Link href="/library" className="text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline">すべて見る →</Link>
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
