"use client";

import { Coins, Sparkles, Info } from 'lucide-react';
import Link from 'next/link';
import type { BetStats } from './useCasinoData';

// ヒーロー（タイトル・ルールへの導線・ジャックポット金庫）
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
// ジャックポットは取得できるまで「—」（以前は仮の値 12,800 を表示していた）。
export default function CasinoHero({ betStats }: {
  betStats: BetStats;
}) {
  return (
    <>
      <div className="bg-gradient-to-r from-primary-500/15 via-primary-400/10 to-primary-500/15 text-foreground py-10 px-6 relative overflow-hidden border-b border-primary-edge-strong/30">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-500/20 text-primary-900 text-xs font-black tracking-wider border border-primary-edge-strong/30">
            <Sparkles size={14} className="text-primary-600" />
            KTM Sovereign Casino & Shop
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center justify-center gap-3">
            <Coins className="text-primary-600" size={32} />
            勝敗予想 ＆ KTMショップ ＆ 長者番付
          </h1>
          <p className="text-foreground-subtle text-xs md:text-sm max-w-xl mx-auto font-medium">
            勝敗予想でコインを増やし、特権チケットやバラエティ権と交換しよう🔥
          </p>

          <Link
            href="/casino/rules"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface/70 hover:bg-surface border border-border text-foreground-subtle hover:text-foreground text-xs font-black transition-colors"
          >
            <Info size={13} />
            ルール ＆ 確率一覧を見る
          </Link>

          {/* ジャックポット金庫バナー */}
          <div className="mt-4 inline-flex flex-col items-center justify-center gap-2 px-5 md:px-8 py-3.5 rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-400/25 to-amber-600/15 border-2 border-amber-500/50 text-amber-950 dark:text-amber-100 text-xs font-black text-center max-w-full shadow-lg shadow-amber-500/10 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-400/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 relative z-10">
              <span className="text-xl animate-bounce">💎</span>
              <span className="tracking-wide">サーバー共有ジャックポット金庫:</span>
              <span className="text-amber-700 dark:text-amber-300 font-mono text-lg md:text-xl font-black drop-shadow-xs">
                {betStats.jackpot ? `${betStats.jackpot.amount.toLocaleString()} コイン` : '—'}
              </span>
              <span className="text-[10px] text-amber-900 dark:text-amber-200 font-bold bg-amber-500/25 px-2.5 py-0.5 rounded-full border border-amber-500/40 shadow-xs animate-pulse">
                🔥 ペンタキルで総取り！
              </span>
            </div>
            {betStats.jackpot?.lastWinner && (
              <div className="text-[10px] text-muted-strong font-medium relative z-10 flex items-center gap-1">
                <span>👑 直近の総取り当選者:</span>
                <strong className="text-amber-700 dark:text-amber-300 font-black">{betStats.jackpot.lastWinner}</strong>
                <span>（+{betStats.jackpot.lastPayout.toLocaleString()}🪙）</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
