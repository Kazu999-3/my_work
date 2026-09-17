'use client';

import React from 'react';
import MatchHistoryPanel from '../ktm-admin/MatchHistoryPanel';
import Link from 'next/link';
import { Trophy, ArrowLeft } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-6 md:py-10 px-4 sm:px-6 lg:px-10">
      <div className="max-w-[1400px] w-full mx-auto space-y-6">
        {/* ナビゲーション */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/balancer"
            className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-amber-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>バランサーへ戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/leaderboard"
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-xs font-bold text-stone-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>順位表を見る</span>
            </Link>
          </div>
        </div>

        {/* 過去試合パネル */}
        <MatchHistoryPanel />
      </div>
    </div>
  );
}
