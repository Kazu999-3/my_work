'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Coins, Trophy, Search, Sparkles, TrendingUp, Users, ArrowUpRight, Shield, Award, RefreshCw, AlertCircle } from 'lucide-react';
import { Spinner } from '../../components/Feedback';
import { getColorFromRankName } from '../../lib/mmr';

interface CoinRankingPlayer {
  rank: number;
  name: string;
  discordId: string;
  coins: number;
  highestRank: string;
  rankBadge: { name: string; color: string; bg: string };
}

interface Stats {
  totalPlayers: number;
  totalCoins: number;
  avgCoins: number;
}

export default function CoinsRankingPanel() {
  const [players, setPlayers] = useState<CoinRankingPlayer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const fetchCoinsRanking = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leaderboard/coins');
      const data = await res.json();
      if (!res.ok && !data.players) {
        throw new Error(data.error || 'コインランキングの取得に失敗しました');
      }
      setPlayers(data.players || []);
      setStats(data.stats || null);
    } catch (err: any) {
      console.error('Coins ranking fetch failed:', err);
      setError(err.message || 'データ取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoinsRanking();
  }, []);

  const filteredPlayers = useMemo(() => {
    const list = players.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    if (sortDir === 'asc') {
      return [...list].sort((a, b) => a.coins - b.coins);
    }
    return [...list].sort((a, b) => b.coins - a.coins);
  }, [players, search, sortDir]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <Spinner label="コイン長者番付を集計中..." />
      </div>
    );
  }

  if (error && players.length === 0) {
    return (
      <div className="max-w-md mx-auto p-6 bg-red-50/80 border border-red-200 rounded-2xl text-center space-y-3">
        <AlertCircle size={32} className="text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">{error}</p>
        <button
          onClick={fetchCoinsRanking}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <RefreshCw size={14} />
          再読み込み
        </button>
      </div>
    );
  }

  const top1 = players[0];
  const top2 = players[1];
  const top3 = players[2];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* 概要サマリーカード */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white/90 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Coins size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500">総流通コイン</p>
              <p className="text-xl font-black text-amber-600 font-mono tracking-tight">
                {stats.totalCoins.toLocaleString()} <span className="text-xs font-bold text-stone-400">🪙</span>
              </p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500">登録プレイヤー数</p>
              <p className="text-xl font-black text-stone-900 font-mono tracking-tight">
                {stats.totalPlayers} <span className="text-xs font-bold text-stone-400">名</span>
              </p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500">1人あたり平均所持</p>
              <p className="text-xl font-black text-stone-800 font-mono tracking-tight">
                {stats.avgCoins.toLocaleString()} <span className="text-xs font-bold text-stone-400">🪙</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🏆 TOP 3 表彰台カード */}
      {!search && players.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
          {/* 🥈 2位 */}
          {top2 && (
            <div className="order-2 md:order-1 bg-gradient-to-b from-stone-100/90 to-white/90 border-2 border-stone-300 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🥈</span>
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                  第2位
                </span>
              </div>
              <div className="space-y-1 my-2">
                <Link
                  href={`/player/${top2.discordId || top2.name}`}
                  className="text-base font-black text-stone-900 hover:text-amber-600 transition flex items-center gap-1.5 group"
                >
                  <span className="truncate">{top2.name}</span>
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition" />
                </Link>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] ${getColorFromRankName(top2.highestRank)}`}>
                    {top2.highestRank}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-200/80 flex items-baseline justify-between">
                <span className="text-[11px] text-stone-400 font-bold">所持コイン</span>
                <span className="text-lg font-black text-stone-800 font-mono">
                  🪙 {top2.coins.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* 🥇 1位 (富豪チャンピオン) */}
          {top1 && (
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50 to-amber-100/40 border-2 border-amber-400 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between md:-translate-y-2">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl animate-bounce">👑</span>
                <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-amber-500 text-white shadow-xs">
                  🏆 長者番付 第1位
                </span>
              </div>
              <div className="space-y-1.5 my-2">
                <Link
                  href={`/player/${top1.discordId || top1.name}`}
                  className="text-lg font-black text-stone-950 hover:text-amber-700 transition flex items-center gap-1.5 group"
                >
                  <span className="truncate">{top1.name}</span>
                  <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition" />
                </Link>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${getColorFromRankName(top1.highestRank)}`}>
                    {top1.highestRank}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-amber-300/80 flex items-baseline justify-between">
                <span className="text-xs text-amber-900 font-bold">富豪保有資産</span>
                <span className="text-2xl font-black text-amber-600 font-mono tracking-tight">
                  🪙 {top1.coins.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* 🥉 3位 */}
          {top3 && (
            <div className="order-3 md:order-3 bg-gradient-to-b from-amber-900/5 to-white/90 border-2 border-amber-700/30 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🥉</span>
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-amber-700/10 text-amber-800">
                  第3位
                </span>
              </div>
              <div className="space-y-1 my-2">
                <Link
                  href={`/player/${top3.discordId || top3.name}`}
                  className="text-base font-black text-stone-900 hover:text-amber-600 transition flex items-center gap-1.5 group"
                >
                  <span className="truncate">{top3.name}</span>
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition" />
                </Link>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] ${getColorFromRankName(top3.highestRank)}`}>
                    {top3.highestRank}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-200/80 flex items-baseline justify-between">
                <span className="text-[11px] text-stone-400 font-bold">所持コイン</span>
                <span className="text-lg font-black text-amber-800 font-mono">
                  🪙 {top3.coins.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* コントロールバー（検索・ソート） */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={16} className="text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="プレイヤー名を検索..."
            className="w-full bg-transparent text-xs sm:text-sm font-bold text-stone-900 placeholder-stone-400 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-stone-400 hover:text-stone-700 text-xs px-2 py-0.5 rounded-md bg-stone-100 cursor-pointer"
            >
              クリア
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
          <span>並び替え:</span>
          <button
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-black transition flex items-center gap-1 cursor-pointer"
          >
            <span>{sortDir === 'desc' ? 'コインが多い順 ↓' : 'コインが少ない順 ↑'}</span>
          </button>
        </div>
      </div>

      {/* 全プレイヤー ランキング一覧 */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-stone-50/90 border-b border-stone-200 text-[11px] font-black text-stone-500">
          <span className="w-10 text-center shrink-0">順位</span>
          <span className="flex-1 min-w-0">プレイヤー</span>
          <span className="w-24 text-center shrink-0 hidden sm:block">最高ランク</span>
          <span className="w-32 text-right shrink-0">所持コイン</span>
          <span className="w-16 text-center shrink-0">カルテ</span>
        </div>

        <div className="divide-y divide-stone-100">
          {filteredPlayers.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-xs font-bold">
              該当するプレイヤーが見つかりません
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <div
                key={player.name}
                className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/80 transition-colors group"
              >
                {/* 順位バッジ */}
                <div className="w-10 text-center shrink-0">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black font-mono ${
                      player.rank === 1
                        ? 'bg-amber-400 text-amber-950 shadow-2xs font-extrabold'
                        : player.rank === 2
                        ? 'bg-stone-300 text-stone-800 font-bold'
                        : player.rank === 3
                        ? 'bg-amber-700 text-white font-bold'
                        : 'text-stone-500 bg-stone-100'
                    }`}
                  >
                    {player.rank}
                  </span>
                </div>

                {/* プレイヤー名 */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/player/${player.discordId || player.name}`}
                    className="font-extrabold text-stone-900 group-hover:text-amber-600 transition text-xs sm:text-sm truncate block"
                  >
                    {player.name}
                  </Link>
                  <span className="sm:hidden text-[10px] text-stone-400 block mt-0.5">
                    {player.highestRank}
                  </span>
                </div>

                {/* 最高ランク */}
                <div className="w-24 text-center shrink-0 hidden sm:block">
                  <span className={`text-xs ${getColorFromRankName(player.highestRank)}`}>
                    {player.highestRank}
                  </span>
                </div>

                {/* コイン枚数 */}
                <div className="w-32 text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-amber-600 font-mono tracking-tight">
                    🪙 {player.coins.toLocaleString()}
                  </span>
                </div>

                {/* カルテリンク */}
                <div className="w-16 text-center shrink-0">
                  <Link
                    href={`/player/${player.discordId || player.name}`}
                    className="inline-flex items-center justify-center p-1.5 rounded-lg bg-stone-100 hover:bg-amber-500 hover:text-white text-stone-500 transition cursor-pointer"
                    title={`${player.name} の個人カルテ`}
                  >
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* カジノ/ベットへの案内バナー */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
            <Coins size={18} />
          </div>
          <div>
            <p className="text-xs font-black text-stone-900">もっとコインを増やしたい？</p>
            <p className="text-[11px] text-stone-500">カスタム戦の勝敗予想やデイリーボーナスでコインをGETしよう！</p>
          </div>
        </div>
        <Link
          href="/casino"
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs transition shadow-2xs hover:shadow-xs flex items-center gap-1.5"
        >
          <span>🎯 カジノ ＆ 勝敗予想へ</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
