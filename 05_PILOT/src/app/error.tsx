'use client';

import { useEffect } from 'react';

// 画面の描画エラーの受け皿（2026-10-08 追加。以前はNext.js既定のエラー画面だけで、どこにも通知されなかった）。
// 04のエラー受付API経由で #エラーログ へ送る。別オリジンなので no-cors + text/plain で送る（応答は読まない）。
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    fetch('https://my-work-8jbd.vercel.app/api/logs/error', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        app: '05',
        source: 'CLIENT',
        message: error?.message || 'Client UI Error',
        stack: error?.stack,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-3">
        <h2 className="text-base font-black text-white">画面の読み込みで問題が発生しました</h2>
        <p className="text-xs text-slate-400">エラー内容は管理者へ自動で通知されました。</p>
        {error?.message && (
          <p className="text-xs font-mono text-rose-400 break-all line-clamp-3 text-left p-3 rounded-xl bg-slate-950 border border-slate-800">
            {error.message}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
        >
          もう一度読み込む
        </button>
      </div>
    </div>
  );
}
