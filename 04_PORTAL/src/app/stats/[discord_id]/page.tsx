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

        {/* 苦手対面チャンピオン ＆ 試合履歴の 2カラムグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* 左カラム: 苦手チャンピオン */}
          <div className="md:col-span-1 space-y-4">
            <h2 className="text-lg font-black text-[#c89b3c] flex items-center gap-2 px-1">
              <Zap className="w-5 h-5" />
              <span>対面要注意チャンピオン (直近20戦)</span>
            </h2>
            <div className="glass-panel border border-white/10 rounded-3xl p-5 space-y-4 shadow-lg bg-gradient-to-b from-white/[0.02] to-transparent">
              {nemesisList.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs">要注意チャンプのデータはありません</div>
              ) : (
                <div className="space-y-4">
                  {nemesisList.map((n, i) => (
                    <div key={n.championName} className="flex items-center gap-4 bg-black/40 border border-white/5 rounded-2xl p-3.5 relative overflow-hidden group">
                      {/* ワースト順インデックス */}
                      <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-500/10 border-l border-b border-red-500/20 text-[9px] font-black text-red-400 tracking-wider">
                        WORST {i+1}
                      </div>

                      {/* チャンピオンアイコン */}
                      <img 
                        src={getChampIcon(n.championName)} 
                        alt={n.championName}
                        className="w-12 h-12 rounded-xl border border-white/10 shrink-0"
                      />

                      {/* 統計 */}
                      <div className="space-y-1.5 flex-grow">
                        <div className="font-extrabold text-sm text-white">{n.championName}</div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                          <span>対面: {n.games}戦</span>
                          <span className="text-red-400">負け: {n.losses}回</span>
                          <span className="font-black text-red-300">勝率: {n.winRate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右カラム: 試合履歴 */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 px-1">
              <Swords className="w-5 h-5 text-gray-400" />
              <span>直近の対戦履歴</span>
            </h2>
            <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-lg">
              {history.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-xs">試合履歴がありません</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map(h => {
                    const isWin = h.team === h.matches.winning_team;
                    return (
                      <div key={h.id} className="p-4 sm:px-6 hover:bg-white/[0.02] transition-all flex items-center justify-between gap-4">
                        {/* Win/Loss Badge */}
                        <div className="w-16 flex-shrink-0">
                          {isWin ? (
                            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black text-center py-1 rounded-xl text-xs tracking-wider">WIN</div>
                          ) : (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 font-black text-center py-1 rounded-xl text-xs tracking-wider">LOSS</div>
                          )}
                        </div>

                        {/* Champion & Role & Opponent */}
                        <div className="flex-grow flex items-center gap-3.5">
                          <img 
                            src={getChampIcon(h.champion_name)} 
                            alt={h.champion_name}
                            className="w-10 h-10 rounded-xl border border-white/5 shrink-0 hidden sm:block"
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-extrabold text-sm text-white">{h.champion_name}</span>
                              <span className="text-[10px] font-black text-gray-400 bg-white/5 border border-white/15 px-2 py-0.5 rounded uppercase tracking-wider">{h.role}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">
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
                        <div className="text-center px-4 border-l border-r border-white/5 min-w-[100px] hidden sm:block">
                          <div className="text-sm font-mono text-gray-300 mb-0.5">
                            {h.kills} / <span className="text-red-400 font-bold">{h.deaths}</span> / {h.assists}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            KDA: {h.kda_score || '-'}
                          </div>
                        </div>

                        {/* MMR Delta */}
                        <div className="w-20 text-right flex-shrink-0">
                          <div className={`text-base font-black ${h.mmr_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {h.mmr_delta >= 0 ? '+' : ''}{h.mmr_delta}
                          </div>
                          <div className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">MMR</div>
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
