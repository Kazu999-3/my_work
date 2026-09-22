"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, HeartHandshake, Crown, Skull, Filter, Search, UserCheck, ArrowRight, Trophy } from 'lucide-react';

interface AllyStat {
  p1: string;
  p2: string;
  games: number;
  wins: number;
  winRate: number;
}

interface GroupStat {
  members: string[];
  games: number;
  wins: number;
  winRate: number;
}

export default function SynergyPanel() {
  const [loading, setLoading] = useState(true);
  const [allyStats, setAllyStats] = useState<AllyStat[]>([]);
  const [allPlayersList, setAllPlayersList] = useState<string[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [minGames, setMinGames] = useState(1);
  const [groupStats, setGroupStats] = useState<Record<number, GroupStat[]>>({ 3: [], 4: [], 5: [] });
  const [groupSize, setGroupSize] = useState<2 | 3 | 4 | 5>(2);
  const [filterPlayer, setFilterPlayer] = useState<string>('ALL');
  
  // シミュレーター用ステート
  const [simPlayer1, setSimPlayer1] = useState('');
  const [simPlayer2, setSimPlayer2] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch('/api/synergy');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '取得に失敗しました');
        setAllyStats(data.allyStats || []);
        setGroupStats(data.groupStats || { 3: [], 4: [], 5: [] });
        setAllPlayersList(data.allPlayers || []);
        setTotalMatches(data.totalMatches || 0);
      } catch (err) {
        console.error("Synergy fetchData Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const allPlayerNames = useMemo(() => {
    return Array.from(
      new Set([...allPlayersList, ...allyStats.flatMap(a => [a.p1, a.p2])])
    ).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [allPlayersList, allyStats]);

  const player1Suggestions = useMemo(() => {
    if (!simPlayer1) return { best: [], worst: [] };
    const myStats = allyStats.filter(a => a.p1 === simPlayer1 || a.p2 === simPlayer1);
    const mapped = myStats.map(s => {
      const partner = s.p1 === simPlayer1 ? s.p2 : s.p1;
      return { partner, games: s.games, wins: s.wins, winRate: s.winRate };
    });
    
    const best = [...mapped]
      .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate)
      .slice(0, 3);

    const worst = [...mapped]
      .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate)
      .slice(0, 3);

    return { best, worst };
  }, [simPlayer1, allyStats]);

  const filteredBestAlly = useMemo(() => {
    return allyStats
      .filter(a => {
        if (a.games < minGames) return false;
        if (filterPlayer !== 'ALL' && a.p1 !== filterPlayer && a.p2 !== filterPlayer) return false;
        return true;
      })
      .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate);
  }, [allyStats, minGames, filterPlayer]);

  const simResult = useMemo(() => {
    if (!simPlayer1 || !simPlayer2 || simPlayer1 === simPlayer2) return null;
    const match = allyStats.find(
      a => (a.p1 === simPlayer1 && a.p2 === simPlayer2) || (a.p1 === simPlayer2 && a.p2 === simPlayer1)
    );
    if (!match) return { games: 0, wins: 0, winRate: 0 };
    return match;
  }, [simPlayer1, simPlayer2, allyStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-stone-500 font-bold text-xs animate-pulse flex items-center gap-2">
          <span>🤝</span> 相性データを読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 🏆 ベストデュオ相性ランキング */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          最強デュオ相性ランキング (勝率順)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBestAlly.slice(0, 12).map((item, idx) => (
            <div
              key={item.p1 + item.p2}
              className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 hover:border-amber-300 transition flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  idx === 0 ? 'bg-amber-500 text-white' :
                  idx === 1 ? 'bg-stone-400 text-white' :
                  idx === 2 ? 'bg-amber-700 text-white' : 'bg-stone-200 text-stone-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-stone-900 truncate">
                    {item.p1} × {item.p2}
                  </div>
                  <div className="text-[10px] text-stone-500 font-medium">
                    {item.games}戦 {item.wins}勝
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-sm font-black text-emerald-600">
                  {Math.round(item.winRate)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredBestAlly.length === 0 && (
          <div className="text-center py-8 text-stone-400 text-xs font-bold">
            条件に一致する相性データがありません。
          </div>
        )}
      </div>
    </div>
  );
}
