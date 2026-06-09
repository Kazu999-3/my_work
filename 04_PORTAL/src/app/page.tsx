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
  const [apiErrors, setApiErrors] = useState<number>(0);
  const [apiLimit, setApiLimit] = useState<number>(780);
  const [apiUsageDetails, setApiUsageDetails] = useState<Record<string, { used: number, limit: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. 最新の戦績10件を取得 (辞典データやシステムログを除外)
        const { data: matchesData, error: matchesError } = await supabase
          .from('matchup_sentinel')
          .select('matchup_id, champion, enemy, raw_data, created_at')
          .neq('enemy', 'GLOBAL')
          .neq('champion', 'SYSTEM')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (matchesError) throw matchesError;
        if (matchesData) setRecentMatches(matchesData);

        // 2. 総データ数の取得
        const { count: totalCount, error: totalError } = await supabase
          .from('matchup_sentinel')
          .select('*', { count: 'exact', head: true });
        
        if (!totalError && totalCount !== null) {
          setTotalAssets(totalCount);
        }

        // 3. 要確認タスク数の取得 (raw_data内のstrategyが空のものを未処理とみなす)
        const { count: pendingCount, error: pendingError } = await supabase
          .from('matchup_sentinel')
          .select('*', { count: 'exact', head: true })
          .or('raw_data->>strategy.is.null,raw_data->>strategy.eq.');

        if (!pendingError && pendingCount !== null) {
          setPendingTasks(pendingCount);
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
          
          setApiUsage(totalSuccess);
          setApiErrors(totalErrors);
          if (totalLimit > 0) setApiLimit(totalLimit);
          
          // Filter out features with 0 limit and 0 usage to keep it clean
          const cleanedDetails = Object.fromEntries(
            Object.entries(details).filter(([k, v]) => v.limit > 0 || v.used > 0)
          );
          setApiUsageDetails(cleanedDetails);
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
          <div className="group/quota relative">
            <div className="flex items-end gap-2 mb-2">
              <h3 className="text-4xl font-black text-white tracking-tight">{isLoading ? '-' : apiUsage}</h3>
              <span className="text-lg text-gray-500 font-medium mb-1">/ {apiLimit}</span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${apiUsage > apiLimit * 0.8 ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : apiUsage > apiLimit * 0.5 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'}`}
                style={{ width: `${Math.min((apiUsage / apiLimit) * 100, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-3 flex items-center justify-between">
              <span>本日のAPI利用状況</span>
              {apiErrors > 0 && (
                <span className="text-rose-400/90 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  ⚠️ 制限待機: {apiErrors}回
                </span>
              )}
            </p>
            
            {/* Hover Tooltip / Detail Box for API usage per feature */}
            <div className="absolute opacity-0 group-hover/quota:opacity-100 transition-opacity duration-300 pointer-events-none top-full left-0 mt-4 w-full min-w-[200px] z-50 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">各機能の消費状況</h4>
                <div className="space-y-3">
                    {Object.entries(apiUsageDetails).map(([key, data]) => (
                        <div key={key} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-300 truncate w-24" title={key}>{key}</span>
                                <span className="text-gray-400 font-mono"><span className={data.used >= data.limit && data.limit > 0 ? "text-rose-400 font-bold" : "text-white"}>{data.used}</span> / {data.limit > 0 ? data.limit : '∞'}</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                                <div className={`h-full rounded-full ${data.used >= data.limit && data.limit > 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'}`} style={{ width: `${Math.min((data.used / (data.limit || Math.max(data.used, 1))) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    ))}
                    {Object.keys(apiUsageDetails).length === 0 && (
                        <p className="text-xs text-gray-500 text-center py-2">詳細データがありません</p>
                    )}
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

        <motion.div variants={itemVariants}>
          <Link href="/champions" className="block glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent cursor-pointer group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 group-hover:scale-110 transition-transform">
                <ShieldAlert size={22} />
              </div>
              {pendingTasks > 0 && (
                <p className="text-xs font-bold text-rose-400/80 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 animate-pulse">ATTENTION</p>
              )}
            </div>
            <div>
              <h3 className="text-4xl font-black text-white mb-1 tracking-tight">{isLoading ? '-' : pendingTasks}</h3>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-400 font-medium">要確認・未処理タスク</p>
                <TrendingUp size={14} className="text-gray-500 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Link>
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
                      
                      <h4 className="text-xl font-black text-white mb-3 group-hover:text-blue-300 transition-colors">
                        {match.champion || match.raw_data?.myChamp || 'Unknown'}
                      </h4>
                      
                      <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 font-medium">KDA</span>
                          <span className="text-gray-200 font-mono font-bold">{match.raw_data?.my_kda || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 font-medium">対面</span>
                          <span className="text-gray-200 font-bold">{match.enemy || match.raw_data?.enemyChamp || '-'}</span>
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
