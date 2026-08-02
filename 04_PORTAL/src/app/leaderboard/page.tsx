'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAllRows } from '../../lib/fetchAll';
import { getKtmRank } from '../../lib/mmr';
import { Spinner } from '../../components/Feedback';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';

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

function getRankBadge(mmr: number) {
  return getKtmRank(mmr);
}

import WinrateMatrixPanel from './WinrateMatrixPanel';
import { Trophy, Activity, Info, RefreshCw } from 'lucide-react';

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData>({
    TOP: [], JG: [], MID: [], ADC: [], SUP: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ranking' | 'winrate' | 'meta'>('ranking');

  // KTM内メタ統計(#80): チャンピオン別のピック数・勝率・平均KDA
  const [metaData, setMetaData] = useState<any[] | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaMinGames, setMetaMinGames] = useState(2);
  useEffect(() => {
    if (activeTab !== 'meta' || metaData !== null || metaLoading) return;
    (async () => {
      setMetaLoading(true);
      try {
        const { data: partData } = await fetchAllRows((from, to) =>
          supabase
            .from('ktm_match_participants')
            .select('match_id, champion_name, team, kills, deaths, assists')
            .range(from, to)
        );
        const { data: matchWins } = await supabase
          .from('ktm_matches')
          .select('id, winning_team');
        const winMap: Record<number, string> = {};
        (matchWins || []).forEach((m: any) => { winMap[m.id] = m.winning_team; });

        const agg: Record<string, { games: number; wins: number; k: number; d: number; a: number }> = {};
        (partData || []).forEach((r: any) => {
          const c = r.champion_name;
          if (!c) return;
          if (!agg[c]) agg[c] = { games: 0, wins: 0, k: 0, d: 0, a: 0 };
          agg[c].games += 1;
          const winningTeam = winMap[r.match_id];
          if (r.team === winningTeam) agg[c].wins += 1;
          agg[c].k += r.kills || 0; agg[c].d += r.deaths || 0; agg[c].a += r.assists || 0;
        });
        const rows = Object.entries(agg).map(([name, s]) => ({
          name,
          games: s.games,
          wins: s.wins,
          winRate: Math.round((s.wins / s.games) * 100),
          avgKda: s.d > 0 ? Math.round(((s.k + s.a) / s.d) * 10) / 10 : Math.round((s.k + s.a) * 10) / 10,
        })).sort((a, b) => b.games - a.games || b.winRate - a.winRate);
        setMetaData(rows);
      } catch (e) {
        console.error('meta stats fetch failed', e);
        setMetaData([]);
      } finally {
        setMetaLoading(false);
      }
    })();
  }, [activeTab, metaData, metaLoading]);
  const [syncing, setSyncing] = useState(false);
  const [minGames, setMinGames] = useState<number>(3); // 最小試合数フィルター（デフォルト3試合）
  const [search, setSearch] = useState(''); // プレイヤー名検索(L-03)

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
      setLoading(true);
      try {
        // 1. ktm_playersから全プレイヤーの現在のMMRとdiscord_idを取得
        const { data: players, error: pError } = await supabase
          .from('ktm_players')
          .select('name, discord_id, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup');

        if (pError || !players) {
          console.error('Failed to fetch players', pError);
          return;
        }

        // 2. ktm_match_participants と ktm_matches から勝敗と試合数を安全に集計
        const { data: matchesData, error: mError } = await fetchAllRows((from, to) =>
          supabase
            .from('ktm_match_participants')
            .select('player_name, discord_id, role, team, match_id')
            .range(from, to)
        );

        const { data: rawMatches, error: rawmError } = await supabase
          .from('ktm_matches')
          .select('id, winning_team');

        if (mError || rawmError) {
          console.error('Failed to fetch match stats:', mError || rawmError);
        }

        const matchWinMap = new Map<number, string>();
        (rawMatches || []).forEach((m: any) => matchWinMap.set(m.id, m.winning_team));

        const byDiscord = new Map<string, any>();
        const byName = new Map<string, any>();
        players.forEach((p: any) => {
          if (p.discord_id) byDiscord.set(p.discord_id, p);
          byName.set(p.name, p);
        });
        const keyOfPlayer = (p: any) => p.discord_id || p.name;

        // 集計用マップ statsMap[playerKey][role] = { games, wins }
        const statsMap: Record<string, Record<string, { games: number; wins: number }>> = {};
        players.forEach((p: any) => {
          statsMap[keyOfPlayer(p)] = {
            TOP: { games: 0, wins: 0 },
            JG: { games: 0, wins: 0 },
            MID: { games: 0, wins: 0 },
            ADC: { games: 0, wins: 0 },
            SUP: { games: 0, wins: 0 }
          };
        });

        if (matchesData) {
          matchesData.forEach((m: any) => {
            const resolved = (m.discord_id && byDiscord.get(m.discord_id)) || byName.get(m.player_name);
            if (!resolved) return;
            const key = keyOfPlayer(resolved);
            const role = (m.role || '').toUpperCase();

            const winningTeam = matchWinMap.get(m.match_id);

            if (statsMap[key] && statsMap[key][role]) {
              statsMap[key][role].games += 1;
              if (m.team === winningTeam) {
                statsMap[key][role].wins += 1;
              }
            }
          });
        }

        // 3. レーンごとにソートしてTOP5を抽出
        const newLeaderboard: LeaderboardData = { TOP: [], JG: [], MID: [], ADC: [], SUP: [] };

        ROLES.forEach(role => {
          const mmrKey = `mmr_${role.toLowerCase()}` as keyof typeof players[0];
          
          const roleRanking = players
            .filter((p: any) => {
              const stats = statsMap[keyOfPlayer(p)]?.[role];
              return stats && stats.games >= minGames;
            })
            .map((p: any) => {
              const stats = statsMap[keyOfPlayer(p)][role];
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
            .sort((a: any, b: any) => b.mmr - a.mmr)
            .slice(0, 5);

          newLeaderboard[role] = roleRanking;
        });

        setData(newLeaderboard);
      } catch (e) {
        console.error("fetchLeaderboard Error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [minGames]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner label="リーダーボードを読み込み中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8 text-stone-800">
      <div className="max-w-7xl mx-auto">
        <div className="relative mb-6">
          <h1 className="text-3xl font-extrabold text-stone-900 text-center tracking-tight flex items-center justify-center gap-3">
            <span className="text-amber-500">🏆</span> KTM LEADERBOARD
          </h1>
          <button
            onClick={handleSyncDiscordNames}
            disabled={syncing}
            className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-stone-900 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? '同期中...' : '名前の一括同期'}</span>
          </button>
        </div>
        
        {/* タブナビゲーション */}
        <div className="flex justify-center mb-10 px-2">
          <div className="inline-flex flex-wrap justify-center gap-1 bg-surface rounded-xl p-1 border border-border max-w-full">
            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'ranking'
                  ? 'bg-amber-600 text-stone-900 shadow-lg'
                  : 'text-stone-400 hover:text-stone-900 hover:bg-black/5'
              }`}
            >
              <Trophy size={16} />
              MMRランキング
            </button>
            <button
              onClick={() => setActiveTab('winrate')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'winrate'
                  ? 'bg-emerald-600 text-stone-900 shadow-lg'
                  : 'text-stone-400 hover:text-stone-900 hover:bg-black/5'
              }`}
            >
              <Activity size={16} />
              レーン別勝率
            </button>
            <button
              onClick={() => setActiveTab('meta')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'meta'
                  ? 'bg-amber-600 text-stone-900 shadow-lg'
                  : 'text-stone-400 hover:text-stone-900 hover:bg-black/5'
              }`}
            >
              🏆 メタ統計
            </button>
          </div>
        </div>

        {activeTab === 'meta' ? (
          /* KTM内メタ統計(#80) */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <p className="text-sm text-stone-400 font-bold">KTMカスタム内のチャンピオン使用状況（ピック数順）</p>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-1.5">
                <span className="text-xs text-stone-400 font-bold">最小試合数:</span>
                <select value={metaMinGames} onChange={(e) => setMetaMinGames(Number(e.target.value))}
                  className="bg-black/5 text-stone-900 text-xs font-bold rounded-lg border border-border px-2 py-1 focus:outline-none">
                  <option value={1}>1+</option><option value={2}>2+</option><option value={3}>3+</option><option value={5}>5+</option>
                </select>
              </div>
            </div>
            {metaLoading || metaData === null ? (
              <Spinner label="メタ統計を集計中..." />
            ) : (
              <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-stone-800">
                {metaData.filter(m => m.games >= metaMinGames).map((m, idx) => (
                  <div key={m.name} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-black/5">
                    <span className="w-5 sm:w-6 text-center text-xs font-black text-stone-500 shrink-0">{idx + 1}</span>
                    <Image src={getChampIcon(m.name)} alt={m.name} width={32} height={32} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="flex-1 min-w-0 font-bold text-stone-900 text-sm truncate">{m.name}</span>
                    <span className="text-xs text-stone-400 w-9 sm:w-16 text-right shrink-0">{m.games}戦</span>
                    <span className={`text-sm font-black w-10 sm:w-14 text-right shrink-0 ${m.winRate >= 55 ? 'text-emerald-700' : m.winRate <= 45 ? 'text-rose-700' : 'text-stone-800'}`}>{m.winRate}%</span>
                    <span className="hidden sm:block text-xs font-mono text-stone-400 w-20 text-right shrink-0">KDA {m.avgKda}</span>
                  </div>
                ))}
                {metaData.filter(m => m.games >= metaMinGames).length === 0 && (
                  <p className="text-center text-stone-500 text-sm py-10">条件に合うチャンピオンがいません</p>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'winrate' ? (
          <WinrateMatrixPanel />
        ) : (
          <>
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 mb-8 flex items-start gap-3 max-w-3xl mx-auto">
              <Info className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-bold text-amber-700 mb-1">ランキングの集計仕様について</p>
                <p>このリーダーボードは現在の「希望レーン」ではなく、<strong>過去の試合でそのレーンを担当した実績</strong>に基づいて自動集計されています。試合数フィルターを使用することで、未出場者や出場回数の少ないプレイヤーを除外できます。</p>
              </div>
            </div>

            {/* 試合数フィルター・検索コントロール */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2">
                <span className="text-xs text-stone-400 font-bold">表示する最小試合数:</span>
                <select
                  value={minGames}
                  onChange={(e) => setMinGames(Number(e.target.value))}
                  className="bg-black/5 text-stone-900 text-xs font-bold rounded-lg border border-border px-2 py-1 focus:outline-none focus:border-amber-500"
                >
                  <option value={0}>制限なし (全登録者)</option>
                  <option value={1}>1試合以上</option>
                  <option value={3}>3試合以上 (デフォルト)</option>
                  <option value={5}>5試合以上</option>
                  <option value={10}>10試合以上</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2">
                <span className="text-xs text-stone-400 font-bold">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="プレイヤー名で検索"
                  className="bg-black/5 text-stone-900 text-xs font-bold rounded-lg border border-border px-2 py-1 focus:outline-none focus:border-amber-500 w-40"
                />
                {search && <button onClick={() => setSearch('')} className="text-stone-500 hover:text-stone-900 text-xs">✕</button>}
              </div>
            </div>

            <p className="text-center text-stone-400 mb-6 font-bold">各レーンのMMR TOP 5</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {ROLES.map(role => {
                const rows = (data[role] || []).filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
                return (
                <div key={role} className="bg-surface rounded-2xl shadow-xl border border-border overflow-hidden">
                  <div className="bg-black/5 px-4 py-3 border-b border-border">
                    <h2 className="text-lg font-bold text-stone-900 text-center flex items-center justify-center gap-2">
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
                  
                  <div className="divide-y divide-stone-800">
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-stone-500 text-sm">
                        {search ? '該当なし' : 'データがありません'}
                      </div>
                    ) : (
                      rows.map((player, idx) => (
                        <div key={player.name} className="p-4 hover:bg-black/5 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                              ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 
                                idx === 1 ? 'bg-stone-300 text-stone-800' : 
                                idx === 2 ? 'bg-amber-600 text-amber-50' : 
                                'bg-black/5 text-stone-400'}`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <a href={`/player/${player.discordId}`} className="font-bold text-stone-900 hover:text-amber-700 truncate block transition" title={`${player.name} の詳細を見る`}>
                                {player.name}
                              </a>
                              <div className="text-[10px] text-stone-400">
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
                            <div className="text-sm font-bold text-stone-800">
                              {player.mmr.toLocaleString()} <span className="text-[10px] font-normal text-stone-500">MMR</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
