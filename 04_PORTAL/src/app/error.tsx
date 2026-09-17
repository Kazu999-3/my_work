'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 発生したエラーを自動的にDiscordログAPIへ通報
    try {
      fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || 'Client UI Error',
          stack: error?.stack,
          path: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          digest: error?.digest,
        }),
      }).catch(() => {});
    } catch {}
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 rounded-3xl bg-white/95 dark:bg-[#2b2d31] border border-stone-200 dark:border-[#3f4147] shadow-xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <AlertTriangle size={32} />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-black text-stone-900 dark:text-white">
            画面の読み込みで問題が発生しました
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-300">
            予期せぬエラーが発生しました。エラー内容は管理者へ自動通報されました。
          </p>
        </div>

        {error?.message && (
          <div className="p-3 rounded-xl bg-stone-100 dark:bg-[#1e1f22] border border-stone-200 dark:border-[#3f4147] text-left">
            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">エラー詳細</div>
            <p className="text-xs font-mono text-rose-600 dark:text-rose-400 break-all line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>再読み込み</span>
          </button>
          <Link
            href="/"
            className="flex-1 py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-[#1e1f22] hover:bg-stone-200 dark:hover:bg-[#35373c] text-stone-700 dark:text-stone-200 font-bold text-xs transition flex items-center justify-center gap-1.5 border border-stone-200 dark:border-[#3f4147]"
          >
            <Home size={14} />
            <span>トップへ戻る</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
