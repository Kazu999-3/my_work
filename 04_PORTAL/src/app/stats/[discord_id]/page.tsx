'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

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
  matches: {
    winning_team: string;
    game_duration: number;
  };
}

interface PageProps {
  params: Promise<{ discord_id: string }>;
}

export default function PlayerStatsPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const discordId = unwrappedParams.discord_id;
  
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [history, setHistory] = useState<MatchHistory[]>([]);
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
          id, match_id, role, team, kills, deaths, assists, kda_score, mmr_delta, created_at,
          ktm_matches ( winning_team, game_duration )
        `)
        .eq('player_name', pData.name)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!hError && hData) {
        // anyを回避するためマッピング
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
          matches: {
            winning_team: item.ktm_matches?.winning_team || '',
            game_duration: item.ktm_matches?.game_duration || 0
          }
        }));
        setHistory(mappedHistory);
      }

      setLoading(false);
    }

    fetchStats();
  }, [discordId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <div className="text-5xl mb-4">😢</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">エラーが発生しました</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/ktm-admin" className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors inline-block">
            管理画面に戻る
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
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ヘッダー・プロフィール */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
          <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
          <div className="px-6 sm:px-10 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-12 sm:-mt-10 gap-4 mb-6">
              <div className="w-24 h-24 bg-white p-1 rounded-2xl shadow-md flex-shrink-0">
                <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center text-4xl">
                  🎮
                </div>
              </div>
              <div className="text-center sm:text-left flex-grow">
                <h1 className="text-3xl font-extrabold text-gray-900">{player.name}</h1>
                <p className="text-gray-500 flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">
                    {player.lol_ign || 'IGN未登録'}
                  </span>
                  {player.is_active ? (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                  ) : (
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-center">
                  <div className="text-xs text-gray-400 font-bold mb-1">MAIN</div>
                  <div className="font-bold text-gray-900">{player.main_lane}</div>
                </div>
                <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-center">
                  <div className="text-xs text-gray-400 font-bold mb-1">SUB</div>
                  <div className="font-bold text-gray-900">{player.sub_lane}</div>
                </div>
                <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 text-center">
                  <div className="text-xs text-orange-400 font-bold mb-1">PITY</div>
                  <div className="font-bold text-orange-700">{player.pity}</div>
                </div>
              </div>
            </div>

            {/* MMR 一覧 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-gray-100 pt-6">
              {[
                { role: 'TOP', icon: '🪓', mmr: player.top_mmr },
                { role: 'JG', icon: '🌲', mmr: player.jg_mmr },
                { role: 'MID', icon: '🔥', mmr: player.mid_mmr },
                { role: 'ADC', icon: '🏹', mmr: player.adc_mmr },
                { role: 'SUP', icon: '🛡️', mmr: player.sup_mmr },
              ].map(r => (
                <div key={r.role} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs font-bold text-gray-400 mb-1 flex justify-center items-center gap-1">
                    <span>{r.icon}</span> {r.role}
                  </div>
                  <div className="text-xl font-bold text-gray-900">{r.mmr.toLocaleString()}</div>
                  {roleStats[r.role].games > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {roleStats[r.role].games}戦 {Math.round((roleStats[r.role].wins / roleStats[r.role].games) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 試合履歴 */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 px-1">直近の試合履歴</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {history.length === 0 ? (
              <div className="p-10 text-center text-gray-400">試合履歴がありません</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {history.map(h => {
                  const isWin = h.team === h.matches.winning_team;
                  return (
                    <div key={h.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                      {/* Win/Loss Badge */}
                      <div className="w-16 flex-shrink-0">
                        {isWin ? (
                          <div className="bg-blue-100 text-blue-700 font-bold text-center py-1 rounded text-sm">WIN</div>
                        ) : (
                          <div className="bg-red-100 text-red-700 font-bold text-center py-1 rounded text-sm">LOSS</div>
                        )}
                      </div>

                      {/* Role & Date */}
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{h.role}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${h.team === 'BLUE' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            {h.team}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {new Date(h.created_at).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* KDA */}
                      <div className="text-center px-4 border-l border-r border-gray-100 min-w-[100px] hidden sm:block">
                        <div className="text-sm font-mono text-gray-600 mb-1">
                          {h.kills} / <span className="text-red-500">{h.deaths}</span> / {h.assists}
                        </div>
                        <div className="text-xs text-gray-400 font-bold">
                          KDA: {h.kda_score || '-'}
                        </div>
                      </div>

                      {/* MMR Delta */}
                      <div className="w-20 text-right flex-shrink-0">
                        <div className={`text-lg font-bold ${h.mmr_delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {h.mmr_delta >= 0 ? '+' : ''}{h.mmr_delta}
                        </div>
                        <div className="text-xs text-gray-400 font-bold">MMR</div>
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
  );
}
