'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

// ブラウザ履歴があれば1つ戻る。新規タブでの直接アクセスや共有リンク経由など、
// 戻り先が無い場合はポータルのホーム(/balancer)へ逃がす
// (2026-08-05: 全ページに戻る導線が無いとの指摘を受けて追加)。
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/balancer') return null;

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/balancer');
    }
  };

  return (
    <div className="px-4 pt-3 md:px-6 md:pt-4">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 bg-black/5 hover:bg-black/10 px-3 py-1.5 rounded-xl border border-black/10 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>戻る</span>
      </button>
    </div>
  );
}
