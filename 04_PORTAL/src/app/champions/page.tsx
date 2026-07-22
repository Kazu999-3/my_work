"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Activity, Swords, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// タブコンポーネントの遅延読み込み
import dynamic from 'next/dynamic';
const DictionaryTab = dynamic(() => import('./tabs/DictionaryTab'), { 
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});
const MatchupTab = dynamic(() => import('./tabs/MatchupTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});
const AiUpdateTab = dynamic(() => import('./tabs/AiUpdateTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});

const TABS = [
  { id: 'dictionary', label: '辞典', icon: BookOpen, color: 'text-[#c89b3c]' },
  { id: 'matchup', label: '対面', icon: Swords, color: 'text-[#00cfef]' },
  { id: 'ai-update', label: 'AI更新', icon: Sparkles, color: 'text-amber-400' },
] as const;

type TabId = typeof TABS[number]['id'];

function ChampionsShell() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'dictionary';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

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
                  ? `bg-white/10 ${tab.color} shadow-lg`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'dictionary' && <DictionaryTab />}
      {activeTab === 'matchup' && <MatchupTab />}
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
