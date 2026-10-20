'use client';

import React from 'react';
import MatchHistoryPanel from '../ktm-admin/MatchHistoryPanel';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import CustomSubNav from '../../components/CustomSubNav';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-6 md:py-10 px-4 sm:px-6 lg:px-10">
      <div className="max-w-[1400px] w-full mx-auto space-y-6">
        {/* カスタムの画面の切り替え（2026-10-20） */}
        <CustomSubNav />
        <div className="flex items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/leaderboard"
              className="px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-xs font-bold text-foreground-subtle transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-primary-600" />
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
