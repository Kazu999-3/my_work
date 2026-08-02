'use client';

import { useEffect, useState, useMemo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Swords, Activity } from 'lucide-react';
import { Spinner, ErrorState } from '../../components/Feedback';

interface LaneStats {
  games: number;
  wins: number;
  mmr: number;
}

interface PlayerWinrate {
  name: string;
  totalGames: number;
  totalWins: number;
  overallMmr: number;
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

  // 注意: この2つ(useState/useMemo)は元々ローディング/エラー時のearly returnより
  // 下にあった。フックはレンダーごとに同じ回数・同じ順番で呼ばれなければならないため、
  // 「読み込み中は3個、読み込み完了後は6個」のようにフック呼び出し数が変わった瞬間
  // Reactが例外を投げ、開くたびに問題が発生していました(#error.tsxの境界が捕捉)。
  // 早期returnより前に移動して、常に同じ回数呼ばれるようにする。
  const [sortKey, setSortKey] = useState<'overall' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'games' | 'mmr' | 'name'>('overall');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let valA = 0;
      let valB = 0;
      let gamesA = 0;
      let gamesB = 0;

      if (sortKey === 'name') {
        return sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      } else if (sortKey === 'games') {
        valA = a.totalGames;
        valB = b.totalGames;
      } else if (sortKey === 'mmr') {
        valA = a.overallMmr;
        valB = b.overallMmr;
      } else if (sortKey === 'overall') {
        valA = a.totalGames > 0 ? (a.totalWins / a.totalGames) * 100 : -1;
        valB = b.totalGames > 0 ? (b.totalWins / b.totalGames) * 100 : -1;
        gamesA = a.totalGames;
        gamesB = b.totalGames;
      } else {
        // TOP, JG, MID, ADC, SUP レーン勝率ソート
        const statsA = a.lanes[sortKey];
        const statsB = b.lanes[sortKey];
        valA = statsA && statsA.games > 0 ? (statsA.wins / statsA.games) * 100 : -1;
        valB = statsB && statsB.games > 0 ? (statsB.wins / statsB.games) * 100 : -1;
        gamesA = statsA ? statsA.games : 0;
        gamesB = statsB ? statsB.games : 0;
      }

