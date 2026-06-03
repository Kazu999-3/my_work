'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ==========================================
// Types
// ==========================================
type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

interface PlayerStats {
  name: string;
  mmr: number;
  games: number;
  winRate: string;
  rankBadge: { name: string; color: string; bg: string };
}

interface LeaderboardData {
  TOP: PlayerStats[];
  JG: PlayerStats[];
  MID: PlayerStats[];
  ADC: PlayerStats[];
  SUP: PlayerStats[];
}

// ランク判定ヘルパー (Phase 1 互換)
const KTM_TIERS = [
  { name: 'CHALLENGER', min: 15001, color: '#eab308', bg: '#fef08a' }, // Gold風
  { name: 'GRANDMASTER', min: 10001, color: '#eab308', bg: '#fef08a' },
  { name: 'MASTER', min: 7501, color: '#a855f7', bg: '#f3e8ff' }, // Purple
  { name: 'DIAMOND I', min: 7051, color: '#3b82f6', bg: '#dbeafe' }, // Blue
  { name: 'DIAMOND II', min: 6601, color: '#3b82f6', bg: '#dbeafe' },
  { name: 'DIAMOND III', min: 6151, color: '#3b82f6', bg: '#dbeafe' },
  { name: 'DIAMOND IV', min: 5701, color: '#3b82f6', bg: '#dbeafe' },
  { name: 'EMERALD I', min: 5351, color: '#10b981', bg: '#d1fae5' }, // Green
  { name: 'EMERALD II', min: 5001, color: '#10b981', bg: '#d1fae5' },
  { name: 'EMERALD III', min: 4651, color: '#10b981', bg: '#d1fae5' },
  { name: 'EMERALD IV', min: 4301, color: '#10b981', bg: '#d1fae5' },
  { name: 'PLATINUM I', min: 4026, color: '#0B5394', bg: '#CFE2F3' },
  { name: 'PLATINUM II', min: 3751, color: '#0B5394', bg: '#CFE2F3' },
  { name: 'PLATINUM III', min: 3476, color: '#0B5394', bg: '#CFE2F3' },
  { name: 'PLATINUM IV', min: 3201, color: '#0B5394', bg: '#CFE2F3' },
  { name: 'GOLD I', min: 2976, color: '#BF9000', bg: '#FFF2CC' },
  { name: 'GOLD II', min: 2751, color: '#BF9000', bg: '#FFF2CC' },
  { name: 'GOLD III', min: 2526, color: '#BF9000', bg: '#FFF2CC' },
  { name: 'GOLD IV', min: 2301, color: '#BF9000', bg: '#FFF2CC' },
  { name: 'SILVER I', min: 2126, color: '#666666', bg: '#EFEFEF' },
  { name: 'SILVER II', min: 1951, color: '#666666', bg: '#EFEFEF' },
  { name: 'SILVER III', min: 1776, color: '#666666', bg: '#EFEFEF' },
  { name: 'SILVER IV', min: 1601, color: '#666666', bg: '#EFEFEF' },
  { name: 'BRONZE I', min: 1451, color: '#783F04', bg: '#F9CB9C' },
  { name: 'BRONZE II', min: 1301, color: '#783F04', bg: '#F9CB9C' },
  { name: 'BRONZE III', min: 1151, color: '#783F04', bg: '#F9CB9C' },
  { name: 'BRONZE IV', min: 1001, color: '#783F04', bg: '#F9CB9C' },
  { name: 'IRON I', min: 876, color: '#434343', bg: '#D9D9D9' },
  { name: 'IRON II', min: 751, color: '#434343', bg: '#D9D9D9' },
  { name: 'IRON III', min: 626, color: '#434343', bg: '#D9D9D9' },
  { name: 'IRON IV', min: 501, color: '#434343', bg: '#D9D9D9' },
  { name: 'UNRANKED', min: 0, color: '#999999', bg: '#F3F4F6' },
];

