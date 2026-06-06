'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { History, RefreshCw, Trophy, Swords, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getChampIcon } from '../../lib/ddragonClient';

interface MatchData {
  id: number;
  created_at: string;
  winning_team: 'BLUE' | 'RED';
  participants: {
    player_name: string;
    team: 'BLUE' | 'RED';
    role: string;
    champion_name: string;
    kills: number;
    deaths: number;
    assists: number;
  }[];
}

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data, error } = await supabase
          .from('ktm_matches')
          .select(`
            id,
            created_at,
            winning_team,
            ktm_match_participants (
              player_name, team, role, champion_name, kills, deaths, assists
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50); // 直近50件
          
        if (error) throw error;

        // データ整形
        const formatted = (data as any[]).map(m => ({
          id: m.id,
          created_at: new Date(m.created_at).toLocaleString('ja-JP'),
          winning_team: m.winning_team,
          participants: m.ktm_match_participants
        }));
        setMatches(formatted);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 font-bold text-blue-400">履歴を読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <History className="h-8 w-8 text-blue-500" />
              過去の試合履歴
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              KTMで記録された過去のカスタムマッチの履歴と詳細を確認できます。
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {matches.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
              まだ記録された試合がありません。
            </div>
          ) : (
            matches.map(match => {
              const blueTeam = match.participants.filter(p => p.team === 'BLUE').sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role));
              const redTeam = match.participants.filter(p => p.team === 'RED').sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role));

              return (
                <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-gray-800/50 px-4 py-3 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 gap-2 md:gap-0">
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-gray-400 font-mono text-xs md:text-sm">Match #{match.id}</span>
                      <span className="text-gray-500 flex items-center gap-1 text-xs md:text-sm"><Calendar className="w-3 h-3 md:w-4 md:h-4"/> {match.created_at}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs md:text-sm text-gray-400">WINNER:</span>
                      <span className={`font-black px-2 py-0.5 md:px-3 md:py-1 rounded text-xs md:text-sm ${match.winning_team === 'BLUE' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
                        {match.winning_team === 'BLUE' ? '🟦 BLUE TEAM' : '🟥 RED TEAM'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* BLUE TEAM */}
                    <div className={`p-4 ${match.winning_team === 'BLUE' ? 'bg-blue-950/20' : ''}`}>
                      <h3 className="font-bold text-blue-400 mb-3 text-center tracking-widest">BLUE TEAM</h3>
                      <div className="space-y-2">
                        {blueTeam.map(p => (
                          <PlayerRow key={p.player_name} p={p} />
                        ))}
                      </div>
                    </div>
                    {/* RED TEAM */}
                    <div className={`p-4 border-t md:border-t-0 md:border-l border-gray-800 ${match.winning_team === 'RED' ? 'bg-red-950/20' : ''}`}>
                      <h3 className="font-bold text-red-400 mb-3 text-center tracking-widest">RED TEAM</h3>
                      <div className="space-y-2">
                        {redTeam.map(p => (
                          <PlayerRow key={p.player_name} p={p} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

function PlayerRow({ p }: { p: any }) {
  return (
    <div className="flex items-center justify-between bg-gray-950/50 p-2 rounded-lg border border-gray-800/50 hover:bg-gray-800/80 transition">
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        <span className="text-[10px] md:text-xs font-black text-gray-500 w-6 md:w-8 text-center">{p.role}</span>
        {p.champion_name ? (
          <img 
            src={getChampIcon(p.champion_name)} 
            alt={p.champion_name}
            title={p.champion_name}
            className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-700 shadow-sm flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] md:text-xs text-gray-500 flex-shrink-0">?</div>
        )}
        <span className="font-bold text-gray-200 text-xs md:text-sm truncate mr-2">{p.player_name}</span>
      </div>
      <div className="flex items-center flex-shrink-0">
        <span className="font-mono text-xs md:text-sm tracking-tighter bg-gray-900 px-1.5 md:px-2 py-0.5 md:py-1 rounded">
          <span className="text-emerald-400 font-bold">{p.kills}</span>
          <span className="text-gray-600 px-0.5">/</span>
          <span className="text-red-400 font-bold">{p.deaths}</span>
          <span className="text-gray-600 px-0.5">/</span>
          <span className="text-blue-400 font-bold">{p.assists}</span>
        </span>
      </div>
    </div>
  );
}

function getRoleWeight(role: string) {
  switch (role) {
    case 'TOP': return 1;
    case 'JG': return 2;
    case 'MID': return 3;
    case 'ADC': return 4;
    case 'SUP': return 5;
    default: return 9;
  }
}
