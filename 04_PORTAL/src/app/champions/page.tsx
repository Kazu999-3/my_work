"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Activity, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// タブコンポーネントの遅延読み込み
import dynamic from 'next/dynamic';
const DictionaryTab = dynamic(() => import('./tabs/DictionaryTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});
const AiUpdateTab = dynamic(() => import('./tabs/AiUpdateTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});

const TABS = [
  { id: 'dictionary', label: '辞典', icon: BookOpen, color: 'text-[#c89b3c]' },
  { id: 'ai-update', label: 'AI更新', icon: Sparkles, color: 'text-amber-700' },
] as const;

type TabId = typeof TABS[number]['id'];

function ChampionsShell() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'dictionary';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

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
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
          <BookOpen className="text-[#c89b3c]" size={36} />
          <span className="text-gradient text-gradient-gold">チャンピオン辞典</span>
        </h1>
        <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
          <Activity size={18} className="animate-pulse" /> 全チャンピオンの戦略データベース
        </p>
      </motion.header>

      {/* タブナビゲーション */}
      <div className="flex glass-panel p-1 rounded-xl items-center gap-0.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-black tracking-wider transition-all ${
                isActive
                  ? `bg-black/5 ${tab.color} shadow-lg`
                  : 'text-gray-400 hover:text-stone-900 hover:bg-black/[0.03]'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* タブコンテンツ（この画面自体が管理者専用のため、DictionaryTabの編集機能も常に有効） */}
      {activeTab === 'dictionary' && <DictionaryTab isAdmin={true} />}
      {activeTab === 'ai-update' && <AiUpdateTab />}
    </div>
  );
}

export default function ChampionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>}>
      <ChampionsShell />
    </Suspense>
  );
}
