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
        <div className="flex items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 dark:bg-stone-900/90 text-foreground-subtle max-w-2xl mx-auto shadow-md border border-border/80 overflow-x-auto scrollbar-none backdrop-blur-md">
          {[
            { id: 'bet', label: '🎯 勝敗予想' },
            { id: 'slot', label: '🎰 KTMスロット' },
            { id: 'plinko', label: '💣 ジグスPlinko' },
            { id: 'mines', label: '🌿 ブッシュ・スカウト' },
            { id: 'baccarat', label: '🃏 バカラ' },
            { id: 'shop', label: '🛒 ショップ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md scale-102 font-extrabold'
                  : 'text-muted-strong hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 font-bold'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
    </>
  );
}
