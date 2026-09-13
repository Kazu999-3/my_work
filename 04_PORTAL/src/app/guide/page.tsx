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

function GuideContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'quickstart';

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['quickstart', 'bot', 'portal', 'updates'].includes(tabParam)) {
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
    <div className="min-h-screen pb-20 bg-[#eae4d4] text-[#201c2b]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 text-stone-100 py-10 md:py-12 px-6 relative overflow-hidden border-b border-black/10">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black tracking-wider border border-amber-500/30">
              <BookOpen size={14} />
              KTM Sovereign OS 総合ガイド ＆ リリースノート
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">
            KTM 総合使い方説明 ＆ アップデート
          </h1>
          <p className="text-stone-300 text-xs md:text-sm max-w-xl mx-auto font-medium leading-relaxed">
            Botコマンド・ポータル機能・カスタム参加手順から最新の更新情報まで、迷ったらここをチェック！
          </p>

          {/* クイックマイページ検索 */}
          <form onSubmit={handleSearch} className="mt-6 max-w-md mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input
                type="text"
                placeholder="サモナー名でマイページを即検索..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full bg-stone-950/80 border border-stone-700 text-white rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              検索 <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-[1300px] w-full mx-auto px-4 md:px-8 py-6 space-y-6">
        
        {/* タブナビゲーション */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-stone-300/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? `${tab.activeBg} shadow-xs scale-102`
                    : 'bg-white/80 hover:bg-white text-stone-600 border-stone-200/90'
                }`}
              >
                <Icon size={16} className={isActive ? tab.color : 'text-stone-400'} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* タブコンテンツ */}
        <div className="transition-all duration-200">
          {activeTab === 'quickstart' && <GuideQuickStartTab onSelectTab={handleTabChange} />}
          {activeTab === 'bot' && <GuideBotTab />}
          {activeTab === 'portal' && <GuidePortalTab />}
          {activeTab === 'updates' && <GuideUpdatesTab />}
        </div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#eae4d4] flex items-center justify-center">
        <div className="text-stone-600 text-xs font-bold animate-pulse">ガイドを読み込み中...</div>
      </div>
    }>
      <GuideContent />
    </Suspense>
  );
}
