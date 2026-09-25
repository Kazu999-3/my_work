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
const DictHealthView = dynamic(() => import('../admin/dict-health/page'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
});

type KnowledgeScope = 'champions' | 'health';

function ChampionsShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawScope = searchParams.get('scope');

  // 後方互換：古い埋め込みスコープでアクセスされた場合は独立URLへ安全にリダイレクト
  useEffect(() => {
    if (rawScope === 'lane-guides') {
      router.replace('/lane-guides');
    } else if (rawScope === 'library') {
      router.replace('/library');
    } else if (rawScope === 'ingest' || rawScope === 'knowledge') {
      router.replace('/admin/knowledge');
    }
  }, [rawScope, router]);

  const [scope, setScope] = useState<KnowledgeScope>(
    rawScope === 'health' || rawScope === 'maintenance' ? 'health' : 'champions'
  );
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
              <Link
                href="/admin/guide"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition flex items-center gap-1"
                title="LoLデータ収集＆辞典＆コーチ連携の全貌仕様ガイド"
              >
                <span>📖 全貌ガイド</span>
              </Link>
            </>
          )}
        </div>
      </motion.header>

      {/* メインコンテンツ */}
      <div className="flex-1 min-w-0">
        {scope === 'champions' && <DictionaryTab isAdmin={isAuthenticated} />}
        {scope === 'health' && <DictHealthView />}
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
