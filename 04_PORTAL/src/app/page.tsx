"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, TrendingUp, ShieldAlert, Cpu, Network, Gamepad2, Users } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
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
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [totalAssets, setTotalAssets] = useState<number>(0);
  const [pendingTasks, setPendingTasks] = useState<number>(0);
  const [apiUsage, setApiUsage] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. 最新の戦績5件を取得
        const { data: matchesData, error: matchesError } = await supabase
          .from('matchup_sentinel')
          .select('matchup_id, champion, enemy, raw_data, created_at')
          .order('created_at', { ascending: false })
          .limit(10); // グラフを消したので10件に増やす
        
        if (matchesError) throw matchesError;
        if (matchesData) setRecentMatches(matchesData);

        // 2. 総データ数の取得
        const { count: totalCount, error: totalError } = await supabase
          .from('matchup_sentinel')
          .select('*', { count: 'exact', head: true });
        
        if (!totalError && totalCount !== null) {
          setTotalAssets(totalCount);
        }

        // 3. 要確認タスク数の取得 (strategy が空のものを未処理とみなす)
        const { count: pendingCount, error: pendingError } = await supabase
          .from('matchup_sentinel')
          .select('*', { count: 'exact', head: true })
          .or('strategy.eq.,strategy.is.null'); // 空文字 または null

        if (!pendingError && pendingCount !== null) {
          setPendingTasks(pendingCount);
        }

        // 4. API使用量の取得
        const todayObj = new Date();
        const yyyy = todayObj.getFullYear();
        const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
        const dd = String(todayObj.getDate()).padStart(2, '0');
        const todayFormatted = `${yyyy}-${mm}-${dd}`;

        const { data: apiData, error: apiError } = await supabase
          .from('api_usage_logs')
          .select('usage_data')
          .eq('date', todayFormatted)
          .single();

        if (!apiError && apiData && apiData.usage_data) {
          const total = Object.values(apiData.usage_data).reduce((a: any, b: any) => Number(a) + Number(b), 0);
          setApiUsage(Number(total));
        }

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, []);

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
        
        <div className="glass-panel border border-white/5 rounded-2xl px-6 py-3 flex gap-6 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
            </div>
            <span className="text-sm font-bold text-emerald-100 tracking-wide">SYSTEM ONLINE</span>
          </div>
        </div>
      </motion.header>

      {/* Quick Action / Admin Banner */}
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative rounded-3xl p-1 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-gradient-x opacity-40"></div>
        <div className="relative glass-panel rounded-[22px] p-6 md:p-8 flex flex-col md:flex-row justify-between items-center bg-black/40 backdrop-blur-2xl border-none gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <Users size={28} />
            </div>
            <div>
              <h3 className="text-white font-black text-2xl tracking-tight mb-1">KTM マネジメントポータル</h3>
              <p className="text-blue-200/70 text-sm font-medium">参加プレイヤーの管理、MMR調整、チーム編成をスマートに実行します</p>
            </div>
          </div>
          <Link href="/ktm-admin" prefetch={false} className="group relative w-full md:w-auto flex items-center justify-center gap-2 bg-white text-indigo-950 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <span>ダッシュボードを開く</span>
            <TrendingUp size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </motion.div>

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

        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Zap size={22} />
            </div>
            <p className="text-xs font-bold text-purple-400/80 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">QUOTA</p>
          </div>
          <div>
            <div className="flex items-end gap-2 mb-2">
              <h3 className="text-4xl font-black text-white tracking-tight">{isLoading ? '-' : apiUsage}</h3>
              <span className="text-lg text-gray-500 font-medium mb-1">/ 780</span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${apiUsage > 650 ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : apiUsage > 400 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'}`}
                style={{ width: `${Math.min((apiUsage / 780) * 100, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-3">本日のAPI利用状況</p>
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

        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <ShieldAlert size={22} />
            </div>
            {pendingTasks > 0 && (
              <p className="text-xs font-bold text-rose-400/80 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">ATTENTION</p>
            )}
          </div>
          <div>
            <h3 className="text-4xl font-black text-white mb-1 tracking-tight">{isLoading ? '-' : pendingTasks}</h3>
            <p className="text-sm text-gray-400 font-medium">要確認・未処理タスク</p>
          </div>
        </motion.div>

        {/* Recent Activity List */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-4 mt-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-white tracking-tight">最新の戦績データ</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {isLoading ? (
              <div className="text-center py-12 text-gray-400 text-sm animate-pulse col-span-full glass-panel rounded-3xl border border-white/5">データを同期中...</div>
            ) : recentMatches.length > 0 ? (
              recentMatches.map((match) => {
                const isWin = match.raw_data?.result === 'Win';
                return (
                  <div key={match.matchup_id} className="group relative glass-panel rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                    {/* Status indicator line */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${isWin ? 'bg-gradient-to-r from-blue-400 to-cyan-400' : 'bg-gradient-to-r from-rose-400 to-red-500'}`}></div>
                    
                    <div className="p-5">
                      <div className="flex justify-between items-center mb-4">
                        <div className={`p-2.5 rounded-xl flex items-center justify-center ${isWin ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          <Gamepad2 size={18} />
                        </div>
                        <span className={`text-xs font-black tracking-widest uppercase px-3 py-1 rounded-full border ${isWin ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                          {isWin ? 'Victory' : 'Defeat'}
                        </span>
                      </div>
                      
                      <h4 className="text-xl font-black text-white mb-3 group-hover:text-blue-300 transition-colors">{match.champion}</h4>
                      
                      <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 font-medium">KDA</span>
                          <span className="text-gray-200 font-mono font-bold">{match.raw_data?.my_kda || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 font-medium">対面</span>
                          <span className="text-gray-200 font-bold">{match.enemy || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500 text-sm col-span-full glass-panel rounded-3xl border border-white/5">データがありません</div>
            )}
          </div>
        </motion.div>

      </motion.main>
    </div>
  );
}
