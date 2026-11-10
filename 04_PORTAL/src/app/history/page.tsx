'use client';

import React from 'react';
import MatchHistoryPanel from '../ktm-admin/MatchHistoryPanel';
import CustomSubNav from '../../components/CustomSubNav';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-6 md:py-10 px-4 sm:px-6 lg:px-10">
      <div className="max-w-[1400px] w-full mx-auto space-y-6">
        {/* カスタムの画面の切り替え（2026-10-20） */}
        <CustomSubNav />

        {/* 過去試合パネル */}
        <MatchHistoryPanel />
      </div>
    </div>
  );
}
