'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Link from 'next/link';
import { Trophy, Swords, Zap, Activity, ShieldAlert, Award, Compass, RefreshCw, ChevronLeft } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';

// ==========================================
// Types
// ==========================================
interface PlayerInfo {
  name: string;
  discord_id: string;
  lol_ign: string;
  main_lane: string;
  sub_lane: string;
  pity: number;
  top_mmr: number;
  jg_mmr: number;
  mid_mmr: number;
  adc_mmr: number;
  sup_mmr: number;
  is_active: boolean;
}

interface MatchHistory {
  id: string;
  match_id: string;
  role: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  kda_score: number;
  mmr_delta: number;
  created_at: string;
  champion_name: string;
  matches: {
    winning_team: string;
    game_duration: number;
  };
  opponent_champion?: string; // 対面相手のチャンピオン
}

interface NemesisStat {
  championName: string;
  games: number;
  losses: number;
  winRate: number;
}

interface PageProps {
  params: Promise<{ discord_id: string }>;
}

export default function PlayerStatsPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const discordId = unwrappedParams.discord_id;
  
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [nemesisList, setNemesisList] = useState<NemesisStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      if (!discordId) return;

      // 1. プレイヤー情報の取得
      const { data: pData, error: pError } = await supabase
        .from('ktm_players')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (pError || !pData) {
        setError('プレイヤーが見つかりませんでした。');
        setLoading(false);
        return;
      }

      setPlayer(pData);

      // 2. 試合履歴の取得 (直近20試合)
      const { data: hData, error: hError } = await supabase
        .from('ktm_match_participants')
        .select(`
          id, match_id, role, team, kills, deaths, assists, kda_score, mmr_delta, created_at, champion_name,
          ktm_matches ( winning_team, game_duration )
        `)
        .eq('player_name', pData.name)
        .order('created_at', { ascending: false })
        .limit(20);

      if (hError || !hData) {
        setLoading(false);
        return;
      }

      // map mapping
      const mappedHistory: MatchHistory[] = hData.map((item: any) => ({
        id: item.id,
        match_id: item.match_id,
        role: item.role,
        team: item.team,
        kills: item.kills,
        deaths: item.deaths,
        assists: item.assists,
        kda_score: item.kda_score,
        mmr_delta: item.mmr_delta,
        created_at: item.created_at,
        champion_name: item.champion_name || 'Unknown',
        matches: {
          winning_team: item.ktm_matches?.winning_team || '',
          game_duration: item.ktm_matches?.game_duration || 0
        }
      }));

      // 3. 対面チャンピオンの紐付け＆集計
      const matchIds = mappedHistory.map(h => h.match_id);
      if (matchIds.length > 0) {
        const { data: oppData, error: oppError } = await supabase
          .from('ktm_match_participants')
          .select('match_id, role, team, champion_name')
          .in('match_id', matchIds);

        if (!oppError && oppData) {
          // 各対戦履歴行に対面相手のチャンピオンを紐付ける
          mappedHistory.forEach(h => {
            const oppRecord = oppData.find((o: any) => 
              o.match_id === h.match_id && 
              o.role === h.role && 
              o.team !== h.team
            );
            if (oppRecord) {
              h.opponent_champion = oppRecord.champion_name;
            }
          });

          // 苦手対面チャンピオンの集計
          const nemesisMap: Record<string, { games: number; losses: number }> = {};
          mappedHistory.forEach(h => {
            if (!h.opponent_champion || h.opponent_champion === 'Unknown') return;
            const isWin = h.team === h.matches.winning_team;
            
            if (!nemesisMap[h.opponent_champion]) {
              nemesisMap[h.opponent_champion] = { games: 0, losses: 0 };
            }
            nemesisMap[h.opponent_champion].games += 1;
            if (!isWin) {
              nemesisMap[h.opponent_champion].losses += 1;
            }
          });

          // 敗北数が多く、かつ対戦が1回以上あるものを苦手順にソート
          const sortedNemesis: NemesisStat[] = Object.entries(nemesisMap)
            .map(([champ, stat]) => ({
              championName: champ,
              games: stat.games,
              losses: stat.losses,
              winRate: Math.round(((stat.games - stat.losses) / stat.games) * 100)
            }))
            .filter(n => n.losses > 0) // 1回以上負けた相手に限定
            .sort((a, b) => b.losses - a.losses || a.winRate - b.winRate) // 敗北数降順 ➔ 勝率昇順
            .slice(0, 3); // ワースト3

          setNemesisList(sortedNemesis);
        }
      }

      setHistory(mappedHistory);
      setLoading(false);
    }

    fetchStats();
  }, [discordId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#06070a]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#c89b3c] mb-4" />
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">スタッツをスキャン中...</span>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="flex-1 min-h-screen bg-[#06070a] flex flex-col items-center justify-center p-4">
        <div className="glass-panel border border-red-500/20 p-8 rounded-3xl max-w-md w-full text-center space-y-6">
          <div className="text-5xl text-red-500 flex justify-center"><ShieldAlert className="w-12 h-12" /></div>
          <h1 className="text-xl font-extrabold text-white">エラーが発生しました</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{error}</p>
          <Link href="/leaderboard" className="px-6 py-2.5 bg-gray-900 border border-white/10 text-white rounded-xl hover:bg-[#c89b3c] hover:text-black font-bold transition-all text-xs inline-block">
            リーダーボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // 統計データの算出
  // ==========================================
  const totalGames = history.length;
  const wins = history.filter(h => h.team === h.matches.winning_team).length;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const totalKills = history.reduce((sum, h) => sum + h.kills, 0);
  const totalDeaths = history.reduce((sum, h) => sum + h.deaths, 0);
  const totalAssists = history.reduce((sum, h) => sum + h.assists, 0);

  const avgKills = totalGames > 0 ? (totalKills / totalGames).toFixed(1) : '0.0';
  const avgDeaths = totalGames > 0 ? (totalDeaths / totalGames).toFixed(1) : '0.0';
  const avgAssists = totalGames > 0 ? (totalAssists / totalGames).toFixed(1) : '0.0';
  const avgKda = totalDeaths > 0 
    ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) 
    : (totalKills + totalAssists).toFixed(2);

  // 連勝・連敗数 (Streak)
  let streakCount = 0;
  let streakType: 'WIN' | 'LOSS' | null = null;
  if (history.length > 0) {
    const firstIsWin = history[0].team === history[0].matches.winning_team;
    streakType = firstIsWin ? 'WIN' : 'LOSS';
    for (let i = 0; i < history.length; i++) {
      const isWin = history[i].team === history[i].matches.winning_team;
      if (isWin === firstIsWin) {
        streakCount++;
      } else {
        break;
      }
    }
  }

  // モストプレイチャンピオン Top3
  interface ChampStat {
    championName: string;
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
  }
  const champMap: Record<string, ChampStat> = {};
  history.forEach(h => {
    const isWin = h.team === h.matches.winning_team;
    if (!champMap[h.champion_name]) {
      champMap[h.champion_name] = {
        championName: h.champion_name,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0
      };
    }
    const stat = champMap[h.champion_name];
    stat.games += 1;
    if (isWin) stat.wins += 1;
    stat.kills += h.kills;
    stat.deaths += h.deaths;
    stat.assists += h.assists;
  });

  const sortedMostPlayed = Object.values(champMap)
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 3);

  // レーン別の総試合数と勝率を計算（直近20戦の簡易集計）
  const roleStats: Record<string, { games: number; wins: number }> = {
    TOP: { games: 0, wins: 0 },
    JG: { games: 0, wins: 0 },
    MID: { games: 0, wins: 0 },
    ADC: { games: 0, wins: 0 },
    SUP: { games: 0, wins: 0 },
  };

  history.forEach(h => {
    const isWin = h.team === h.matches.winning_team;
    if (roleStats[h.role]) {
      roleStats[h.role].games += 1;
      if (isWin) roleStats[h.role].wins += 1;
    }
  });

  function getKdaColor(kdaVal: number): string {
    if (kdaVal >= 4.5) return 'text-[#c89b3c] drop-shadow-[0_0_8px_rgba(200,155,60,0.5)]'; // レジェンダリーゴールド
    if (kdaVal >= 3.5) return 'text-[#a855f7] drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'; // エピックパープル
    if (kdaVal >= 2.5) return 'text-[#3b82f6]'; // レアブルー
    return 'text-gray-400';
  }

  return (
    <div className="flex-1 min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#0f111a] via-[#06070a] to-[#010204] text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ナビゲーション */}
        <div className="flex justify-between items-center">
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>リーダーボードへ戻る</span>
          </Link>
        </div>

        {/* ヘッダー・プロフィール */}
        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden relative shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="h-28 bg-gradient-to-r from-blue-600/20 via-[#c89b3c]/15 to-purple-600/20 relative">
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
          <div className="px-6 sm:px-10 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-12 sm:-mt-10 gap-6 mb-6">
              <div className="w-24 h-24 bg-[#161922] p-1 rounded-2xl border border-white/10 shadow-lg flex-shrink-0 flex items-center justify-center text-4xl">
                👤
              </div>
              <div className="text-center sm:text-left flex-grow space-y-1">
                <h1 className="text-3xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                  <span>{player.name}</span>
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <span className="bg-black/60 border border-white/10 text-[#c89b3c] px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider">
                    {player.lol_ign || 'IGN未登録'}
                  </span>
                  {player.is_active ? (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">Active</span>
                  ) : (
                    <span className="text-[10px] font-black text-gray-400 bg-white/5 px-2.5 py-0.5 rounded border border-white/10 uppercase tracking-widest">Inactive</span>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/5 text-center">
                  <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">メイン希望</div>
                  <div className="font-bold text-[#c89b3c] text-sm">{player.main_lane}</div>
                </div>
                <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/5 text-center">
                  <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">サブ希望</div>
                  <div className="font-bold text-gray-300 text-sm">{player.sub_lane || '-'}</div>
                </div>
                <div className="bg-orange-500/10 px-4 py-2 rounded-2xl border border-orange-500/20 text-center">
                  <div className="text-[10px] text-orange-400 font-bold mb-1 uppercase tracking-wider">不運度 PITY</div>
                  <div className="font-bold text-orange-400 text-sm">{player.pity}</div>
                </div>
              </div>
            </div>

            {/* MMR 一覧 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-white/5 pt-6">
              {[
                { role: 'TOP', icon: '🛡️', mmr: player.top_mmr },
                { role: 'JG', icon: '⚔️', mmr: player.jg_mmr },
                { role: 'MID', icon: '🧙', mmr: player.mid_mmr },
                { role: 'ADC', icon: '🏹', mmr: player.adc_mmr },
                { role: 'SUP', icon: '🩹', mmr: player.sup_mmr },
              ].map(r => (
                <div key={r.role} className="bg-black/30 border border-white/5 rounded-2xl p-4 text-center space-y-1">
                  <div className="text-xs font-bold text-gray-400 mb-1 flex justify-center items-center gap-1.5">
                    <span>{r.icon}</span> {r.role}
                  </div>
                  <div className="text-2xl font-black text-white">{r.mmr.toLocaleString()}</div>
                  {roleStats[r.role].games > 0 && (
                    <div className="text-[10px] text-gray-500 font-mono">
                      {roleStats[r.role].games}戦 Win:{Math.round((roleStats[r.role].wins / roleStats[r.role].games) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 【NEW】直近20戦 総合戦績サマリーパネル */}
        <div className="glass-panel border border-white/10 rounded-3xl p-6 shadow-xl space-y-5 bg-gradient-to-r from-white/[0.01] via-transparent to-white/[0.01]">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Award className="w-4 h-4 text-[#c89b3c]" />
              <span>直近 {totalGames} 試合の総合スタッツ</span>
            </h2>
            {streakCount > 0 && streakType && (
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wider animate-pulse ${
                streakType === 'WIN' 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              }`}>
                🔥 {streakCount} {streakType === 'WIN' ? '連勝中' : '連敗中'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* 勝率円形サマリー */}
            <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/5"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={winRate >= 50 ? 'text-blue-500' : 'text-red-500'}
                    strokeDasharray={`${winRate}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute font-mono font-black text-sm text-white">{winRate}%</div>
              </div>
              <div>
                <div className="text-xl font-black text-white">{wins}勝 {losses}敗</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">勝敗比率 (Winrate)</div>
              </div>
            </div>

            {/* 平均KDA */}
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-1">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">平均KDAスコア</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono ${getKdaColor(parseFloat(avgKda))}`}>
                  {avgKda}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  ({avgKills} / <span className="text-red-400">{avgDeaths}</span> / {avgAssists})
                </span>
              </div>
            </div>

            {/* 勝敗傾向ドット */}
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-2">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">直近の勝敗トレンド</div>
              <div className="flex flex-wrap gap-1.5">
                {history.slice(0, 20).reverse().map((h, i) => {
                  const isWin = h.team === h.matches.winning_team;
                  return (
                    <div
                      key={h.id || i}
                      className={`w-3.5 h-3.5 rounded border transition-all duration-300 ${
                        isWin 
                          ? 'bg-blue-500 border-blue-400/50 shadow-[0_0_8px_rgba(59,130,246,0.6)]' 
                          : 'bg-red-600 border-red-500/50 shadow-[0_0_8px_rgba(220,38,38,0.6)]'
                      }`}
                      title={isWin ? 'WIN' : 'LOSS'}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 下部 2カラムレイアウト */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* 左カラム: 苦手チャンピオン ＆ モストプレイチャンピオン */}
          <div className="md:col-span-1 space-y-6">
            
            {/* 使用チャンピオン Top3 */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-[#c89b3c] uppercase tracking-widest flex items-center gap-2 px-1">
                <Compass className="w-4 h-4" />
                <span>得意チャンピオンプール (モスト3)</span>
              </h2>
              <div className="glass-panel border border-white/10 rounded-3xl p-5 space-y-4 shadow-lg bg-gradient-to-b from-white/[0.02] to-transparent">
                {sortedMostPlayed.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs">使用したチャンピオンのデータはありません</div>
                ) : (
                  <div className="space-y-3">
                    {sortedMostPlayed.map((c, i) => {
                      const cWinRate = Math.round((c.wins / c.games) * 100);
                      const cAvgKills = (c.kills / c.games).toFixed(1);
                      const cAvgDeaths = (c.deaths / c.games).toFixed(1);
                      const cAvgAssists = (c.assists / c.games).toFixed(1);
                      const cKda = c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : (c.kills + c.assists).toFixed(2);
                      return (
                        <div key={c.championName} className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-2xl p-3 relative overflow-hidden group">
                          {/* チャンピオンアイコン */}
                          <img 
                            src={getChampIcon(c.championName)} 
                            alt={c.championName}
                            className="w-10 h-10 rounded-xl border border-white/10 shrink-0"
                          />
                          <div className="space-y-1 flex-grow">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-xs text-white">{c.championName}</span>
                              <span className="text-[9px] text-gray-500 font-mono">{c.games}戦</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-mono">
                              <span className={cWinRate >= 60 ? 'text-emerald-400 font-bold' : cWinRate <= 40 ? 'text-rose-400' : 'text-amber-400'}>
                                勝率 {cWinRate}%
                              </span>
                              <span className={getKdaColor(parseFloat(cKda))}>
                                KDA {cKda}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 苦手対面チャンピオン */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <ShieldAlert className="w-4 h-4" />
                <span>対面要注意チャンプ (苦手ワースト3)</span>
              </h2>
              <div className="glass-panel border border-white/10 rounded-3xl p-5 space-y-4 shadow-lg bg-gradient-to-b from-white/[0.02] to-transparent">
                {nemesisList.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs">要注意チャンプのデータはありません</div>
                ) : (
                  <div className="space-y-3">
                    {nemesisList.map((n, i) => (
                      <div key={n.championName} className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-2xl p-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-500/10 border-l border-b border-red-500/20 text-[8px] font-black text-red-400 tracking-wider uppercase">
                          worst {i+1}
                        </div>

                        {/* チャンピオンアイコン */}
                        <img 
                          src={getChampIcon(n.championName)} 
                          alt={n.championName}
                          className="w-10 h-10 rounded-xl border border-white/10 shrink-0"
                        />

                        {/* 統計 */}
                        <div className="space-y-0.5 flex-grow">
                          <div className="font-extrabold text-xs text-white">{n.championName}</div>
                          <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono">
                            <span>対面: {n.games}戦 ({n.losses}敗)</span>
                            <span className="font-black text-red-400">勝率: {n.winRate}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右カラム: 試合履歴 */}
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <Swords className="w-4 h-4 text-gray-400" />
              <span>直近の対戦履歴リスト (直近20戦)</span>
            </h2>
            <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-lg divide-y divide-white/5">
              {history.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-xs">試合履歴がありません</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map(h => {
                    const isWin = h.team === h.matches.winning_team;
                    const gameKda = parseFloat(h.kda_score?.toString() || '0');
                    return (
                      <div 
                        key={h.id} 
                        className={`p-4 sm:px-6 transition-all flex items-center justify-between gap-4 border-l-4 ${
                          isWin 
                            ? 'bg-blue-950/[0.04] hover:bg-blue-900/10 border-l-blue-500' 
                            : 'bg-red-950/[0.04] hover:bg-red-900/10 border-l-red-500'
                        }`}
                      >
                        {/* Win/Loss Badge */}
                        <div className="w-14 flex-shrink-0">
                          {isWin ? (
                            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black text-center py-0.5 rounded-lg text-[10px] tracking-widest">WIN</div>
                          ) : (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 font-black text-center py-0.5 rounded-lg text-[10px] tracking-widest">LOSS</div>
                          )}
                        </div>

                        {/* Champion & Role & Opponent */}
                        <div className="flex-grow flex items-center gap-3.5 min-w-0">
                          <img 
                            src={getChampIcon(h.champion_name)} 
                            alt={h.champion_name}
                            className="w-10 h-10 rounded-xl border border-white/5 shrink-0 hidden sm:block shadow-md"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-extrabold text-sm text-white truncate">{h.champion_name}</span>
                              <span className="text-[9px] font-black text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">{h.role}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {h.opponent_champion ? (
                                <span className="flex items-center gap-1">
                                  対面: <span className="font-extrabold text-red-300">{h.opponent_champion}</span>
                                </span>
                              ) : (
                                <span className="text-gray-600">対面情報なし</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* KDA */}
                        <div className="text-center px-4 border-l border-r border-white/5 min-w-[110px] shrink-0">
                          <div className="text-xs font-mono text-gray-300 font-bold mb-0.5 tracking-wide">
                            {h.kills} / <span className="text-red-400">{h.deaths}</span> / {h.assists}
                          </div>
                          <div className={`text-[9px] font-mono font-black ${getKdaColor(gameKda)}`}>
                            KDA: {h.kda_score || '-'}
                          </div>
                        </div>

                        {/* MMR Delta */}
                        <div className="w-16 text-right flex-shrink-0">
                          <div className={`text-sm font-black font-mono ${h.mmr_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {h.mmr_delta >= 0 ? '+' : ''}{h.mmr_delta}
                          </div>
                          <div className="text-[8px] text-gray-500 font-bold tracking-wider uppercase">MMR</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
