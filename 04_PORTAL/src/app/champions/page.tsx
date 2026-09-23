"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Activity, Map, Sparkles, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

// 各サブモジュールを遅延読み込み
const DictionaryTab = dynamic(() => import('./tabs/DictionaryTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});
const LaneGuidesView = dynamic(() => import('../lane-guides/page'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div></div>
});
const LibraryTabContent = dynamic(() => import('../admin/knowledge/LibraryTabContent'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
});
const KnowledgeIngestView = dynamic(() => import('../admin/knowledge/page'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div></div>
});
const DictHealthView = dynamic(() => import('../admin/dict-health/page'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
});

type KnowledgeScope = 'champions' | 'lane-guides' | 'library' | 'ingest' | 'health';

const SCOPES: { id: KnowledgeScope; label: string; icon: any; color: string; activeBg: string }[] = [
  { id: 'champions', label: '👑 チャンピオン辞典', icon: BookOpen, color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15 text-[#c89b3c] border-[#c89b3c]/40' },
  { id: 'lane-guides', label: '🗺️ レーン・マクロ', icon: Map, color: 'text-sky-500', activeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/40' },
  { id: 'library', label: '🗂️ 攻略ライブラリ', icon: Layers, color: 'text-purple-600', activeBg: 'bg-purple-500/15 text-purple-700 border-purple-500/40' },
  { id: 'ingest', label: '📥 戦術取り込み', icon: Sparkles, color: 'text-pink-600', activeBg: 'bg-pink-500/15 text-pink-700 border-pink-500/40' },
  { id: 'health', label: '📊 辞典ヘルス', icon: Activity, color: 'text-amber-600', activeBg: 'bg-amber-500/15 text-amber-700 border-amber-500/40' },
];

function ChampionsShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawScope = searchParams.get('scope');
  
  // 後方互換性を持たせたスコープ正規化
  const normalizedScope: KnowledgeScope = 
    rawScope === 'lane-guides' ? 'lane-guides' :
    rawScope === 'library' ? 'library' :
    (rawScope === 'ingest' || rawScope === 'knowledge') ? 'ingest' :
    rawScope === 'health' ? 'health' :
    rawScope === 'maintenance' ? 'health' :
    'champions';

  const [scope, setScope] = useState<KnowledgeScope>(normalizedScope);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthChecking(false));
  }, []);

  const handleScopeChange = (newScope: KnowledgeScope) => {
    setScope(newScope);
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', newScope);
    router.replace(`/champions?${params.toString()}`, { scroll: false });
  };

  const isAdminOnlyScope = scope === 'ingest' || scope === 'health';

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 max-w-[1760px] w-full mx-auto flex flex-col gap-4">
      {/* 洗練されたクリーンな辞典ヘッダー */}
      <motion.header 
        initial={{ y: -6, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.2 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 bg-white border border-stone-200/80 rounded-2xl shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl p-1.5 bg-amber-50 rounded-xl border border-amber-200/60 shrink-0">👑</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900">チャンピオン攻略辞典</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-100/70 border border-amber-300/60 text-amber-800 text-[10px] font-extrabold">
                {isAuthenticated ? '管理者' : '攻略モード'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              チャレンジャー実戦データ・立ち回り・ビルド・対面相性アーカイブ
            </p>
          </div>
        </div>

        {/* 中央: チャンピオン攻略 ＆ 辞典ヘルス 切替タブ */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleScopeChange('champions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              scope === 'champions'
                ? 'bg-white text-stone-900 shadow-xs font-black scale-101'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <span>👑 チャンピオン攻略</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange('health')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              scope === 'health'
                ? 'bg-white text-amber-700 shadow-xs font-black scale-101'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <span>🩺 辞典ヘルス</span>
          </button>
        </div>

        {/* 右側の整理されたクイックリンク */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          <Link
            href="/lane-guides"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition flex items-center gap-1"
          >
            <span>📖 レーン攻略</span>
          </Link>
          {isAuthenticated && (
            <>
              <Link
                href="/library"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 transition flex items-center gap-1"
              >
                <span>📒 攻略ライブラリ</span>
              </Link>
              <Link
                href="/admin/knowledge"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-pink-700 hover:text-pink-900 bg-pink-50 hover:bg-pink-100/80 border border-pink-200 transition flex items-center gap-1"
              >
                <span>📥 戦術取込</span>
              </Link>
            </>
          )}
        </div>
      </motion.header>

      {/* メインコンテンツ */}
      <div className="flex-1 min-w-0">
        {scope === 'champions' && <DictionaryTab isAdmin={isAuthenticated} />}
        {scope === 'health' && <DictHealthView />}
        {scope === 'lane-guides' && <LaneGuidesView />}
        {scope === 'library' && <LibraryTabContent />}
        {scope === 'ingest' && <KnowledgeIngestView />}
      </div>
    </div>
  );
}

export default function ChampionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>}>
      <ChampionsShell />
    </Suspense>
  );
}
