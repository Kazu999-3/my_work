'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { History, Swords, Trophy, Calendar, RefreshCw } from 'lucide-react';

interface Match {
  id: string;
  created_at: string;
  winning_team: 'BLUE' | 'RED';
  participants: Participant[];
}

interface Participant {
  player_name: string;
  team: 'BLUE' | 'RED';
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda_score: number;
  mmr_delta: number;
}

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        // matchとparticipantsをJOINして取得
        const { data, error } = await supabase
          .from('ktm_matches')
          .select(`
            id, created_at, winning_team,
            ktm_match_participants (
              player_name, team, role, kills, deaths, assists, kda_score, mmr_delta
            )
          `)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) throw error;
        
        // 成形
        const formatted = data.map((m: any) => ({
          id: m.id,
          created_at: m.created_at,
          winning_team: m.winning_team,
          participants: m.ktm_match_participants || []
        }));
        
        setMatches(formatted);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  if (error) {
    return <div className="p-8 text-red-500 font-bold">Error: {error}</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-emerald-500/10 rounded-xl">
          <History className="h-8 w-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white">戦績一覧 (Match History)</h1>
          <p className="text-gray-400 font-medium">最近の試合結果とMMR変動</p>
        </div>
      </div>

      <div className="space-y-6">
        {matches.map(match => {
          const blueTeam = match.participants.filter(p => p.team === 'BLUE');
          const redTeam = match.participants.filter(p => p.team === 'RED');

          // ロール順にソート
          const sortByRole = (arr: Participant[]) => ROLES.map(role => arr.find(p => p.role === role)).filter(Boolean) as Participant[];
          const blueSorted = sortByRole(blueTeam);
          const redSorted = sortByRole(redTeam);

          const dateObj = new Date(match.created_at);
          const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

          return (
            <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              {/* Header */}
              <div className={`p-4 flex items-center justify-between border-b ${
                match.winning_team === 'BLUE' ? 'bg-blue-900/20 border-blue-900/50' : 'bg-red-900/20 border-red-900/50'
              }`}>
                <div className="flex items-center gap-3">
                  <Trophy className={`h-5 w-5 ${match.winning_team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`} />
                  <span className={`font-black tracking-wider text-lg ${match.winning_team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                    {match.winning_team} WIN
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm font-bold">
                  <Calendar className="h-4 w-4" />
                  {dateStr}
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-800">
                {/* BLUE TEAM */}
                <div className="flex-1 p-4 bg-gray-900/50">
                  <div className="space-y-2">
                    {blueSorted.map(p => (
                      <div key={p.player_name} className="flex items-center gap-3 bg-gray-800/40 p-2 rounded hover:bg-gray-800 transition">
                        <div className="w-10 text-center text-xs font-bold text-gray-500">{p.role}</div>
                        <div className="flex-1 font-bold text-gray-200 truncate">{p.player_name}</div>
                        
                        <div className="flex items-center gap-4">
                          {p.kills === 0 && p.deaths === 0 && p.assists === 0 && p.kda_score > 0 ? (
                            <div className="text-xs text-gray-400 w-16 text-right">KDA {p.kda_score}</div>
                          ) : (
                            <div className="text-xs text-gray-400 w-16 text-right">{p.kills} / {p.deaths} / {p.assists}</div>
                          )}
                          <div className={`w-14 text-right font-bold text-sm ${p.mmr_delta > 0 ? 'text-emerald-400' : p.mmr_delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RED TEAM */}
                <div className="flex-1 p-4 bg-gray-900/50">
                  <div className="space-y-2">
                    {redSorted.map(p => (
                      <div key={p.player_name} className="flex items-center gap-3 bg-gray-800/40 p-2 rounded hover:bg-gray-800 transition">
                        <div className="w-10 text-center text-xs font-bold text-gray-500">{p.role}</div>
                        <div className="flex-1 font-bold text-gray-200 truncate">{p.player_name}</div>
                        
                        <div className="flex items-center gap-4">
                          {p.kills === 0 && p.deaths === 0 && p.assists === 0 && p.kda_score > 0 ? (
                            <div className="text-xs text-gray-400 w-16 text-right">KDA {p.kda_score}</div>
                          ) : (
                            <div className="text-xs text-gray-400 w-16 text-right">{p.kills} / {p.deaths} / {p.assists}</div>
                          )}
                          <div className={`w-14 text-right font-bold text-sm ${p.mmr_delta > 0 ? 'text-emerald-400' : p.mmr_delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {matches.length === 0 && (
          <div className="text-center p-12 text-gray-500 font-bold">試合履歴がありません</div>
        )}
      </div>
    </div>
  );
}
