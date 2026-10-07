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
          <div className="mt-4 inline-flex flex-col items-center justify-center gap-1.5 px-4 md:px-6 py-2.5 rounded-2xl bg-primary-100/90 border-2 border-primary-edge/60 text-primary-950 text-xs font-black text-center max-w-full shadow-sm">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-base animate-bounce">💎</span>
              <span>サーバー共有ジャックポット金庫:</span>
              <span className="text-primary-700 font-mono text-base font-black">
                {betStats.jackpot ? `${betStats.jackpot.amount.toLocaleString()} コイン` : '—'}
              </span>
              <span className="text-[10px] text-primary-800 font-bold bg-primary-500/20 px-2 py-0.5 rounded-full border border-primary-edge-strong/30">
                🔥 ペンタキルで総取り！
              </span>
            </div>
            {betStats.jackpot?.lastWinner && (
              <div className="text-[10px] text-muted font-medium">
                👑 直近の総取り当選者: <strong className="text-primary-700">{betStats.jackpot.lastWinner}</strong> さん（+{betStats.jackpot.lastPayout.toLocaleString()}🪙）
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
