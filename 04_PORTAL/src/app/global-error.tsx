'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || 'Global Layout Error',
          stack: error?.stack,
          path: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
          digest: error?.digest,
        }),
      }).catch(() => {});
    } catch {}
  }, [error]);

  return (
    <html lang="ja">
      <body className="bg-[#1e1f22] text-[#f2f3f5] min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full p-6 rounded-3xl bg-[#2b2d31] border border-[#3f4147] shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-2xl">
            🚨
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">システム重大エラー</h2>
            <p className="text-xs text-[#949ba4]">
              アプリケーションの根幹部分でエラーが発生しました。管理者へ自動通報されました。
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs transition cursor-pointer"
          >
            再読み込みを試す
          </button>
        </div>
      </body>
    </html>
  );
}
