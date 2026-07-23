'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getKtmRank } from '../../lib/mmr';
import { Spinner } from '../../components/Feedback';
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
import { Trophy, Activity, Info, RefreshCw, Award } from 'lucide-react';

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData>({
    TOP: [], JG: [], MID: [], ADC: [], SUP: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ranking' | 'winrate' | 'meta' | 'identity'>('ranking');

  // 激レアアイデンティティランキング
  const [identityRanking, setIdentityRanking] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/identity-ranking')
      .then(r => r.json())
      .then(data => { if (data.ranking) setIdentityRanking(data.ranking); })
      .catch(e => console.warn('Failed to fetch identity ranking:', e));
  }, []);

  // KTM内メタ統計(#80): チャンピオン別のピック数・勝率・平均KDA
  const [metaData, setMetaData] = useState<any[] | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaMinGames, setMetaMinGames] = useState(2);
  useEffect(() => {
    if (activeTab !== 'meta' || metaData !== null || metaLoading) return;
    (async () => {
      setMetaLoading(true);
      try {
        const { data } = await supabase
          .from('ktm_match_participants')
          .select('champion_name, team, kills, deaths, assists, ktm_matches ( winning_team )');
        const agg: Record<string, { games: number; wins: number; k: number; d: number; a: number }> = {};
        (data || []).forEach((r: any) => {
          const c = r.champion_name;
          if (!c) return;
          if (!agg[c]) agg[c] = { games: 0, wins: 0, k: 0, d: 0, a: 0 };
          agg[c].games += 1;
          if (r.team === r.ktm_matches?.winning_team) agg[c].wins += 1;
          agg[c].k += r.kills || 0; agg[c].d += r.deaths || 0; agg[c].a += r.assists || 0;
        });
        const rows = Object.entries(agg).map(([name, s]) => ({
          name,
          games: s.games,
          wins: s.wins,
          winRate: Math.round((s.wins / s.games) * 100),
          avgKda: s.d > 0 ? Math.round(((s.k + s.a) / s.d) * 10) / 10 : (s.k + s.a),
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
          discord_id,
          role,
          team,
          ktm_matches ( winning_team )
        `);

      if (mError) {
        console.error('Failed to fetch match stats', mError);
      }

      // MMRが discord_id 基準で集計されているので、戦績(Games/勝率)も discord_id 基準に揃える。
      // 名前ベースのままだと、改名した人の表示戦績とMMRが食い違う。
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
          // 参加者行を discord_id 優先で解決し、その選手のバケツに集計
          const resolved = (m.discord_id && byDiscord.get(m.discord_id)) || byName.get(m.player_name);
          if (!resolved) return;
          const key = keyOfPlayer(resolved);
          const role = m.role as string;
          const winningTeam = m.ktm_matches?.winning_team;
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
            // 仕様: 指定した最小試合数以上の出場実績があるプレイヤーのみ表示
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
          .sort((a: any, b: any) => b.mmr - a.mmr); // MMR降順

        newLeaderboard[role] = roleRanking;
      });

      setData(newLeaderboard);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [minGames]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <Spinner label="リーダーボードを読み込み中..." />
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
            <button
              onClick={() => setActiveTab('identity')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'identity'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Award size={16} />
              🎖️ 激レア称号
            </button>
          </div>
        </div>

        {activeTab === 'identity' ? (
          /* 🏆 激レア称号 (アイデンティティ) ランキングタブ */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <div>
                <h2 className="text-xl font-black text-amber-400 flex items-center gap-2">
                  <Award size={24} className="text-amber-400" /> メンバー別・激レアアイデンティティ ランキング
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Riot Games 公式 Challengers API から、全日本サーバーにおけるパーセンタイル（上位%）が最も高い激レア称号・実績を順位付けしています。
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
                Riot API リアルタイム連動
              </span>
            </div>

            {identityRanking && identityRanking.length > 0 ? (
              <div className="space-y-4">
                {identityRanking.map((item: any, idx: number) => {
                  const rank = idx + 1;
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;

                  return (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-center gap-6 ${
                        isGold
                          ? 'bg-gradient-to-r from-amber-500/20 via-black/80 to-amber-950/30 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)] scale-[1.02]'
                          : isSilver
                          ? 'bg-gradient-to-r from-slate-400/15 via-black/80 to-slate-900/30 border-slate-400/40 shadow-lg'
                          : isBronze
                          ? 'bg-gradient-to-r from-amber-700/15 via-black/80 to-amber-950/20 border-amber-700/40 shadow-md'
                          : 'bg-gray-900/90 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {/* 順位バッジ ＆ プレイヤー名 */}
                      <div className="flex flex-col items-center justify-center p-3 rounded-xl min-w-[130px] text-center bg-black/40 border border-white/5">
                        <span className="text-3xl font-black mb-0.5">
                          {isGold ? '🥇 1位' : isSilver ? '🥈 2位' : isBronze ? '🥉 3位' : `${rank}位`}
                        </span>
                        <span className={`text-base font-extrabold ${isGold ? 'text-amber-300' : isSilver ? 'text-slate-200' : isBronze ? 'text-amber-600' : 'text-white'}`}>
                          {item.player_name}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400/90 mt-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          {item.percentile_display}
                        </span>
                      </div>

                      {/* 称号＆詳細説明 */}
                      <div className="flex-1 space-y-2 text-left">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xl font-black text-white tracking-wide">{item.title}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded font-black border ${
                            item.level === 'CHALLENGER' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            item.level === 'GRANDMASTER' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                            item.level === 'MASTER' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                            'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          }`}>
                            {item.level}
                          </span>

                          {/* 🎖️ 全国順位バッジ */}
                          {item.national_rank_display && (
                            <span className="text-xs px-3 py-0.5 rounded-full bg-gradient-to-r from-red-500/20 to-amber-500/20 text-amber-300 border border-amber-500/40 font-black flex items-center gap-1 shadow-sm">
                              🎯 {item.national_rank_display}
                            </span>
                          )}

                          {/* 📊 達成数値/スコアバッジ */}
                          {item.value_display !== undefined && item.value_display !== null && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                              記録: {item.value_display}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed font-medium">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono pt-0.5">
                          <span>全日本サーバー上位 <strong className="text-amber-400 font-extrabold">{item.percentile_display}</strong></span>
                          {item.national_rank_display && (
                            <span className="text-gray-500">| {item.national_rank_display}</span>
                          )}
                        </div>

                        {/* 所持しているその他の激レア称号（サブバッジ一覧） */}
                        {item.sub_identities && item.sub_identities.length > 0 && (
                          <div className="pt-2 border-t border-white/5 mt-2">
                            <span className="text-[10px] text-gray-400 font-bold block mb-1">🎖️ このプレイヤーの他の激レア実績:</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.sub_identities.map((sub: any, subIdx: number) => (
                                <span
                                  key={subIdx}
                                  className="text-[10px] px-2 py-0.5 rounded bg-gray-800/80 border border-gray-700 text-gray-300 font-medium flex items-center gap-1"
                                  title={`${sub.description} (${sub.national_rank_display})`}
                                >
                                  <span className="text-amber-400 font-bold">・{sub.name}</span>
                                  <span className="text-gray-400 text-[9px]">({sub.top_percent_display})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
                <Spinner label="激レアアイデンティティを取得中..." />
              </div>
            )}
          </div>
        ) : activeTab === 'meta' ? (
          /* KTM内メタ統計(#80) */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <p className="text-sm text-gray-400 font-bold">KTMカスタム内のチャンピオン使用状況（ピック数順）</p>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5">
                <span className="text-xs text-gray-400 font-bold">最小試合数:</span>
                <select value={metaMinGames} onChange={(e) => setMetaMinGames(Number(e.target.value))}
                  className="bg-gray-800 text-white text-xs font-bold rounded-lg border border-gray-700 px-2 py-1 focus:outline-none">
                  <option value={1}>1+</option><option value={2}>2+</option><option value={3}>3+</option><option value={5}>5+</option>
                </select>
              </div>
            </div>
            {metaLoading || metaData === null ? (
              <Spinner label="メタ統計を集計中..." />
            ) : (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
                {metaData.filter(m => m.games >= metaMinGames).map((m, idx) => (
                  <div key={m.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/40">
                    <span className="w-6 text-center text-xs font-black text-gray-500">{idx + 1}</span>
                    <img src={getChampIcon(m.name)} alt={m.name} className="w-8 h-8 rounded-full border border-gray-700"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="flex-1 font-bold text-white text-sm truncate">{m.name}</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{m.games}戦</span>
                    <span className={`text-sm font-black w-14 text-right ${m.winRate >= 55 ? 'text-emerald-400' : m.winRate <= 45 ? 'text-rose-400' : 'text-gray-200'}`}>{m.winRate}%</span>
                    <span className="text-xs font-mono text-gray-400 w-20 text-right">KDA {m.avgKda}</span>
                  </div>
                ))}
                {metaData.filter(m => m.games >= metaMinGames).length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-10">条件に合うチャンピオンがいません</p>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'winrate' ? (
          <WinrateMatrixPanel />
        ) : (
          <>
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-8 flex items-start gap-3 max-w-3xl mx-auto">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-bold text-blue-300 mb-1">ランキングの集計仕様について</p>
                <p>このリーダーボードは現在の「希望レーン」ではなく、<strong>過去の試合でそのレーンを担当した実績</strong>に基づいて自動集計されています。試合数フィルターを使用することで、未出場者や出場回数の少ないプレイヤーを除外できます。</p>
              </div>
            </div>

            {/* 試合数フィルター・検索コントロール */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
                <span className="text-xs text-gray-400 font-bold">表示する最小試合数:</span>
                <select
                  value={minGames}
                  onChange={(e) => setMinGames(Number(e.target.value))}
                  className="bg-gray-800 text-white text-xs font-bold rounded-lg border border-gray-700 px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  <option value={0}>制限なし (全登録者)</option>
                  <option value={1}>1試合以上</option>
                  <option value={3}>3試合以上 (デフォルト)</option>
                  <option value={5}>5試合以上</option>
                  <option value={10}>10試合以上</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
                <span className="text-xs text-gray-400 font-bold">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="プレイヤー名で検索"
                  className="bg-gray-800 text-white text-xs font-bold rounded-lg border border-gray-700 px-2 py-1 focus:outline-none focus:border-blue-500 w-40"
                />
                {search && <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white text-xs">✕</button>}
              </div>
            </div>

            <p className="text-center text-gray-400 mb-6 font-bold">各レーンのMMR TOP 5</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {ROLES.map(role => {
                const rows = (data[role] || []).filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
                return (
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
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm">
                        {search ? '該当なし' : 'データがありません'}
                      </div>
                    ) : (
                      rows.map((player, idx) => (
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
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
