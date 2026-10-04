'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Video, ListVideo, Tv, ListChecks } from 'lucide-react';
import QueueTab from './QueueTab';
import WatchTab from './WatchTab';
import WorkerStatusPanel from './WorkerStatusPanel';
import BookmarkletPanel from './BookmarkletPanel';
import DeepDivePanel from './DeepDivePanel';

type Tab = 'queue' | 'channel' | 'playlist';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'queue', label: '解析キュー', icon: <ListVideo className="w-4 h-4" /> },
  { key: 'channel', label: '監視チャンネル', icon: <Tv className="w-4 h-4" /> },
  { key: 'playlist', label: '監視プレイリスト', icon: <ListChecks className="w-4 h-4" /> },
];

function YoutubeAdminContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('queue');

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q === 'channel' || q === 'playlist' || q === 'queue') setTab(q);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Video className="w-6 h-6 text-amber-400" /> YouTube動画解析センター
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              解説動画をキューに積み、PCのエッジワーカーが字幕取得→要約→ライブラリ保存まで自動で行います。
            </p>
          </div>
          <Link
            href="/admin/review"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold self-start sm:self-auto"
          >
            生成記事の承認へ →
          </Link>
        </div>

        <WorkerStatusPanel />

        <DeepDivePanel />

        <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                tab === t.key ? 'bg-amber-600 text-white' : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'queue' && (
          <div className="space-y-4">
            <BookmarkletPanel />
            <QueueTab />
          </div>
        )}
        {tab === 'channel' && <WatchTab kind="channel" />}
        {tab === 'playlist' && <WatchTab kind="playlist" />}
      </div>
    </div>
  );
}

export default function YoutubeAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs">ロード中...</div>}>
      <YoutubeAdminContent />
    </Suspense>
  );
}
