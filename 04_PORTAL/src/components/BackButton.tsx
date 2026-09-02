'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

// ブラウザ履歴があれば1つ戻る。新規タブでの直接アクセスや共有リンク経由など、
// 戻り先が無い場合はポータルのホーム(/balancer)へ逃がす
// (2026-08-05: 全ページに戻る導線が無いとの指摘を受けて追加)。
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // トップページや自前で戻るナビゲーションを持つ主要ページでは重複・文字被りを防ぐため非表示
  const SELF_NAV_PAGES = [
    '/',
    '/balancer',
    '/balancer/record',
    '/casino',
    '/leaderboard',
    '/coach',
    '/history',
    '/guide',
    '/lane-guides',
    '/champions',
    '/synergy',
    '/changelog',
  ];

  if (SELF_NAV_PAGES.includes(pathname) || pathname.startsWith('/player/')) return null;

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/balancer');
    }
  };

  return (
    // h-0 + overflow-visible で通常のドキュメントフローの高さに一切寄与させない。
    // 多くのページが自前のトップレベルdivにmin-h-screenを指定しており、以前のように
    // ここが実高さを持つ要素として{children}の上に積まれると、body(flex, min-h-screen)
    // が既に確保している100vhの上にさらにこの高さが上乗せされ、全ページで数十px分の
    // 不要な縦スクロールが発生していた(2026-08-05発覚)。
    <div className="sticky top-2 z-30 h-0 overflow-visible print:hidden">
      <div className="px-4 md:px-6">
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 bg-white/90 hover:bg-white shadow-sm backdrop-blur px-3 py-1.5 rounded-xl border border-black/10 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>戻る</span>
        </button>
      </div>
    </div>
  );
}
