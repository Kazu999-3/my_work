'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

const LibraryTabContent = dynamic(() => import('../admin/knowledge/LibraryTabContent'), {
  loading: () => (
    <div className="flex justify-center items-center py-24">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

export default function LibraryPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 p-3 sm:p-5">
      {/* ページヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 bg-white border border-stone-200/90 rounded-2xl shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl p-2 bg-amber-50 rounded-xl border border-amber-200/80 shrink-0 text-amber-600">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900">攻略ライブラリ</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-100/70 border border-amber-300/60 text-amber-800 text-[10px] font-extrabold">
                ナレッジベース
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              チャレンジャー実戦動画の解析記事・チーム戦術ノート・チャンピオン攻略アーカイブ
            </p>
          </div>
        </div>
      </motion.header>

      {/* 攻略ライブラリ本体 */}
      <Suspense fallback={
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <LibraryTabContent />
      </Suspense>
    </div>
  );
}