function getRankBadge(mmr: number) {
  for (const tier of KTM_TIERS) {
    if (mmr >= tier.min) {
      return { name: tier.name, color: tier.color, bg: tier.bg };
    }
  }
  return { name: 'UNRANKED', color: '#999999', bg: '#F3F4F6' };
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData>({
    TOP: [], JG: [], MID: [], ADC: [], SUP: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      // 1. ktm_playersから全プレイヤーの現在のMMRを取得
      const { data: players, error: pError } = await supabase
        .from('ktm_players')
        .select('name, top_mmr, jg_mmr, mid_mmr, adc_mmr, sup_mmr');

      if (pError || !players) {
        console.error('Failed to fetch players', pError);
        setLoading(false);
        return;
      }

      // 2. ktm_match_participantsから勝敗と試合数を集計
      // 試合結果を ktm_matches と JOIN して取得する
      const { data: matchesData, error: mError } = await supabase
        .from('ktm_match_participants')
        .select(`
          player_name,
          role,
          team,
          ktm_matches ( winning_team )
        `);

      if (mError) {
        console.error('Failed to fetch match stats', mError);
      }

      // 集計用マップ
      // statsMap[playerName][role] = { games: 0, wins: 0 }
      const statsMap: Record<string, Record<string, { games: number; wins: number }>> = {};
      players.forEach(p => {
        statsMap[p.name] = {
          TOP: { games: 0, wins: 0 },
          JG: { games: 0, wins: 0 },
          MID: { games: 0, wins: 0 },
          ADC: { games: 0, wins: 0 },
          SUP: { games: 0, wins: 0 }
        };
      });

      if (matchesData) {
        matchesData.forEach((m: any) => {
          const pName = m.player_name;
          const role = m.role as string;
          const team = m.team;
          const winningTeam = m.ktm_matches?.winning_team;

          if (statsMap[pName] && statsMap[pName][role]) {
            statsMap[pName][role].games += 1;
            if (team === winningTeam) {
              statsMap[pName][role].wins += 1;
            }
          }
        });
      }

      // 3. レーンごとにソートしてTOP5を抽出
      const newLeaderboard: LeaderboardData = { TOP: [], JG: [], MID: [], ADC: [], SUP: [] };

      ROLES.forEach(role => {
        const mmrKey = `${role.toLowerCase()}_mmr` as keyof typeof players[0];
        
        const roleRanking = players
          .filter(p => {
            const stats = statsMap[p.name]?.[role];
            // 仕様: そのレーンでの勝利数が0より大きい（つまり1勝以上している）プレイヤーのみ表示
            return stats && stats.wins > 0;
          })
          .map(p => {
            const stats = statsMap[p.name][role];
            const mmr = Number(p[mmrKey] || 1200);
            const winRate = stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : '0.0';
            return {
              name: p.name,
              mmr,
              games: stats.games,
              winRate,
              rankBadge: getRankBadge(mmr)
            };
          })
          .sort((a, b) => b.mmr - a.mmr) // MMR降順
          .slice(0, 5); // TOP5

        newLeaderboard[role] = roleRanking;
      });

      setData(newLeaderboard);
      setLoading(false);
    }

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-10 tracking-tight">
          🏆 KTM LEADERBOARD
        </h1>
        <p className="text-center text-gray-500 mb-12">各レーンのMMR TOP 5 (※1勝以上が条件)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {ROLES.map(role => (
            <div key={role} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white text-center flex items-center justify-center gap-2">
                  <span className="text-xl">
                    {role === 'TOP' && '🪓'}
                    {role === 'JG' && '🌲'}
                    {role === 'MID' && '🔥'}
                    {role === 'ADC' && '🏹'}
                    {role === 'SUP' && '🛡️'}
                  </span>
                  {role}
                </h2>
              </div>
              
              <div className="divide-y divide-gray-100">
                {data[role].length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    データがありません
                  </div>
                ) : (
                  data[role].map((player, idx) => (
                    <div key={player.name} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold
                          ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 
                            idx === 1 ? 'bg-gray-300 text-gray-800' : 
                            idx === 2 ? 'bg-amber-600 text-amber-50' : 
                            'text-gray-400'}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 truncate max-w-[100px]" title={player.name}>
                            {player.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {player.games} Games ({player.winRate}%)
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div 
                          className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm inline-block whitespace-nowrap mb-1"
                          style={{ backgroundColor: player.rankBadge.bg, color: player.rankBadge.color }}
                        >
                          {player.rankBadge.name}
                        </div>
                        <div className="text-sm font-bold text-gray-700">
                          {player.mmr.toLocaleString()} <span className="text-xs font-normal text-gray-400">MMR</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
