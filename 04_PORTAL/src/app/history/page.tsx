'use client';

import { useEffect, useState } from 'react';
import { History, RefreshCw, Trophy, Swords, Calendar } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import { Spinner } from '../../components/Feedback';

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
    player_mmr?: number | null;
  }[];
  prediction?: {
    predicted_blue_winprob: number;
    correct: boolean;
  } | null;
}

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setFetchError(null);
        const res = await fetch('/api/match/history?limit=50&withPredictions=true');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '試合履歴の取得に失敗しました。');

        // データ整形
        const formatted = (data.matches as any[]).map(m => ({
          id: m.id,
          created_at: new Date(m.created_at).toLocaleString('ja-JP'),
          winning_team: m.winning_team,
          participants: m.participants,
          prediction: m.prediction
        }));
        setMatches(formatted);
      } catch (err: any) {
        console.error('Failed to fetch history:', err);
        setFetchError(err?.message || '試合履歴の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-stone-900">
        <Spinner label="試合履歴を読み込み中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
              <History className="h-8 w-8 text-amber-500" />
              過去の試合履歴
            </h1>
            <p className="text-stone-400 mt-2 text-sm">
              KTMで記録された過去のカスタムマッチの履歴と詳細を確認できます。
            </p>
          </div>
          <Link
            href="/balancer/record"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold transition text-xs shadow-lg shadow-emerald-950/40"
          >
            <Trophy className="h-4 w-4" />
            戦績の手動記録 🏆
          </Link>
        </div>

        <div className="space-y-6">
          {fetchError ? (
            <div className="bg-red-100 border border-red-200 text-red-700 rounded-xl p-8 text-center">
              試合履歴の取得中にエラーが発生しました: {fetchError}
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center text-stone-500">
              まだ記録された試合がありません。
            </div>
          ) : (
            matches.map(match => {
              const blueTeam = match.participants.filter(p => p.team === 'BLUE').sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role));
              const redTeam = match.participants.filter(p => p.team === 'RED').sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role));

              return (
                <div key={match.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-black/5 px-4 py-3 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border gap-2 md:gap-0 flex-wrap">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <span className="text-stone-400 font-mono text-xs md:text-sm">Match #{match.id}</span>
                      <span className="text-stone-500 flex items-center gap-1 text-xs md:text-sm"><Calendar className="w-3 h-3 md:w-4 md:h-4"/> {match.created_at}</span>
                      {match.prediction && (
                        <div className="flex items-center gap-1.5 md:gap-2 text-xs bg-black/5 px-2 py-0.5 md:py-1 rounded border border-border text-stone-700 ml-0 md:ml-2">
                          <span>予測勝率:</span>
                          <span className="text-blue-400 font-mono font-bold">🟦 {Math.round(match.prediction.predicted_blue_winprob * 100)}%</span>
                          <span className="text-stone-500">/</span>
                          <span className="text-red-400 font-mono font-bold">🟥 {Math.round((1 - match.prediction.predicted_blue_winprob) * 100)}%</span>
                          <span className="ml-1">
                            {match.prediction.correct ? (
                              <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] md:text-xs">🎯 的中</span>
                            ) : (
                              <span className="text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded border border-red-200 text-[10px] md:text-xs">💀 不的中</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs md:text-sm text-stone-400">WINNER:</span>
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
                    <div className={`p-4 border-t md:border-t-0 md:border-l border-border ${match.winning_team === 'RED' ? 'bg-red-950/20' : ''}`}>
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
    <div className="flex items-center justify-between bg-white/70 p-2 rounded-lg border border-border hover:bg-black/5 transition">
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        <span className="text-[10px] md:text-xs font-black text-stone-500 w-6 md:w-8 text-center">{p.role}</span>
        {p.champion_name ? (
          <Image
            src={getChampIcon(p.champion_name)}
            alt={p.champion_name}
            title={p.champion_name}
            width={32}
            height={32}
            className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-border shadow-sm flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-black/5 border border-border flex items-center justify-center text-[10px] md:text-xs text-stone-500 flex-shrink-0">?</div>
        )}
        <span className="font-bold text-stone-800 text-xs md:text-sm truncate mr-2">{p.player_name}</span>
        <span className="text-[10px] font-mono bg-surface text-stone-400 px-1.5 py-0.5 rounded border border-border mr-2 flex-shrink-0">
          {p.player_mmr ? `MMR: ${p.player_mmr}` : 'MMR: -'}
        </span>
      </div>
      <div className="flex items-center flex-shrink-0">
        <span className="font-mono text-xs md:text-sm tracking-tighter bg-surface px-1.5 md:px-2 py-0.5 md:py-1 rounded">
          <span className="text-emerald-700 font-bold">{p.kills}</span>
          <span className="text-stone-500 px-0.5">/</span>
          <span className="text-red-700 font-bold">{p.deaths}</span>
          <span className="text-stone-500 px-0.5">/</span>
          <span className="text-amber-700 font-bold">{p.assists}</span>
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
