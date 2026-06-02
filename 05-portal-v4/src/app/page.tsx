"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, TrendingUp, ShieldAlert, Cpu, Network, Gamepad2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

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
  const [activeTab, setActiveTab] = useState('overview');
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const { data, error } = await supabase
          .from('matchup_sentinel')
          .select('matchup_id, champion, enemy, raw_data, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (error) throw error;
        if (data) setRecentMatches(data);
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchMatches();
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
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
      
      {/* Header Section */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            <span className="text-gradient">Sovereign OS</span> <span className="text-white">v4.0</span>
          </h1>
          <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
            <Activity size={18} className="animate-pulse" />
            システムオンライン
          </p>
        </div>
        
        <div className="glass-panel rounded-full px-6 py-2 flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse shadow-[0_0_8px_var(--color-success)]"></div>
            <span className="text-sm font-medium text-gray-300">システム正常</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse shadow-[0_0_8px_var(--color-success)]"></div>
            <span className="text-sm font-medium text-gray-300">データ同期完了</span>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        
        {/* Stat Cards */}
        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400 font-medium mb-1">同期済みデータ（合計）</p>
              <h3 className="text-3xl font-bold text-white">1,284</h3>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
              <Network size={24} />
            </div>
          </div>
          <p className="text-xs text-green-400 flex items-center gap-1 mt-4">
            <TrendingUp size={14} /> 先週比 +12%
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400 font-medium mb-1">バックグラウンド処理</p>
              <h3 className="text-3xl font-bold text-white">稼働中</h3>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
              <Cpu size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-4">
            エッジ関数は正常に動作しています
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400 font-medium mb-1">要確認タスク</p>
              <h3 className="text-3xl font-bold text-white">3</h3>
            </div>
            <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
              <ShieldAlert size={24} />
            </div>
          </div>
          <p className="text-xs text-red-400 flex items-center gap-1 mt-4">
            確認待ちのデータがあります
          </p>
        </motion.div>

        {/* Large Chart Area */}
        <motion.div variants={itemVariants} className="md:col-span-2 glass-panel rounded-2xl p-6 h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">システムメトリクス</h2>
            <div className="flex gap-2 bg-[var(--color-surface)] p-1 rounded-lg">
              {[
                { id: 'overview', label: '概要' },
                { id: 'matches', label: '戦績' },
                { id: 'revenue', label: '収益' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id ? 'bg-blue-500/30 text-blue-300' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dummyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f1115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity List */}
        <motion.div variants={itemVariants} className="glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">最新の戦績データ</h2>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4 text-gray-400 text-sm animate-pulse">データを同期中...</div>
            ) : recentMatches.length > 0 ? (
              recentMatches.map((match) => {
                const isWin = match.raw_data?.result === 'Win';
                return (
                  <div key={match.matchup_id} className="flex gap-4 items-start group">
                    <div className="mt-1 p-2 bg-[var(--color-surface)] rounded-lg group-hover:bg-[var(--color-surface-hover)] transition-colors">
                      <Gamepad2 size={16} className={isWin ? "text-blue-400" : "text-red-400"} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-200">
                        {match.champion} ({isWin ? 'Victory' : 'Defeat'})
                      </h4>
                      <p className="text-xs text-gray-500 flex gap-2">
                        <span>KDA: {match.raw_data?.my_kda || '不明'}</span>
                        <span>•</span>
                        <span>対面: {match.enemy || '不明'}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">データがありません</div>
            )}
          </div>
          <button className="w-full mt-6 py-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-sm text-gray-300 font-medium transition-all">
            すべてのログを表示
          </button>
        </motion.div>

      </motion.main>
    </div>
  );
}
