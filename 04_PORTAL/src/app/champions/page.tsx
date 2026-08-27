"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookOpen, Activity, Map, Brain, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

// 各サブモジュールを遅延読み込み
const DictionaryTab = dynamic(() => import('./tabs/DictionaryTab'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
});
const LaneGuidesView = dynamic(() => import('../lane-guides/page'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div></div>
});
const KnowledgeAdminView = dynamic(() => import('../admin/knowledge/page'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin"></div></div>
});
const DictHealthView = dynamic(() => import('../admin/dict-health/page'), {
  loading: () => <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
});

type KnowledgeScope = 'champions' | 'lane-guides' | 'knowledge' | 'health';

const SCOPES: { id: KnowledgeScope; label: string; icon: any; color: string; activeBg: string }[] = [
  { id: 'champions', label: '👑 チャンピオン辞典', icon: BookOpen, color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15 text-[#c89b3c] border-[#c89b3c]/40' },
  { id: 'lane-guides', label: '🗺️ レーン・マクロ', icon: Map, color: 'text-sky-500', activeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/40' },
  { id: 'knowledge', label: '📝 ナレッジメモ', icon: Brain, color: 'text-pink-500', activeBg: 'bg-pink-500/15 text-pink-600 border-pink-500/40' },
  { id: 'health', label: '⚠️ ヘルス診断・キュー', icon: Activity, color: 'text-amber-500', activeBg: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
];

function ChampionsShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialScope = (searchParams.get('scope') as KnowledgeScope) || 'champions';
  const [scope, setScope] = useState<KnowledgeScope>(initialScope);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleScopeChange = (newScope: KnowledgeScope) => {
    setScope(newScope);
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', newScope);
    router.replace(`/champions?${params.toString()}`, { scroll: false });
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm rounded-2xl border border-black/10 bg-black/[0.03] p-8 backdrop-blur">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2 text-stone-900">認証が必要です</h2>
          <p className="text-sm text-stone-500 mb-6 leading-relaxed">
            攻略ナレッジハブは管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-[#c89b3c] px-5 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 md:p-6 lg:p-8 max-w-[1760px] w-full mx-auto flex flex-col gap-5">
      {/* 統合ナレッジヘッダー ＆ スコープ切り替えバー */}
      <motion.header 
        initial={{ y: -10, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-stone-200"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
            <span className="text-gradient text-gradient-gold">攻略ナレッジハブ</span>
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            チャンピオン・レーン戦略・AI知見・ファクトチェックを一元管理する統合ワークスペース
          </p>
        </div>

        {/* スコープ切り替えタブ */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl overflow-x-auto max-w-full">
          {SCOPES.map((s) => {
            const isActive = scope === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleScopeChange(s.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none ${
                  isActive
                    ? `bg-white shadow-sm ${s.color} border border-stone-200/60 font-black`
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
                }`}
              >
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </motion.header>

      {/* スコープに応じたゼロ遷移ビュー */}
      <div className="flex-1">
        {scope === 'champions' && <DictionaryTab isAdmin={true} />}
        {scope === 'lane-guides' && <LaneGuidesView />}
        {scope === 'knowledge' && <KnowledgeAdminView />}
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
