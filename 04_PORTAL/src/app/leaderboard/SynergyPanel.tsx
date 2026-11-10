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
  const [minGames, setMinGames] = useState(2); // デフォルト2戦以上（1戦のみの偶然100%排除）
  const [displayLimit, setDisplayLimit] = useState(24);
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
        <div className="text-muted-strong font-bold text-xs animate-pulse flex items-center gap-2">
          <span>🤝</span> 相性データを読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* フィルター・コントロールバー */}
      <div className="bg-surface/90 border border-border/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* 最低試合数 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted">最低試合数:</span>
            {[1, 2, 3, 5].map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setMinGames(cnt)}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                  minGames === cnt
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-surface-subtle hover:bg-surface-hover text-muted'
                }`}
              >
                {cnt}戦以上
              </button>
            ))}
          </div>

          {/* プレイヤー絞り込み */}
          {allPlayerNames.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted">プレイヤー:</span>
              <select
                value={filterPlayer}
                onChange={(e) => setFilterPlayer(e.target.value)}
                className="bg-background border border-border rounded-xl px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:border-primary-edge-strong transition cursor-pointer max-w-[160px]"
              >
                <option value="ALL">全員</option>
                {allPlayerNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-strong font-mono self-end sm:self-auto">
          全 {filteredBestAlly.length} 組中 {Math.min(displayLimit, filteredBestAlly.length)} 組表示
        </div>
      </div>

      {/* 🏆 ベストデュオ相性ランキング */}
      <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
        <h3 className="text-base font-black text-foreground flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary-500" />
          最強デュオ相性ランキング (勝率順)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBestAlly.slice(0, displayLimit).map((item, idx) => {
            const winRatePct = item.winRate <= 1 ? Math.round(item.winRate * 100) : Math.round(item.winRate);
            return (
              <div
                key={item.p1 + '::' + item.p2}
                className="p-3.5 rounded-2xl bg-background border border-border/80 hover:border-primary-edge transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    idx === 0 ? 'bg-primary-500 text-white' :
                    idx === 1 ? 'bg-stone-400 text-white' :
                    idx === 2 ? 'bg-primary-700 text-white' : 'bg-surface-hover text-muted'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-foreground truncate">
                      {item.p1} × {item.p2}
                    </div>
                    <div className="text-[10px] text-muted-strong font-medium">
                      {item.games}戦 {item.wins}勝
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-sm font-black ${winRatePct >= 60 ? 'text-success-600' : winRatePct <= 40 ? 'text-danger-600' : 'text-foreground'}`}>
                    {winRatePct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredBestAlly.length === 0 && (
          <div className="text-center py-8 text-faint text-xs font-bold">
            条件に一致する相性データがありません。
          </div>
        )}

        {filteredBestAlly.length > displayLimit && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 24)}
              className="px-6 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-xs font-bold text-foreground transition cursor-pointer"
            >
              さらに表示 (+24組) ▾
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
