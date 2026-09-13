'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function MatchAnalyticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/coach?tab=postgame');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#eae4d4] text-[#201c2b] flex items-center justify-center p-4">
      <div className="text-center max-w-md bg-white/95 border border-stone-200/80 rounded-3xl p-8 shadow-xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl mx-auto">
          👑
        </div>
        <h1 className="text-base font-black text-stone-900">
          集団戦ディープアナリティクス統合ハブへ移動中...
        </h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          集団戦・序盤15分メトリクス・リコール逆再生・1分振り返りカルテは、すべて「試合後アナリティクスハブ」に一本化されました。
        </p>
        <Link
          href="/coach?tab=postgame"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs transition shadow-sm"
        >
          <span>ディープアナリティクスを開く</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
