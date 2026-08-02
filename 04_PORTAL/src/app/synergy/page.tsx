'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAllRows } from '../../lib/fetchAll';
import { Users, HeartHandshake, Crown, Skull, Sparkles } from 'lucide-react';
import { Spinner } from '../../components/Feedback';

interface AllyStat {
  p1: string;
  p2: string;
  games: number;
  wins: number;
  winRate: number;
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
  const [minGames, setMinGames] = useState(3);
  const [groupStats, setGroupStats] = useState<Record<number, GroupStat[]>>({ 3: [], 4: [], 5: [] });
  const [groupSize, setGroupSize] = useState<2 | 3 | 4 | 5>(2);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data, error } = await fetchAllRows((from, to) =>
          supabase
            .from('ktm_match_participants')
            .select('match_id, player_name, team, role')
            .range(from, to)
        );

        const { data: matchWins, error: matchWinsError } = await supabase
          .from('ktm_matches')
          .select('id, winning_team');

        if (matchWinsError) {
          console.error('Failed to fetch match results:', matchWinsError);
          throw matchWinsError;
        }

        const winMap: Record<number, 'BLUE' | 'RED'> = {};
        (matchWins || []).forEach((m: any) => { winMap[m.id] = m.winning_team; });

        const { data: activePlayersData, error: activePlayersError } = await supabase
          .from('ktm_players')
          .select('name');

        if (activePlayersError) {
          console.error('Failed to fetch active players:', activePlayersError);
          throw activePlayersError;
        }

        const activePlayerNames = new Set(activePlayersData?.map((p: any) => p.name) || []);

        if (error || !data) throw error || new Error('No data');
        
        const matches: Record<number, { BLUE: string[], RED: string[], winner: 'BLUE' | 'RED' }> = {};
        data.forEach((row: any) => {
          if (!activePlayerNames.has(row.player_name)) return;
          const winner = winMap[row.match_id];
          if (!winner) return;

          if (!matches[row.match_id]) {
            matches[row.match_id] = { BLUE: [], RED: [], winner };
          }
          matches[row.match_id][row.team as 'BLUE'|'RED'].push(row.player_name);
        });

        const allyMap: Record<string, { games: number, wins: number }> = {};
        const groupMaps: Record<number, Record<string, { games: number; wins: number }>> = { 3: {}, 4: {}, 5: {} };

        Object.values(matches).forEach(m => {
          const processTeam = (teamPlayers: string[], isWin: boolean) => {
            // 2人コンビ
            for (let i = 0; i < teamPlayers.length; i++) {
              for (let j = i + 1; j < teamPlayers.length; j++) {
                const pair = [teamPlayers[i], teamPlayers[j]].sort();
                const key = `${pair[0]}::${pair[1]}`;
                if (!allyMap[key]) allyMap[key] = { games: 0, wins: 0 };
                allyMap[key].games++;
                if (isWin) allyMap[key].wins++;
              }
            }
            // 3/4/5人グループ
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
        });

        const allyList: AllyStat[] = Object.entries(allyMap).map(([key, stat]) => {
          const [p1, p2] = key.split('::');
          return { p1, p2, games: stat.games, wins: stat.wins, winRate: stat.wins / stat.games };
        });

        const groupListRes: Record<number, GroupStat[]> = { 3: [], 4: [], 5: [] };
        [3, 4, 5].forEach(k => {
          groupListRes[k] = Object.entries(groupMaps[k]).map(([key, stat]) => ({
            members: key.split('::'),
            games: stat.games,
            wins: stat.wins,
            winRate: stat.wins / stat.games
          }));
        });

        setAllyStats(allyList);
        setGroupStats(groupListRes);
      } catch (err) {
        console.error("Synergy fetchData Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-stone-900">
        <Spinner label="チームシナジーデータを分析中..." />
      </div>
    );
  }

  // 1. 最強のコンビ (勝率降順)
  const bestAlly = allyStats
    .filter(a => a.games >= minGames)
    .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate);

  // 2. 最弱のコンビ (勝率昇順)
  const worstAlly = allyStats
    .filter(a => a.games >= minGames)
    .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate);

  const groupMin = groupSize >= 4 ? Math.min(minGames, 2) : minGames;
  const filteredGroupsBest = (groupStats[groupSize] || [])
    .filter(g => g.games >= groupMin)
    .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate)
    .slice(0, 50);

  const filteredGroupsWorst = (groupStats[groupSize] || [])
    .filter(g => g.games >= groupMin)
    .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate)
    .slice(0, 50);

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-stone-900 flex items-center gap-3">
              <HeartHandshake className="h-8 w-8 text-fuchsia-700" />
              チームシナジー分析
            </h1>
            <p className="text-stone-400 mt-2 text-sm">
              KTMの全試合データから算出された「味方時の勝率」を分析。<br/>
              最強のコンビと最弱のコンビを2〜5人の人数別で一覧化します。
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-2">
            <span className="text-sm font-bold text-stone-400">最小共闘数:</span>
            <select 
              value={minGames} 
              onChange={e => setMinGames(Number(e.target.value))}
              className="bg-black/5 border border-border text-stone-900 rounded px-2 py-1 outline-none focus:border-fuchsia-500 font-bold"
            >
              <option value={2}>2試合以上共闘</option>
              <option value={3}>3試合以上共闘</option>
              <option value={5}>5試合以上共闘</option>
              <option value={10}>10試合以上共闘</option>
            </select>
          </div>
        </div>

        {/* 人数切替タブ (2〜5人選択) */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-surface border border-border p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <Users className="text-fuchsia-700" size={20} />
            <span className="text-sm font-black text-stone-900">対象人数:</span>
          </div>
          <div className="flex gap-2">
            {([2, 3, 4, 5] as const).map(n => (
              <button key={n} onClick={() => setGroupSize(n)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${groupSize === n ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-500/20' : 'bg-background text-stone-400 hover:text-stone-900 border border-border'}`}>
                {n}人コンビ / チーム
              </button>
            ))}
          </div>
        </div>

        {/* メイン: 左右に「最強のコンビ」と「最弱のコンビ」を配置 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* 左カード: 最強のコンビ */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-500"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-emerald-700 flex items-center gap-2">
                <Crown className="h-6 w-6" /> 最強のコンビ <span className="text-xs text-stone-500 font-normal">(Best Combo)</span>
              </h2>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {groupSize > 2 ? (
                filteredGroupsBest.length === 0 ? (
                  <div className="text-center text-stone-500 py-12">この条件で一緒に戦った組み合わせがありません</div>
                ) : (
                  filteredGroupsBest.map((g, i) => (
                    <div key={g.members.join('-')} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-black/5 text-stone-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {g.members.map((m, idx) => (
                            <span key={m} className="font-bold text-stone-900 text-sm">
                              {m}{idx < g.members.length - 1 && <span className="text-stone-500 mx-1">・</span>}
                            </span>
                          ))}
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="text-xl font-black text-emerald-700">
                            {(g.winRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-stone-500 font-bold">{g.games}戦 {g.wins}勝</div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : bestAlly.length === 0 ? (
                <div className="text-center text-stone-500 py-12">該当するデータがありません</div>
              ) : (
                bestAlly.map((stat, i) => (
                  <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${i < 3 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-black/5 text-stone-500'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-900 text-base">{stat.p1}</span>
                        <span className="text-emerald-700 text-xs font-black">🤝</span>
                        <span className="font-bold text-stone-900 text-base">{stat.p2}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="text-2xl font-black text-emerald-700">
                          {(stat.winRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-stone-500 font-bold">
                          {stat.games}戦 {stat.wins}勝
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右カード: 最弱のコンビ */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-pink-600"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-rose-700 flex items-center gap-2">
                <Skull className="h-6 w-6" /> 最弱のコンビ <span className="text-xs text-stone-500 font-normal">(Worst Combo)</span>
              </h2>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {groupSize > 2 ? (
                filteredGroupsWorst.length === 0 ? (
                  <div className="text-center text-stone-500 py-12">この条件で一緒に戦った組み合わせがありません</div>
                ) : (
                  filteredGroupsWorst.map((g, i) => (
                    <div key={g.members.join('-')} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 bg-rose-100 text-rose-700 border border-rose-200">
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {g.members.map((m, idx) => (
                            <span key={m} className="font-bold text-stone-900 text-sm">
                              {m}{idx < g.members.length - 1 && <span className="text-stone-500 mx-1">・</span>}
                            </span>
                          ))}
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="text-xl font-black text-rose-700">
                            {(g.winRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-stone-500 font-bold">{g.games}戦 {g.wins}勝</div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : worstAlly.length === 0 ? (
                <div className="text-center text-stone-500 py-12">該当するデータがありません</div>
              ) : (
                worstAlly.map((stat, i) => (
                  <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black bg-rose-100 text-rose-700 border border-rose-200">
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-900 text-base">{stat.p1}</span>
                        <span className="text-rose-700 text-xs font-black">🤝</span>
                        <span className="font-bold text-stone-900 text-base">{stat.p2}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="text-2xl font-black text-rose-700">
                          {(stat.winRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-stone-500 font-bold">
                          {stat.games}戦 {stat.wins}勝
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
