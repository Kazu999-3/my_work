"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Sparkles, 
  ArrowRight, 
  Search, 
  Bot, 
  Globe, 
  ScrollText, 
  Zap,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import GuideQuickStartTab from './tabs/GuideQuickStartTab';
import GuideBotTab from './tabs/GuideBotTab';
import GuidePortalTab from './tabs/GuidePortalTab';
import GuideUpdatesTab from './tabs/GuideUpdatesTab';
import GuideRulesTab from './tabs/GuideRulesTab';

function GuideContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'quickstart';

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['quickstart', 'rules', 'bot', 'portal', 'updates'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.replace(`/guide?tab=${tabId}`, { scroll: false });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchName.trim()) {
      router.push(`/player/${encodeURIComponent(searchName.trim())}`);
    }
  };

  const tabs = [
    {
      id: 'quickstart',
      label: '⚡ クイックスタート',
      shortLabel: 'スタート',
      icon: Zap,
      color: 'text-amber-700',
      activeBg: 'bg-amber-500/15 border-amber-500/40 text-amber-900',
    },
    {
      id: 'rules',
      label: '📜 公式ルール ＆ 特殊マッチ',
      shortLabel: 'ルール',
      icon: BookOpen,
      color: 'text-rose-700',
      activeBg: 'bg-rose-500/15 border-rose-500/40 text-rose-900',
    },
    {
      id: 'bot',
      label: '🤖 Discord Bot 使い方',
      shortLabel: 'Bot',
      icon: Bot,
      color: 'text-indigo-700',
      activeBg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-900',
    },
    {
      id: 'portal',
      label: '🌐 ポータル機能ガイド',
      shortLabel: 'ポータル',
      icon: Globe,
      color: 'text-cyan-700',
      activeBg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-900',
    },
    {
      id: 'updates',
      label: '🚀 アップデート情報',
      shortLabel: '更新情報',
      icon: ScrollText,
      color: 'text-orange-700',
      activeBg: 'bg-orange-500/15 border-orange-500/40 text-orange-900',
    },
  ];

  return (
    <div className="min-h-screen pb-16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 p-3 sm:p-5 md:p-6 space-y-5 max-w-[1300px] w-full mx-auto">
      {/* 洗練されたコンパクトヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="text-2xl p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/60 shrink-0 text-amber-600">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900 dark:text-stone-100">
                KTM 総合使い方ガイド ＆ リリースノート
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold">
                公式ガイド
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-0.5">
              Botコマンド・ポータル機能・カスタム参加手順から最新の更新情報まで網羅
            </p>
          </div>
        </div>

        {/* クイックマイページ検索 */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="サモナー名で戦績検索..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 transition-colors placeholder-stone-400"
            />
          </div>
          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-3.5 py-2 rounded-xl font-black text-xs transition-all shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>検索</span>
            <ArrowRight size={13} />
          </button>
        </form>
      </div>

      {/* タブナビゲーション（セグメントコントロール） */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs font-black'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800/60'
              }`}
            >
              <Icon size={14} className={isActive ? tab.color : 'text-stone-400'} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* タブコンテンツ */}
      <div className="transition-all duration-200">
        {activeTab === 'quickstart' && <GuideQuickStartTab onSelectTab={handleTabChange} />}
        {activeTab === 'rules' && <GuideRulesTab />}
        {activeTab === 'bot' && <GuideBotTab />}
        {activeTab === 'portal' && <GuidePortalTab />}
        {activeTab === 'updates' && <GuideUpdatesTab />}
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="text-stone-600 dark:text-stone-400 text-xs font-bold animate-pulse">ガイドを読み込み中...</div>
      </div>
    }>
      <GuideContent />
    </Suspense>
  );
}
