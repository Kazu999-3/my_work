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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredMatches = matches.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.participants.some(p => 
      p.player_name?.toLowerCase().includes(q) || 
      p.champion_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-4 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 flex items-center gap-2.5">
              <History className="h-7 w-7 text-primary" />
              過去の試合履歴
            </h1>
            <p className="text-stone-500 mt-1 text-xs font-bold">
              直近のカスタム対戦結果 ＆ レーン別対決詳細 ⚔️
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
            <input
              type="text"
              placeholder="プレイヤー・チャンピオンで検索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3.5 py-2.5 outline-none focus:border-primary flex-1 sm:w-64 shadow-xs"
            />
            <Link
              href="/balancer/record"
              className="flex items-center gap-2 bg-primary hover:bg-accent text-white px-4 py-2.5 rounded-xl font-bold transition text-xs shadow-xs shrink-0"
            >
              <Trophy className="h-4 w-4" />
              <span>戦績の手動記録 🏆</span>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {fetchError ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-8 text-center font-bold">
              試合履歴の取得中にエラーが発生しました: {fetchError}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-stone-500 font-bold">
              {searchQuery ? '条件に一致する試合が見つかりませんでした。' : 'まだ記録された試合がありません。'}
            </div>
          ) : (
            filteredMatches.map(match => {
              const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
              const blueMap = new Map(match.participants.filter(p => p.team === 'BLUE').map(p => [p.role, p]));
              const redMap = new Map(match.participants.filter(p => p.team === 'RED').map(p => [p.role, p]));

              return (
                <div key={match.id} className="bg-white border border-stone-200/90 rounded-3xl overflow-hidden shadow-xs hover:border-stone-300 transition-all">
                  <div className="bg-stone-50/80 px-4 py-3.5 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-200 gap-2 md:gap-0 flex-wrap">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <span className="text-stone-900 font-extrabold text-xs md:text-sm bg-stone-200/70 px-2 py-0.5 rounded-lg">Match #{match.id}</span>
                      <span className="text-stone-500 flex items-center gap-1 text-xs font-medium"><Calendar className="w-3.5 h-3.5 text-stone-400"/> {match.created_at}</span>
                      {match.prediction && (
                        <div className="flex items-center gap-1.5 md:gap-2 text-xs bg-white px-2.5 py-1 rounded-xl border border-stone-200 text-stone-700 ml-0 md:ml-2 font-bold shadow-2xs">
                          <span className="text-stone-400 text-[10px]">予測勝率:</span>
                          <span className="text-blue-700 font-mono">🟦 {Math.round(match.prediction.predicted_blue_winprob * 100)}%</span>
                          <span className="text-stone-300">/</span>
                          <span className="text-rose-700 font-mono">🟥 {Math.round((1 - match.prediction.predicted_blue_winprob) * 100)}%</span>
                          <span className="ml-1">
                            {match.prediction.correct ? (
                              <span className="text-emerald-800 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300 text-[10px]">🎯 的中</span>
                            ) : (
                              <span className="text-rose-800 font-extrabold bg-rose-100 px-1.5 py-0.5 rounded-md border border-rose-300 text-[10px]">💀 不的中</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400 font-bold">WINNER:</span>
                      <span className={`font-extrabold px-3 py-1 rounded-xl text-xs border ${match.winning_team === 'BLUE' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
                        {match.winning_team === 'BLUE' ? '🟦 BLUE TEAM 勝利' : '🟥 RED TEAM 勝利'}
                      </span>
                    </div>
                  </div>
                  
                  {/* レーン直接対決テーブル */}
                  <div className="divide-y divide-stone-100 p-2 md:p-4">
                    {roles.map(role => {
                      const blueP = blueMap.get(role);
                      const redP = redMap.get(role);
                      return (
                        <div key={role} className="grid grid-cols-11 gap-2 items-center py-2 px-2 hover:bg-stone-50 rounded-xl transition">
                          {/* BLUE 側 */}
                          <div className="col-span-5 flex items-center justify-end gap-2 text-right">
                            {blueP ? (
                              <>
                                <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600 font-bold hidden sm:inline">
                                  {blueP.kills}/{blueP.deaths}/{blueP.assists}
                                </span>
                                <span className="font-bold text-xs md:text-sm text-stone-900 truncate max-w-[120px]">{blueP.player_name}</span>
                                {blueP.champion_name && (
                                  <Image
                                    src={getChampIcon(blueP.champion_name)}
                                    alt={blueP.champion_name}
                                    title={blueP.champion_name}
                                    width={28}
                                    height={28}
                                    className="w-7 h-7 rounded-full border border-blue-300 shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                              </>
                            ) : <span className="text-stone-300 text-xs">-</span>}
                          </div>

                          {/* 中央レーンバッジ */}
                          <div className="col-span-1 text-center">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 border border-stone-300">
                              {role}
                            </span>
                          </div>

                          {/* RED 側 */}
                          <div className="col-span-5 flex items-center justify-start gap-2 text-left">
                            {redP ? (
                              <>
                                {redP.champion_name && (
                                  <Image
                                    src={getChampIcon(redP.champion_name)}
                                    alt={redP.champion_name}
                                    title={redP.champion_name}
                                    width={28}
                                    height={28}
                                    className="w-7 h-7 rounded-full border border-rose-300 shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                                <span className="font-bold text-xs md:text-sm text-stone-900 truncate max-w-[120px]">{redP.player_name}</span>
                                <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600 font-bold hidden sm:inline">
                                  {redP.kills}/{redP.deaths}/{redP.assists}
                                </span>
                              </>
                            ) : <span className="text-stone-300 text-xs">-</span>}
                          </div>
                        </div>
                      );
                    })}
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