      if (valA === valB) {
        return sortOrder === 'desc' ? gamesB - gamesA : gamesA - gamesB;
      }

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [data, sortKey, sortOrder]);

  const handleHeaderClick = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-black/10">
        <Spinner label="戦績データを集計中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 rounded-3xl border border-black/10">
        <ErrorState title="読み込みエラー" message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const renderCell = (stats: LaneStats) => {
    if (stats.games === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full opacity-30">
          <Minus size={16} className="text-stone-400 mb-1" />
          <span className="text-[10px] text-stone-400">0戦</span>
        </div>
      );
    }

    const winrate = (stats.wins / stats.games) * 100;

    // 勝率と試合数に応じた色とスタイリング
    let colorClass = "text-stone-700";
    let bgClass = "bg-black/5";
    let Icon = Activity;

    // 3試合以上プレイしている場合に色を付ける（試行回数が少ないノイズを除外）
    if (stats.games >= 3) {
      if (winrate >= 60) {
        colorClass = "text-emerald-700";
        bgClass = "bg-emerald-100 border-emerald-200";
        Icon = TrendingUp;
      } else if (winrate > 50) {
        colorClass = "text-sky-700";
        bgClass = "bg-sky-100 border-sky-200";
        Icon = Activity;
      } else if (winrate >= 45) {
        colorClass = "text-stone-700";
        bgClass = "bg-black/5 border-black/10";
        Icon = Activity;
      } else if (winrate >= 40) {
        colorClass = "text-orange-700";
        bgClass = "bg-orange-100 border-orange-200";
        Icon = Activity;
      } else {
        colorClass = "text-red-700";
        bgClass = "bg-red-100 border-red-200";
        Icon = TrendingDown;
      }
    }

    return (
      <div className={`flex flex-col items-center justify-center h-full p-2 rounded-xl border border-transparent transition-all hover:bg-black/5 ${bgClass}`}>
        <div className={`text-lg font-bold flex items-center gap-1 ${colorClass}`}>
          {winrate >= 60 || winrate <= 40 ? <Icon size={14} /> : null}
          {winrate.toFixed(1)}%
        </div>
        <div className="text-[10px] text-stone-500 font-medium mb-1 flex gap-1">
          <span>{stats.games}戦</span> <span className="text-emerald-600">{stats.wins}W</span>
        </div>
        <div className="text-xs font-mono font-bold text-stone-700 bg-black/5 px-1.5 py-0.5 rounded border border-black/10">
          {stats.mmr.toLocaleString()}
        </div>
      </div>
    );
  };

  const renderSortIndicator = (key: typeof sortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 inline-block text-cyan-700 font-black">{sortOrder === 'desc' ? '▼' : '▲'}</span>;
  };

  return (
    <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-black/10">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-black/10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-3 rounded-2xl">
            <Swords className="text-indigo-700" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">レーン別 勝率マトリックス</h2>
            <p className="text-sm text-stone-500 mt-1">ヘッダーのレーン名や勝率をクリックして、自由自在にランキングをソートできます！</p>
          </div>
        </div>

        {/* クイックソートボタン */}
        <div className="flex flex-wrap items-center gap-1.5 bg-black/5 p-1.5 rounded-2xl border border-black/10 text-xs">
          <span className="text-[10px] text-stone-500 font-bold px-1.5">並び替え:</span>
          {([
            ['overall', '総合勝率'],
            ['TOP', 'TOP勝率'],
            ['JG', 'JG勝率'],
            ['MID', 'MID勝率'],
            ['ADC', 'ADC勝率'],
            ['SUP', 'SUP勝率'],
            ['mmr', 'MMR順']
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => handleHeaderClick(k as any)}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all ${
                sortKey === k
                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-black/5'
              }`}
            >
              {label} {renderSortIndicator(k as any)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <table className="w-full min-w-[800px] border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th
                onClick={() => handleHeaderClick('name')}
                className="px-4 py-3 text-left text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer tracking-wider w-48 sticky left-0 z-20 bg-surface"
              >
                PLAYER {renderSortIndicator('name')}
              </th>
              {(['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map(role => (
                <th
                  key={role}
                  onClick={() => handleHeaderClick(role)}
                  className={`px-2 py-3 text-center text-xs font-bold cursor-pointer transition-colors ${
                    sortKey === role ? 'text-cyan-700 font-black bg-cyan-100 rounded-t-xl' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {role} {renderSortIndicator(role)}
                </th>
              ))}
              <th
                onClick={() => handleHeaderClick('overall')}
                className={`px-4 py-3 text-right text-xs font-bold cursor-pointer transition-colors border-l border-black/10 ${
                  sortKey === 'overall' ? 'text-indigo-700 font-black bg-indigo-100 rounded-t-xl' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                OVERALL {renderSortIndicator('overall')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((player, idx) => {
              const overallWr = player.totalGames > 0 ? (player.totalWins / player.totalGames) * 100 : 0;
              return (
                <tr key={player.name} className="group hover:bg-black/2 transition-colors rounded-2xl">
                  <td className="px-4 py-3 align-middle rounded-l-2xl border-y border-l border-black/10 bg-white sticky left-0 z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold text-stone-700 border border-black/10">
                        {idx + 1}
                      </div>
                      <div className="font-bold text-stone-800">{player.name}</div>
                    </div>
                  </td>
                  <td className={`px-1 py-2 align-middle border-y border-black/10 ${sortKey === 'TOP' ? 'bg-cyan-50' : 'bg-black/2'}`}>
                    {renderCell(player.lanes.TOP)}
                  </td>
                  <td className={`px-1 py-2 align-middle border-y border-black/10 ${sortKey === 'JG' ? 'bg-cyan-50' : 'bg-black/2'}`}>
                    {renderCell(player.lanes.JG)}
                  </td>
                  <td className={`px-1 py-2 align-middle border-y border-black/10 ${sortKey === 'MID' ? 'bg-cyan-50' : 'bg-black/2'}`}>
                    {renderCell(player.lanes.MID)}
                  </td>
                  <td className={`px-1 py-2 align-middle border-y border-black/10 ${sortKey === 'ADC' ? 'bg-cyan-50' : 'bg-black/2'}`}>
                    {renderCell(player.lanes.ADC)}
                  </td>
                  <td className={`px-1 py-2 align-middle border-y border-black/10 ${sortKey === 'SUP' ? 'bg-cyan-50' : 'bg-black/2'}`}>
                    {renderCell(player.lanes.SUP)}
                  </td>
                  <td className={`px-4 py-3 align-middle text-right rounded-r-2xl border-y border-r border-black/10 border-l border-l-black/10 ${sortKey === 'overall' ? 'bg-indigo-50' : 'bg-black/2'}`}>
                    <div className="flex flex-col items-end">
                      <div className={`text-lg font-black ${overallWr >= 55 ? 'text-sky-700' : overallWr < 45 && player.totalGames > 0 ? 'text-red-600' : 'text-stone-700'}`}>
                        {player.totalGames > 0 ? `${overallWr.toFixed(1)}%` : '-'}
                      </div>
                      <div className="text-[10px] text-stone-500 mb-1">
                        {player.totalGames}戦
                      </div>
                      <div className="text-xs font-mono font-bold text-stone-700 bg-black/5 px-2 py-0.5 rounded border border-black/10">
                        {player.overallMmr.toLocaleString()} <span className="text-[10px] text-stone-500 font-normal">MMR</span>
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
