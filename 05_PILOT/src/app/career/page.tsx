'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink, RefreshCw, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

export default function CareerTrackerPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 py-3 flex flex-col h-[calc(100vh-65px)]">
      {/* 🧭 上部ツールバー */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl px-4 py-2.5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition border border-zinc-800"
            title="ホームへ戻る"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>戻る</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>転職管理トラッカー</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                  キャリア支援
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* 右側アクション */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-zinc-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ブラウザLocalStorage自動保存</span>
          </div>
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition border border-zinc-700"
            title="トラッカーを再読み込み"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">再読込</span>
          </button>
          <a
            href="/tools/career-tracker.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-900/30"
            title="全画面別タブで開く"
          >
            <span>別タブで全画面表示</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 🖥️ トラッカー本体（フルハイトiframe） */}
      <div className="flex-1 w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
        <iframe
          ref={iframeRef}
          src="/tools/career-tracker.html"
          title="Career Tracker"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
