'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw, Users, Swords, Crown, Target, HeartHandshake } from 'lucide-react';
import { Spinner } from '../../components/Feedback';

interface MatchData {
  match_id: number;
  player_name: string;
  team: 'BLUE' | 'RED';
  role: string;
  ktm_matches: {
    winning_team: 'BLUE' | 'RED';
  };
}

interface AllyStat {
  p1: string;
  p2: string;
  games: number;
  wins: number;
  winRate: number;
}

interface EnemyStat {
  p1: string;
  p2: string;
  games: number;
  p1Wins: number;
  p2Wins: number;
  winRateDiff: number; // 0に近いほどライバル（50%）
}

interface GroupStat {
  members: string[];
  games: number;
  wins: number;
  winRate: number;
}

// n個からk個の組み合わせを列挙
function combosOf<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, cur: T[]) => {
    if (cur.length === k) { result.push([...cur]); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); walk(i + 1, cur); cur.pop(); }
  };
  walk(0, []);
  return result;
}

export default function SynergyPage() {
  const [loading, setLoading] = useState(true);
  const [allyStats, setAllyStats] = useState<AllyStat[]>([]);
  const [enemyStats, setEnemyStats] = useState<EnemyStat[]>([]);
  const [minGames, setMinGames] = useState(3);
  // グループ相性(#78): 3/4/5人で同チームだった時の勝率
  const [groupStats, setGroupStats] = useState<Record<number, GroupStat[]>>({ 3: [], 4: [], 5: [] });
  const [groupSize, setGroupSize] = useState<2 | 3 | 4 | 5>(2);
  // 最強⇔最弱の表示切替
  const [showWorst, setShowWorst] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('ktm_match_participants')
          .select('match_id, player_name, team, role, ktm_matches!inner(winning_team)');

        const { data: activePlayersData } = await supabase
          .from('ktm_players')
          .select('name');
        
        const activePlayerNames = new Set(activePlayersData?.map((p: any) => p.name) || []);

        if (error) throw error;
        
        // 試合ごとにグループ化
        const matches: Record<number, { BLUE: string[], RED: string[], winner: 'BLUE' | 'RED' }> = {};
        data.forEach((row: any) => {
          // 現在居ないプレイヤーは集計から除外
          if (!activePlayerNames.has(row.player_name)) return;

          if (!matches[row.match_id]) {
            matches[row.match_id] = { BLUE: [], RED: [], winner: row.ktm_matches.winning_team };
          }
          matches[row.match_id][row.team as 'BLUE'|'RED'].push(row.player_name);
        });

        const allyMap: Record<string, { games: number, wins: number }> = {};
        const enemyMap: Record<string, { games: number, p1Wins: number, p2Wins: number }> = {};
        // グループ相性(#78): サイズ別の同チーム勝率
        const groupMaps: Record<number, Record<string, { games: number; wins: number }>> = { 3: {}, 4: {}, 5: {} };

        // 集計
        Object.values(matches).forEach(m => {
          // 味方同士
          const processTeam = (teamPlayers: string[], isWin: boolean) => {
            for (let i = 0; i < teamPlayers.length; i++) {
              for (let j = i + 1; j < teamPlayers.length; j++) {
                const pair = [teamPlayers[i], teamPlayers[j]].sort();
                const key = `${pair[0]}::${pair[1]}`;
                if (!allyMap[key]) allyMap[key] = { games: 0, wins: 0 };
                allyMap[key].games++;
                if (isWin) allyMap[key].wins++;
              }
            }
            // 3/4/5人グループ(#78)
            for (const k of [3, 4, 5]) {
              if (teamPlayers.length < k) continue;
              for (const combo of combosOf(teamPlayers, k)) {
                const key = [...combo].sort().join('::');
                if (!groupMaps[k][key]) groupMaps[k][key] = { games: 0, wins: 0 };
                groupMaps[k][key].games++;
                if (isWin) groupMaps[k][key].wins++;
              }
            }
          };
          processTeam(m.BLUE, m.winner === 'BLUE');
          processTeam(m.RED, m.winner === 'RED');

          // 敵同士
          for (const blueP of m.BLUE) {
            for (const redP of m.RED) {
              const pair = [blueP, redP].sort();
              const key = `${pair[0]}::${pair[1]}`;
              if (!enemyMap[key]) enemyMap[key] = { games: 0, p1Wins: 0, p2Wins: 0 };
              
              enemyMap[key].games++;
              const isP1Blue = pair[0] === blueP;
              const p1Won = (isP1Blue && m.winner === 'BLUE') || (!isP1Blue && m.winner === 'RED');
              if (p1Won) {
                enemyMap[key].p1Wins++;
              } else {
                enemyMap[key].p2Wins++;
              }
            }
          }
        });

        // 配列化してソート
        const parsedAlly = Object.entries(allyMap).map(([key, stat]) => {
          const [p1, p2] = key.split('::');
          return { p1, p2, games: stat.games, wins: stat.wins, winRate: stat.wins / stat.games };
        });

        const parsedEnemy = Object.entries(enemyMap).map(([key, stat]) => {
          const [p1, p2] = key.split('::');
          // 勝率差の絶対値 (50%の時0になるように計算) -> 0 に近いほど拮抗している
          const p1Rate = stat.p1Wins / stat.games;
          const winRateDiff = Math.abs(0.5 - p1Rate);
          return { p1, p2, games: stat.games, p1Wins: stat.p1Wins, p2Wins: stat.p2Wins, winRateDiff };
        });

        setAllyStats(parsedAlly);
        setEnemyStats(parsedEnemy);
        // グループ相性を配列化(#78)
        const parsedGroups: Record<number, GroupStat[]> = { 3: [], 4: [], 5: [] };
        for (const k of [3, 4, 5]) {
          parsedGroups[k] = Object.entries(groupMaps[k]).map(([key, s]) => ({
            members: key.split('::'),
            games: s.games,
            wins: s.wins,
            winRate: s.wins / s.games,
          }));
        }
        setGroupStats(parsedGroups);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <Spinner label="相性データを分析中..." />
      </div>
    );
  }

  // フィルタリングとソート
  // 味方は勝率降順、同勝率なら試合数降順
  // 最強=勝率降順 / 最弱=勝率昇順（同率なら試合数が多い順＝信頼度の高い順）
  const filteredAlly = allyStats
    .filter(a => a.games >= minGames)
    .sort((a, b) => {
      if (b.winRate === a.winRate) return b.games - a.games;
      return showWorst ? a.winRate - b.winRate : b.winRate - a.winRate;
    });

  // グループ相性(#78): 選択サイズのグループを勝率順に（人数が多いほど同条件が少ないのでminGamesは緩めに適用）
  const groupMin = groupSize >= 4 ? Math.min(minGames, 2) : minGames;
  const filteredGroups = (groupStats[groupSize] || [])
    .filter(g => g.games >= groupMin)
    .sort((a, b) => {
      if (b.winRate === a.winRate) return b.games - a.games;
      return showWorst ? a.winRate - b.winRate : b.winRate - a.winRate;
    })
    .slice(0, 50);

  // 敵は勝率が拮抗している順（winRateDiffが小さい順）、同率なら試合数が多い順
  const filteredEnemy = enemyStats
    .filter(e => e.games >= minGames)
    .sort((a, b) => {
      if (a.winRateDiff === b.winRateDiff) return b.games - a.games;
      return a.winRateDiff - b.winRateDiff;
    });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <HeartHandshake className="h-8 w-8 text-fuchsia-500" />
              相性・ライバル分析
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              過去のKTMの全試合データから算出された「味方時の勝率」と「敵同士の勝敗」を分析し、<br/>
              最高のコンビと宿命のライバルを導き出します。
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
            <span className="text-sm font-bold text-gray-400">フィルター:</span>
            <select 
              value={minGames} 
              onChange={e => setMinGames(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 outline-none focus:border-fuchsia-500"
            >
              <option value={2}>2試合以上共闘・対戦</option>
              <option value={3}>3試合以上共闘・対戦</option>
              <option value={5}>5試合以上共闘・対戦</option>
              <option value={10}>10試合以上共闘・対戦</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* 最強の相棒 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
              <h2 className={`text-2xl font-black flex items-center gap-2 ${showWorst ? 'text-rose-400' : 'text-emerald-400'}`}>
                <Users className="h-6 w-6" /> {showWorst ? '最弱のチーム' : '最強のチーム'} <span className="text-sm text-gray-500 font-normal">({showWorst ? 'Worst Combo' : 'Best Combo'})</span>
              </h2>
              <div className="flex gap-2 items-center flex-wrap">
                {/* 最強⇔最弱切替 */}
                <div className="flex gap-1 bg-gray-950 border border-gray-800 rounded-xl p-1">
                  <button onClick={() => setShowWorst(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${!showWorst ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    👑 最強
                  </button>
                  <button onClick={() => setShowWorst(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${showWorst ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    💀 最弱
                  </button>
                </div>
                {/* 人数切替(#78) */}
                <div className="flex gap-1 bg-gray-950 border border-gray-800 rounded-xl p-1">
                  {([2, 3, 4, 5] as const).map(n => (
                    <button key={n} onClick={() => setGroupSize(n)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${groupSize === n ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      {n}人
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {groupSize > 2 ? (
                /* 3/4/5人グループ表示(#78) */
                filteredGroups.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">この人数で{groupMin}戦以上一緒に戦った組み合わせがありません</div>
                ) : (
                  filteredGroups.map((g, i) => (
                    <div key={g.members.join('-')} className="flex items-center gap-4 bg-gray-950/50 hover:bg-gray-800/80 p-4 rounded-xl border border-gray-800 transition">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0 ${i < 3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {g.members.map((m, idx) => (
                            <span key={m} className="font-bold text-white text-sm">
                              {m}{idx < g.members.length - 1 && <span className="text-gray-600 mx-0.5">・</span>}
                            </span>
                          ))}
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className={`text-xl font-black ${g.winRate >= 0.7 ? 'text-emerald-400' : g.winRate >= 0.5 ? 'text-teal-400' : 'text-gray-500'}`}>
                            {(g.winRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500 font-bold tracking-wider">{g.games}戦 {g.wins}勝</div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : filteredAlly.length === 0 ? (
                <div className="text-center text-gray-500 py-8">データがありません</div>
              ) : (
                filteredAlly.map((stat, i) => (
                  <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-4 bg-gray-950/50 hover:bg-gray-800/80 p-4 rounded-xl border border-gray-800 transition">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${i < 3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-lg">{stat.p1}</span>
                        <span className="text-gray-600 text-sm">🤝</span>
                        <span className="font-bold text-white text-lg">{stat.p2}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className={`text-2xl font-black ${stat.winRate >= 0.7 ? 'text-emerald-400' : stat.winRate >= 0.5 ? 'text-teal-400' : 'text-gray-500'}`}>
                          {(stat.winRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 font-bold tracking-wider">
                          {stat.games}戦 {stat.wins}勝
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 宿命のライバル */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
            <h2 className="text-2xl font-black text-red-500 mb-6 flex items-center gap-2">
              <Swords className="h-6 w-6" /> 宿命のライバル <span className="text-sm text-gray-500 font-normal">(Rivals)</span>
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredEnemy.length === 0 ? (
                <div className="text-center text-gray-500 py-8">データがありません</div>
              ) : (
                filteredEnemy.map((stat, i) => {
                  const p1Rate = (stat.p1Wins / stat.games * 100).toFixed(0);
                  const p2Rate = (stat.p2Wins / stat.games * 100).toFixed(0);
                  
                  return (
                    <div key={`${stat.p1}-${stat.p2}`} className="flex flex-col bg-gray-950/50 hover:bg-gray-800/80 p-4 rounded-xl border border-gray-800 transition">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold text-lg ${stat.p1Wins > stat.p2Wins ? 'text-amber-400' : 'text-gray-300'}`}>{stat.p1}</span>
                        <div className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full font-black tracking-widest border border-red-900/50">VS</div>
                        <span className={`font-bold text-lg ${stat.p2Wins > stat.p1Wins ? 'text-amber-400' : 'text-gray-300'}`}>{stat.p2}</span>
                      </div>
                      
                      <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-1000" 
                          style={{ width: `${p1Rate}%` }}
                        ></div>
                        <div 
                          className="h-full bg-red-500 transition-all duration-1000" 
                          style={{ width: `${p2Rate}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2 text-sm font-mono font-bold">
                        <span className="text-blue-400">{stat.p1Wins}勝 ({p1Rate}%)</span>
                        <span className="text-gray-600 text-xs">Total: {stat.games}戦</span>
                        <span className="text-red-400">({p2Rate}%) {stat.p2Wins}勝</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
