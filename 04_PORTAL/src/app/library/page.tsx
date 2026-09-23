'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const LibraryTabContent = dynamic(() => import('../admin/knowledge/LibraryTabContent'), {
  loading: () => (
    <div className="flex justify-center items-center py-24">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

export default function LibraryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-4">
        <div className="text-center max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-xs">
          <div className="text-4xl mb-3">🔑</div>
          <h2 className="text-base font-black mb-2 text-stone-900">管理者認証が必要です</h2>
          <p className="text-xs text-stone-600 mb-6 leading-relaxed">
            「攻略ライブラリ」は管理者専用の戦術アーカイブです。<br />
            閲覧・編集を行うには管理者としてログインしてください。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/champions"
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
            >
              👑 チャンピオン辞典へ戻る
            </Link>
            <a
              href="/login"
              className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-stone-950 transition"
            >
              管理者ログイン
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 p-3 sm:p-5">
      {/* ページヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 bg-white border border-stone-200/90 rounded-2xl shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl p-2 bg-purple-50 rounded-xl border border-purple-200/80 shrink-0 text-purple-600">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900">攻略ライブラリ</h1>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-800 text-[10px] font-extrabold">
                管理者専用
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
