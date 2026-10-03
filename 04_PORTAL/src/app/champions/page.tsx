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
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-edge-strong border-t-transparent rounded-full animate-spin"></div></div>
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
      {/* 🚀 新鋭パイロット完全移行バナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-primary-500/10 to-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl p-2 bg-amber-500/20 rounded-xl border border-amber-500/30 shrink-0">🚀</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base text-amber-500">新鋭戦術パイロット (KTM Pilot) へ完全移行しました</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">新SSoT</span>
            </div>
            <p className="text-xs text-foreground-soft mt-0.5">
              173体全チャンプのOP.GG公式Tier・勝率、動画バイブル、HUD直結機能は新コックピットで稼働中です。
            </p>
          </div>
        </div>
        <a
          href="https://ktm-pilot.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition shadow-sm"
        >
          KTM Pilotを開く ➔
        </a>
      </div>
      {/* 洗練されたクリーンな辞典ヘッダー */}
      <motion.header 
        initial={{ y: -6, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.2 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 bg-surface border border-border/80 rounded-2xl shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl p-1.5 bg-primary-50 rounded-xl border border-primary-edge-soft/60 shrink-0">👑</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground">チャンピオン攻略辞典</h1>
              <span className="px-2 py-0.5 rounded-full bg-primary-100/70 border border-primary-edge/60 text-primary-800 text-[10px] font-extrabold">
                {isAuthenticated ? '管理者' : '攻略モード'}
              </span>
            </div>
            <p className="text-[11px] text-muted-strong font-medium">
              チャレンジャー実戦データ・立ち回り・ビルド・対面相性アーカイブ
            </p>
          </div>
        </div>

        {/* 中央: チャンピオン攻略 ＆ 辞典ヘルス 切替タブ */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-subtle rounded-xl border border-border self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleScopeChange('champions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              scope === 'champions'
                ? 'bg-surface text-foreground shadow-xs font-black scale-101'
                : 'text-muted hover:text-foreground hover:bg-surface-hover/60'
            }`}
          >
            <span>👑 チャンピオン攻略</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange('health')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              scope === 'health'
                ? 'bg-surface text-primary-700 shadow-xs font-black scale-101'
                : 'text-muted hover:text-foreground hover:bg-surface-hover/60'
            }`}
          >
            <span>🩺 辞典ヘルス</span>
          </button>
        </div>

        {/* 右側の整理されたクイックリンク */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          <Link
            href="/lane-guides"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-muted hover:text-foreground hover:bg-surface-subtle border border-border transition flex items-center gap-1"
          >
            <span>📖 レーン攻略</span>
          </Link>
          {isAuthenticated && (
            <>
              <Link
                href="/library"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary-700 hover:text-primary-900 bg-primary-50 hover:bg-primary-100/80 border border-primary-edge-soft transition flex items-center gap-1"
              >
                <span>📒 攻略ライブラリ</span>
              </Link>
              <Link
                href="/admin/knowledge"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-danger-700 hover:text-danger-900 bg-danger-50 hover:bg-danger-100/80 border border-danger-edge-soft transition flex items-center gap-1"
              >
                <span>📥 戦術取込</span>
              </Link>
              <Link
                href="/admin/guide"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary-800 hover:text-primary-950 bg-primary-50 hover:bg-primary-100/80 border border-primary-edge-soft transition flex items-center gap-1"
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
