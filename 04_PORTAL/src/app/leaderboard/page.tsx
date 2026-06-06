'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ==========================================
// Types
// ==========================================
type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

interface PlayerStats {
  name: string;
  discordId: string;
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
  { name: 'CHALLENGER', min: 2000, color: 'text-sky-300', bg: 'bg-sky-300/10' },
  { name: 'GRANDMASTER', min: 1900, color: 'text-red-500', bg: 'bg-red-500/10' },
  { name: 'MASTER', min: 1850, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'DIAMOND I', min: 1840, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND II', min: 1825, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND III', min: 1810, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND IV', min: 1800, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'EMERALD I', min: 1760, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD II', min: 1720, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD III', min: 1680, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD IV', min: 1650, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'PLATINUM I', min: 1600, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM II', min: 1560, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM III', min: 1530, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM IV', min: 1500, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'GOLD I', min: 1460, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD II', min: 1420, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD III', min: 1380, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD IV', min: 1350, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'SILVER I', min: 1310, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER II', min: 1270, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER III', min: 1230, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER IV', min: 1200, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'BRONZE I', min: 1160, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE II', min: 1120, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE III', min: 1080, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE IV', min: 1050, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'IRON I', min: 1010, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON II', min: 970, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON III', min: 930, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON IV', min: 900, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'UNRANKED', min: 0, color: 'text-gray-400', bg: 'bg-gray-800' },
];

function getRankBadge(mmr: number) {
  for (const tier of KTM_TIERS) {
    if (mmr >= tier.min) {
      return { name: tier.name, color: tier.color, bg: tier.bg };
    }
  }
  return { name: 'UNRANKED', color: 'text-gray-400', bg: 'bg-gray-800' };
}

import WinrateMatrixPanel from './WinrateMatrixPanel';
import { Trophy, Activity, Info, RefreshCw } from 'lucide-react';

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData>({
    TOP: [], JG: [], MID: [], ADC: [], SUP: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ranking' | 'winrate'>('ranking');
  const [syncing, setSyncing] = useState(false);

  const handleSyncDiscordNames = async () => {
    if (!confirm('全プレイヤーのDiscord名を最新のものに一括同期しますか？少し時間がかかります。')) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/discord/sync?_t=${Date.now()}`, { cache: 'no-store' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '同期に失敗しました');
      alert(`✅ ${result.syncedCount}人の名前を最新のDiscord名に更新しました！\nページを再読み込みして反映します。`);
      window.location.reload();
    } catch (err: any) {
      alert('エラー: ' + err.message);
      setSyncing(false);
    }
  };

  useEffect(() => {
    async function fetchLeaderboard() {
      // 1. ktm_playersから全プレイヤーの現在のMMRとdiscord_idを取得
      const { data: players, error: pError } = await supabase
        .from('ktm_players')
        .select('name, discord_id, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup');

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
        const mmrKey = `mmr_${role.toLowerCase()}` as keyof typeof players[0];
        
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
              discordId: p.discord_id,
              mmr,
              games: stats.games,
              winRate,
              rankBadge: getRankBadge(mmr)
            };
          })
          .sort((a, b) => b.mmr - a.mmr); // MMR降順

        newLeaderboard[role] = roleRanking;
      });

      setData(newLeaderboard);
      setLoading(false);
    }

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4 sm:px-6 lg:px-8 text-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="relative mb-6">
          <h1 className="text-3xl font-extrabold text-white text-center tracking-tight flex items-center justify-center gap-3">
            <span className="text-blue-500">🏆</span> KTM LEADERBOARD
          </h1>
          <button
            onClick={handleSyncDiscordNames}
            disabled={syncing}
            className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? '同期中...' : '名前の一括同期'}</span>
          </button>
        </div>
        
        {/* タブナビゲーション */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-gray-900 rounded-xl p-1 border border-gray-800">
            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ranking'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Trophy size={16} />
              MMRランキング
            </button>
            <button
              onClick={() => setActiveTab('winrate')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'winrate'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Activity size={16} />
              レーン別勝率
            </button>
          </div>
        </div>

        {activeTab === 'winrate' ? (
          <WinrateMatrixPanel />
        ) : (
          <>
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-8 flex items-start gap-3 max-w-3xl mx-auto">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-bold text-blue-300 mb-1">ランキングの集計仕様について</p>
                <p>このリーダーボードは現在の「希望レーン」ではなく、<strong>過去の試合でそのレーンを担当して1勝以上した実績</strong>に基づいて自動集計されています。レーン変更後も過去の戦績は残り続けます。</p>
              </div>
            </div>

            <p className="text-center text-gray-400 mb-6 font-bold">各レーンのMMR TOP 5</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {ROLES.map(role => (
                <div key={role} className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden">
                  <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
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
                  
                  <div className="divide-y divide-gray-800">
                    {data[role].length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm">
                        データがありません
                      </div>
                    ) : (
                      data[role].map((player, idx) => (
                        <div key={player.name} className="p-4 hover:bg-gray-800/50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                              ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 
                                idx === 1 ? 'bg-gray-300 text-gray-800' : 
                                idx === 2 ? 'bg-amber-600 text-amber-50' : 
                                'bg-gray-800 text-gray-400'}`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <a href={`/player/${player.discordId}`} className="font-bold text-white hover:text-blue-400 truncate block transition" title={`${player.name} の詳細を見る`}>
                                {player.name}
                              </a>
                              <div className="text-[10px] text-gray-400">
                                {player.games} Games ({player.winRate}%)
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div 
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border border-current/20 inline-block whitespace-nowrap mb-1 ${player.rankBadge.bg} ${player.rankBadge.color}`}
                            >
                              {player.rankBadge.name}
                            </div>
                            <div className="text-sm font-bold text-gray-200">
                              {player.mmr.toLocaleString()} <span className="text-[10px] font-normal text-gray-500">MMR</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
