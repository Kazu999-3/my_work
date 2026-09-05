"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
      {/* 統合ナレッジヘッダー ＆ スコープ切り替えバー（フラット5タブ） */}
      <motion.header 
        initial={{ y: -6, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.2 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 sm:p-4 bg-white/90 border border-stone-200/90 rounded-2xl shadow-xs backdrop-blur-sm"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl sm:text-3xl p-1.5 bg-amber-50 rounded-xl border border-amber-200/80 shrink-0">📖</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-stone-900">攻略ナレッジハブ</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold">
                {isAuthenticated ? '管理者モード' : 'プレイヤー攻略モード'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium hidden sm:block">
              チャンピオン辞典・レーン戦術・攻略記事・知見取り込み・データ品質監査
            </p>
          </div>
        </div>

        {/* スコープ切り替えタブ（完全フラットな5タブ） */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100/90 rounded-xl overflow-x-auto scrollbar-none max-w-full">
          {SCOPES.map((s) => {
            const isActive = scope === s.id;
            const isProtected = (s.id === 'ingest' || s.id === 'health') && !isAuthenticated;
            return (
              <button
                key={s.id}
                onClick={() => handleScopeChange(s.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer ${
                  isActive
                    ? `bg-white shadow-xs ${s.color} border border-stone-200/80 font-black scale-102`
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <span>{s.label}</span>
                {isProtected && <span className="text-[10px] opacity-70">🔒</span>}
              </button>
            );
          })}
        </div>
      </motion.header>

      {/* スコープに応じたゼロ遷移ビュー */}
      <div className="flex-1 min-w-0">
        {isAdminOnlyScope && !isAuthenticated ? (
          <div className="min-h-[400px] flex items-center justify-center p-4">
            <div className="text-center max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-xs">
              <div className="text-4xl mb-3">🔑</div>
              <h2 className="text-base font-black mb-2 text-stone-900">管理者認証が必要です</h2>
              <p className="text-xs text-stone-600 mb-6 leading-relaxed">
                「{scope === 'ingest' ? '戦術取り込み' : '辞典ヘルス'}」は管理者専用の保守管理機能です。<br />
                チャンピオン辞典やレーン攻略はログイン不要でどなたでもご利用いただけます。
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleScopeChange('champions')}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
                >
                  👑 チャンピオン辞典を見る
                </button>
                <a
                  href="/login"
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-stone-950 transition"
                >
                  管理者ログイン
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>
            {scope === 'champions' && <DictionaryTab isAdmin={isAuthenticated} />}
            {scope === 'lane-guides' && <LaneGuidesView />}
            {scope === 'library' && <LibraryTabContent />}
            {scope === 'ingest' && <KnowledgeIngestView />}
            {scope === 'health' && <DictHealthView />}
          </>
        )}
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
