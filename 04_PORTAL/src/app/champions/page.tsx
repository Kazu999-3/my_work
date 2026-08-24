"use client";

import { useState, useEffect } from 'react';
import { BookOpen, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

// タブコンポーネントの遅延読み込み
import dynamic from 'next/dynamic';
const DictionaryTab = dynamic(() => import('./tabs/DictionaryTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});

// 2026-08-13: 「AI更新」タブを辞典ヘルスダッシュボード(/admin/dict-health)へ統合し廃止した結果、
// タブが「辞典」1つだけになったため、タブ切り替えUI自体を撤去した(1つしかないタブバーは
// ただのUIノイズだったため)。今後タブが増える場合はTABS配列とタブバーJSXを復元すること。
function ChampionsShell() {
  // チャンピオン辞典は管理者専用（閲覧含め一般訪問者はアクセス不可）(#④)。
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm rounded-2xl border border-black/10 bg-black/[0.03] p-8 backdrop-blur">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2 text-stone-900">認証が必要です</h2>
          <p className="text-sm text-stone-500 mb-6 leading-relaxed">
            チャンピオン辞典は管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-[#c89b3c] px-5 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-10 max-w-[1680px] w-full mx-auto flex flex-col gap-6">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
          <BookOpen className="text-[#c89b3c]" size={36} />
          <span className="text-gradient text-gradient-gold">チャンピオン辞典</span>
        </h1>
        <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
          <Activity size={18} className="animate-pulse" /> 全チャンピオンの戦略データベース
        </p>
      </motion.header>

      {/* この画面自体が管理者専用のため、DictionaryTabの編集機能も常に有効 */}
      <DictionaryTab isAdmin={true} />
    </div>
  );
}

export default function ChampionsPage() {
  return <ChampionsShell />;
}
