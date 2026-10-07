"use client";

import type { CasinoTab } from './types';

// 勝敗予想・スロット・ブッシュスカウト・バカラ・ショップのタブ
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
export default function CasinoTabNav({ activeTab, setActiveTab }: {
  activeTab: CasinoTab;
  setActiveTab: (t: CasinoTab) => void;
}) {
  return (
    <>
        <div className="flex items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-surface-hover/80 text-foreground-subtle max-w-xl mx-auto shadow-sm border border-border overflow-x-auto scrollbar-none">
          {[
            { id: 'bet', label: '🎯 勝敗予想' },
            { id: 'slot', label: '🎰 KTMスロット' },
            { id: 'mines', label: '🌿 ブッシュ・スカウト' },
            { id: 'baccarat', label: '🃏 バカラ' },
            { id: 'shop', label: '🛒 ショップ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === tab.id
                  ? 'bg-surface text-foreground shadow-sm scale-102 border border-border'
                  : 'text-muted hover:text-foreground hover:bg-surface/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
    </>
  );
}
