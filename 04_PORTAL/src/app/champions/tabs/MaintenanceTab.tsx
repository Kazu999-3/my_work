'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Activity, Brain, ClipboardCheck, History } from 'lucide-react';
import dynamic from 'next/dynamic';

const DictHealthView = dynamic(() => import('../../admin/dict-health/page'), {
  loading: () => <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
});
const KnowledgeAdminView = dynamic(() => import('../../admin/knowledge/page'), {
  loading: () => <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-pink-500 border-t-transparent rounded-full animate-spin"></div></div>
});

type MaintenanceSubTab = 'health' | 'knowledge';

export default function MaintenanceTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams?.get('tab');
  const initialTab: MaintenanceSubTab = (rawTab === 'knowledge' || rawTab === 'video' || rawTab === 'discord' || rawTab === 'library' || rawTab === 'pending') ? 'knowledge' : 'health';
  const [activeSubTab, setActiveSubTab] = useState<MaintenanceSubTab>(initialTab);

  useEffect(() => {
    if (rawTab === 'knowledge' || rawTab === 'video' || rawTab === 'discord' || rawTab === 'library' || rawTab === 'pending') {
      setActiveSubTab('knowledge');
    } else if (rawTab === 'health' || rawTab === 'audit' || rawTab === 'history') {
      setActiveSubTab('health');
    }
  }, [rawTab]);

  const handleTabChange = (tab: MaintenanceSubTab) => {
    setActiveSubTab(tab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('scope', 'maintenance');
    params.set('tab', tab);
    router.replace(`/champions?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="w-full space-y-4">
      {/* サブナビゲーションバー */}
      <div className="flex items-center justify-between gap-3 bg-white/90 border border-stone-200/90 p-2 rounded-2xl shadow-xs flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100/80 rounded-xl">
          <button
            onClick={() => handleTabChange('health')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'health'
                ? 'bg-white text-amber-700 shadow-xs border border-stone-200/80 font-black'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Activity size={14} className="text-amber-500" />
            <span>📊 辞典ヘルス・鮮度 ＆ ファクトチェック</span>
          </button>
          <button
            onClick={() => handleTabChange('knowledge')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'knowledge'
                ? 'bg-white text-pink-700 shadow-xs border border-stone-200/80 font-black'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Brain size={14} className="text-pink-500" />
            <span>📝 ナレッジメモ・動画解析 ＆ 収集</span>
          </button>
        </div>

        <div className="text-[11px] text-stone-500 font-medium px-2 hidden sm:block">
          ※ 収集したデータやAI分析結果はチャンピオン辞典へ自動反映されます
        </div>
      </div>

      {/* サブタブに応じたビュー */}
      <div className="w-full">
        {activeSubTab === 'health' && <DictHealthView />}
        {activeSubTab === 'knowledge' && <KnowledgeAdminView />}
      </div>
    </div>
  );
}
