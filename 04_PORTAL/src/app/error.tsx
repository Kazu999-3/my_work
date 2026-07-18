"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// ページ単位のエラー境界（#64）。配下のページで例外が起きたときにNext標準の
// 素っ気ない画面ではなく、再試行導線つきの共通画面を出す。
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[portal error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#06070a] px-6 text-center text-white">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-400">
        <AlertTriangle size={38} />
      </div>
      <div>
        <p className="text-sm font-black text-rose-300">問題が発生しました</p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-gray-500">
          一時的な通信エラーの可能性があります。「再試行」で直ることが多いです。
          繰り返す場合は少し時間をおいてお試しください。
        </p>
        {error?.digest && <p className="mt-2 text-[10px] text-gray-600">エラーID: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black text-gray-200 transition-all hover:bg-white/10"
        >
          <RefreshCw size={14} /> 再試行
        </button>
        <Link
          href="/balancer"
          className="inline-flex items-center gap-2 rounded-xl border border-[#c89b3c]/30 bg-[#c89b3c]/10 px-5 py-2.5 text-xs font-black text-[#c89b3c] transition-all hover:bg-[#c89b3c]/20"
        >
          <Home size={14} /> ホームへ
        </Link>
      </div>
    </div>
  );
}
