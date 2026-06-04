'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Swords, Activity } from 'lucide-react';

interface LaneStats {
  games: number;
  wins: number;
}

interface PlayerWinrate {
  name: string;
  totalGames: number;
  totalWins: number;
  lanes: {
    TOP: LaneStats;
    JG: LaneStats;
    MID: LaneStats;
    ADC: LaneStats;
    SUP: LaneStats;
  };
}

export default function WinrateMatrixPanel() {
  const [data, setData] = useState<PlayerWinrate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/stats/winrates');
        if (!res.ok) throw new Error('Failed to fetch winrates');
        const json = await res.json();
        if (json.status !== 'SUCCESS') throw new Error(json.message);
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/5 backdrop-blur-md rounded-3xl border border-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mb-4"></div>
        <div className="text-gray-400 font-medium">戦績データを集計中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-900/20 rounded-3xl border border-red-800/50 text-center">
        <div className="text-red-400 font-bold mb-2">読み込みエラー</div>
        <div className="text-red-300/70 text-sm">{error}</div>
      </div>
    );
  }

  const renderCell = (stats: LaneStats) => {
    if (stats.games === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full opacity-30">
          <Minus size={16} className="text-gray-600 mb-1" />
          <span className="text-[10px] text-gray-600">0戦</span>
        </div>
      );
    }

    const winrate = (stats.wins / stats.games) * 100;
    
    // 勝率と試合数に応じた色とスタイリング
    let colorClass = "text-gray-300";
    let bgClass = "bg-gray-800/30";
    let Icon = Activity;
    
    // 3試合以上プレイしている場合に色を付ける（試行回数が少ないノイズを除外）
    if (stats.games >= 3) {
      if (winrate >= 60) {
        colorClass = "text-emerald-400";
        bgClass = "bg-emerald-500/10 border-emerald-500/20";
        Icon = TrendingUp;
      } else if (winrate <= 40) {
        colorClass = "text-red-400";
        bgClass = "bg-red-500/10 border-red-500/20";
        Icon = TrendingDown;
      } else if (winrate > 50) {
        colorClass = "text-blue-400";
        bgClass = "bg-blue-500/10 border-blue-500/20";
      } else {
        colorClass = "text-orange-400";
        bgClass = "bg-orange-500/10 border-orange-500/20";
      }
    }

    return (
      <div className={`flex flex-col items-center justify-center h-full p-2 rounded-xl border border-transparent transition-all hover:bg-white/5 ${bgClass}`}>
        <div className={`text-lg font-bold flex items-center gap-1 ${colorClass}`}>
          {winrate >= 60 || winrate <= 40 ? <Icon size={14} /> : null}
          {winrate.toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500 font-medium">
          {stats.games}戦 <span className="text-emerald-500/70">{stats.wins}W</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-[#111827] to-gray-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-800/50">
      
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-800/50">
        <div className="bg-indigo-500/20 p-3 rounded-2xl">
          <Swords className="text-indigo-400" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">レーン別 勝率マトリックス</h2>
          <p className="text-sm text-gray-400 mt-1">全メンバーの各レーンごとの勝率と試合数を比較できます（3戦以上で色付け）</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <table className="w-full min-w-[800px] border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 tracking-wider w-48">PLAYER</th>
              <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 tracking-wider">TOP</th>
              <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 tracking-wider">JUNGLE</th>
              <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 tracking-wider">MID</th>
              <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 tracking-wider">ADC</th>
              <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 tracking-wider">SUPPORT</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 tracking-wider border-l border-gray-800/50">OVERALL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((player, idx) => {
              const overallWr = player.totalGames > 0 ? (player.totalWins / player.totalGames) * 100 : 0;
              return (
                <tr key={player.name} className="group hover:bg-white/[0.02] transition-colors rounded-2xl">
                  <td className="px-4 py-3 align-middle rounded-l-2xl border-y border-l border-gray-800/30 bg-gray-900/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300 border border-gray-700">
                        {idx + 1}
                      </div>
                      <div className="font-bold text-gray-200">{player.name}</div>
                    </div>
                  </td>
                  <td className="px-1 py-2 align-middle border-y border-gray-800/30 bg-gray-900/20">
                    {renderCell(player.lanes.TOP)}
                  </td>
                  <td className="px-1 py-2 align-middle border-y border-gray-800/30 bg-gray-900/20">
                    {renderCell(player.lanes.JG)}
                  </td>
                  <td className="px-1 py-2 align-middle border-y border-gray-800/30 bg-gray-900/20">
                    {renderCell(player.lanes.MID)}
                  </td>
                  <td className="px-1 py-2 align-middle border-y border-gray-800/30 bg-gray-900/20">
                    {renderCell(player.lanes.ADC)}
                  </td>
                  <td className="px-1 py-2 align-middle border-y border-gray-800/30 bg-gray-900/20">
                    {renderCell(player.lanes.SUP)}
                  </td>
                  <td className="px-4 py-3 align-middle text-right rounded-r-2xl border-y border-r border-gray-800/30 bg-gray-900/20 border-l border-l-gray-800/50">
                    <div className="flex flex-col items-end">
                      <div className={`text-lg font-black ${overallWr >= 55 ? 'text-blue-400' : overallWr < 45 && player.totalGames > 0 ? 'text-red-400' : 'text-gray-200'}`}>
                        {player.totalGames > 0 ? `${overallWr.toFixed(1)}%` : '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {player.totalGames}戦
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
