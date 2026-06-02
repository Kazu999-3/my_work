"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, TrendingUp, ShieldAlert, Cpu, Network, Gamepad2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

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
              <h3 className="text-3xl font-bold text-white">{isLoading ? '-' : totalAssets}</h3>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
              <Network size={24} />
            </div>
          </div>
          <p className="text-xs text-blue-400 flex items-center gap-1 mt-4">
            Supabaseと同期完了
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
              <h3 className="text-3xl font-bold text-white">{isLoading ? '-' : pendingTasks}</h3>
            </div>
            <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
              <ShieldAlert size={24} />
            </div>
          </div>
          <p className="text-xs text-red-400 flex items-center gap-1 mt-4">
            確認待ちのデータがあります
          </p>
        </motion.div>

        {/* Recent Activity List (グラフを消して全幅に) */}
        <motion.div variants={itemVariants} className="md:col-span-3 glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">最新の戦績データ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="text-center py-4 text-gray-400 text-sm animate-pulse col-span-full">データを同期中...</div>
            ) : recentMatches.length > 0 ? (
              recentMatches.map((match) => {
                const isWin = match.raw_data?.result === 'Win';
                return (
                  <div key={match.matchup_id} className="flex gap-4 items-start group glass-panel p-4 rounded-xl">
                    <div className="mt-1 p-2 bg-[var(--color-surface)] rounded-lg group-hover:bg-[var(--color-surface-hover)] transition-colors">
                      <Gamepad2 size={16} className={isWin ? "text-blue-400" : "text-red-400"} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-200">
                        {match.champion} ({isWin ? 'Victory' : 'Defeat'})
                      </h4>
                      <p className="text-xs text-gray-500 flex flex-col gap-1 mt-1">
                        <span>KDA: {match.raw_data?.my_kda || '不明'}</span>
                        <span>対面: {match.enemy || '不明'}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm col-span-full">データがありません</div>
            )}
          </div>
        </motion.div>

      </motion.main>
    </div>
  );
}
