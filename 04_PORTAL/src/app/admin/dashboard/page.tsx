"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, TrendingUp, ShieldAlert, Cpu, Network, Gamepad2, Users, RefreshCw, CheckCircle2, Circle, Clock, Plus, X, Bot, User, Handshake, ChevronRight, Trash2 } from 'lucide-react';
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
  // システムジョブコントロール用
  const [jobsStatus, setJobsStatus] = useState<Record<string, { name: string; isRunning: boolean }>>({
    youtube_absorber: { name: 'YouTube動画解析', isRunning: false },
    dict_synthesizer: { name: '総合辞典マージ', isRunning: false },
    research_scout: { name: 'トレンド自動リサーチ', isRunning: false },
    idea_generator: { name: '記事ネタ自動提案', isRunning: false },
    evolution: { name: 'AI自己進化プロンプト更新', isRunning: false },
    monetization_batch: { name: 'アフィリエイト一気通貫バッチ', isRunning: false }
  });
  const [selectedJob, setSelectedJob] = useState<string>('youtube_absorber');
  const [selectedJobLogs, setSelectedJobLogs] = useState<string>('');
  const [jobActionLoading, setJobActionLoading] = useState<string | null>(null);

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

  // 共同タスクボード用
  const [collabTasks, setCollabTasks] = useState<any[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState<'anchan' | 'user' | 'both'>('both');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');

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
        .from('bible_articles')
        .select('id, title, champion, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!libError && libData) setRecentLibraryUpdates(libData);

      // 7. 共同タスクボードの取得（Supabase直接）
      const { data: collabData, error: collabError } = await supabase
        .from('collab_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (!collabError && collabData) setCollabTasks(collabData);

      // 8. 最新のYouTubeキュー取得
      const { data: ytQueueData, error: ytQueueError } = await supabase
        .from('youtube_queue')
        .select('id, title, status, channel_name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3);
      if (!ytQueueError && ytQueueData) setRecentYoutubeQueue(ytQueueData);

      // 最終更新時刻を設定
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('ja-JP'));

      // 9. ジョブステータスの取得
      const resJobs = await fetch('/api/admin/jobs');
      if (resJobs.ok) {
        const jobsData = await resJobs.json();
        setJobsStatus(jobsData);
      }

      // 10. 選択中のジョブのログ取得
      const resLogs = await fetch(`/api/admin/jobs?job=${selectedJob}`);
      if (resLogs.ok) {
        const logData = await resLogs.json();
        setSelectedJobLogs(logData.logs);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleStartJob = async (jobName: string) => {
    setJobActionLoading(jobName);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobName })
      });
      const data = await res.json();
      if (res.ok) {
        // ステータスを即座に再取得
        const resJobs = await fetch('/api/admin/jobs');
        if (resJobs.ok) {
          const jobsData = await resJobs.json();
          setJobsStatus(jobsData);
        }
      } else {
        alert(`起動失敗: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラー: ${e.message}`);
    } finally {
      setJobActionLoading(null);
    }
  };

  const handleFetchJobLogs = async (jobName: string) => {
    setSelectedJob(jobName);
    try {
      const res = await fetch(`/api/admin/jobs?job=${jobName}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedJobLogs(data.logs);
      }
    } catch (e) {
      console.error('ログの取得に失敗しました', e);
    }
  };

  // タスクのステータスを循環させる: todo → in_progress → done → todo
  const cycleTaskStatus = async (task: any) => {
    const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    const { error } = await supabase
      .from('collab_tasks')
      .update({ status: nextStatus })
      .eq('id', task.id);
    if (!error) {
      setCollabTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    }
  };

  // タスク追加
  const addCollabTask = async () => {
    if (!newTaskTitle.trim()) return;
    const { data, error } = await supabase
      .from('collab_tasks')
      .insert([{ title: newTaskTitle, owner: newTaskOwner, priority: newTaskPriority, status: 'todo' }])
      .select()
      .single();
    if (!error && data) {
      setCollabTasks(prev => [data, ...prev]);
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  // タスク削除
  const deleteCollabTask = async (id: string) => {
    const { error } = await supabase.from('collab_tasks').delete().eq('id', id);
    if (!error) {
      setCollabTasks(prev => prev.filter(t => t.id !== id));
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
        
        <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
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
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                  YouTube 吸収キュー
                </h3>
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

        {/* 共同タスクボード */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-8">
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-teal-500/5 via-indigo-500/5 to-transparent">
            {/* ヘッダー */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <div className="w-2 h-6 bg-gradient-to-b from-teal-400 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.6)]"></div>
                <span>🤝 あんちゃんと私のタスクボード</span>
              </h3>
              <button
                id="add-collab-task-btn"
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 hover:text-teal-300 transition-all"
              >
                <Plus size={14} />
                タスクを追加
              </button>
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-4 mb-6 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-indigo-400"><Bot size={12} /> あんちゃん担当</span>
              <span className="flex items-center gap-1.5 text-amber-400"><User size={12} /> 自分担当</span>
              <span className="flex items-center gap-1.5 text-teal-400"><Handshake size={12} /> 共同作業</span>
              <span className="flex items-center gap-1.5 ml-auto text-gray-500">クリックでステータス変更 →</span>
            </div>

            {/* タスク追加フォーム */}
            {isAddingTask && (
              <div className="mb-6 p-4 rounded-2xl bg-black/30 border border-teal-500/20">
                <div className="flex flex-col gap-3">
                  <input
                    id="new-task-title-input"
                    type="text"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCollabTask()}
                    placeholder="タスク名を入力..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50"
                    autoFocus
                  />
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex gap-2">
                      {(['anchan', 'user', 'both'] as const).map(o => (
                        <button
                          key={o}
                          onClick={() => setNewTaskOwner(o)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                            newTaskOwner === o
                              ? o === 'anchan' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                              : o === 'user'   ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                              : 'bg-white/5 border-white/10 text-gray-500'
                          }`}
                        >
                          {o === 'anchan' ? '🤖 あんちゃん' : o === 'user' ? '👤 自分' : '🤝 共同'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => setIsAddingTask(false)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300 transition-all">
                        キャンセル
                      </button>
                      <button
                        id="submit-new-task-btn"
                        onClick={addCollabTask}
                        disabled={!newTaskTitle.trim()}
                        className="text-xs font-bold px-4 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        追加する
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* タスクリスト — 3カラム（todo / in_progress / done） */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['todo', 'in_progress', 'done'] as const).map(col => {
                const colTasks = collabTasks.filter(t => t.status === col);
                const colMeta = {
                  todo:        { label: '📋 未着手', color: 'border-gray-500/30', headerBg: 'bg-gray-500/10', textColor: 'text-gray-400', icon: <Circle size={15} /> },
                  in_progress: { label: '⚡ 進行中', color: 'border-yellow-500/30', headerBg: 'bg-yellow-500/10', textColor: 'text-yellow-400', icon: <Clock size={15} /> },
                  done:        { label: '✅ 完了',   color: 'border-emerald-500/30', headerBg: 'bg-emerald-500/10', textColor: 'text-emerald-400', icon: <CheckCircle2 size={15} /> },
                }[col];
                return (
                  <div key={col} className={`rounded-2xl border ${colMeta.color} bg-black/20 overflow-hidden`}>
                    {/* カラムヘッダー */}
                    <div className={`${colMeta.headerBg} px-4 py-3 flex items-center justify-between`}>
                      <span className={`text-xs font-black ${colMeta.textColor} flex items-center gap-2`}>
                        {colMeta.icon} {colMeta.label}
                      </span>
                      <span className={`text-xs font-black ${colMeta.textColor} bg-black/20 px-2 py-0.5 rounded-full`}>{colTasks.length}</span>
                    </div>
                    {/* タスクカード */}
                    <div className="p-3 space-y-2 min-h-[120px]">
                      {colTasks.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-gray-600 text-xs">タスクなし</div>
                      ) : colTasks.map(task => {
                        const ownerMeta = task.owner === 'anchan'
                          ? { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', label: '🤖', labelColor: 'text-indigo-400' }
                          : task.owner === 'user'
                          ? { bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: '👤', labelColor: 'text-amber-400' }
                          : { bg: 'bg-teal-500/10', border: 'border-teal-500/20', label: '🤝', labelColor: 'text-teal-400' };
                        const priorityBadge = task.priority === 'high'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : task.priority === 'low'
                          ? 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                        return (
                          <div
                            key={task.id}
                            className={`group relative ${ownerMeta.bg} border ${ownerMeta.border} rounded-xl p-3 cursor-pointer hover:brightness-125 transition-all`}
                            onClick={() => cycleTaskStatus(task)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-black text-white mb-1.5 leading-snug ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                                  <span className={`${ownerMeta.labelColor} mr-1`}>{ownerMeta.label}</span>
                                  {task.title}
                                </p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge}`}>
                                  {task.priority === 'high' ? '🔴 高' : task.priority === 'low' ? '⚪ 低' : '🔵 中'}
                                </span>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteCollabTask(task.id); }}
                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-rose-400 transition-all p-0.5 rounded"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Panel D: System Jobs Control Panel */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-8">
          <div className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br from-indigo-500/5 via-blue-500/5 to-transparent">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <div className="w-2 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                <span>💻 システム手動実行コントロール（Sovereign ADO）</span>
              </h3>
              <div className="text-xs text-gray-500">
                ポータルからバックエンドの各モジュールを今すぐ起動できます
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ジョブ一覧 */}
              <div className="lg:col-span-1 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ジョブ一覧</p>
                {Object.entries(jobsStatus).map(([key, job]) => (
                  <div 
                    key={key} 
                    onClick={() => handleFetchJobLogs(key)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      selectedJob === key 
                        ? 'bg-blue-500/10 border-blue-500/30' 
                        : 'bg-black/20 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-200">{job.name}</span>
                      <div className="flex items-center gap-2">
                        {job.isRunning ? (
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                          </span>
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full bg-gray-600"></span>
                        )}
                        <span className="text-[10px] text-gray-500 font-bold uppercase">
                          {job.isRunning ? 'RUNNING' : 'IDLE'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartJob(key); }}
                      disabled={job.isRunning || jobActionLoading !== null}
                      className="w-full py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-bold text-xs disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5"
                    >
                      {job.isRunning ? '実行中...' : 'ジョブを起動'}
                    </button>
                  </div>
                ))}
              </div>

              {/* コンソールログ */}
              <div className="lg:col-span-2 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    📜 実行ログ: {jobsStatus[selectedJob]?.name || selectedJob}
                  </p>
                  <button
                    onClick={() => handleFetchJobLogs(selectedJob)}
                    className="p-1 hover:bg-white/5 rounded text-gray-500 hover:text-gray-300 transition-all text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> ログ更新
                  </button>
                </div>
                <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 p-4 font-mono text-[11px] leading-relaxed text-gray-400 overflow-y-auto whitespace-pre relative">
                  {selectedJobLogs ? selectedJobLogs : 'ログは空、または履歴がありません。'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </motion.main>


    </div>
  );
}
