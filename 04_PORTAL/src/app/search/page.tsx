"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, BookHeart, Brain, Swords, ArrowRight } from 'lucide-react';
import { EmptyState } from '../../components/Feedback';

const SOURCE_STYLE: Record<string, { color: string; icon: any }> = {
  'チャンピオン辞典': { color: 'text-gold border-[#c89b3c]/40 bg-[#c89b3c]/10', icon: BookHeart },
  'マッチアップメモ': { color: 'text-cyan-700 border-cyan-200 bg-cyan-100', icon: Swords },
  'ナレッジ': { color: 'text-pink-700 border-pink-200 bg-pink-100', icon: Brain },
};

function SearchInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');
  // 辞典本体・ナレッジ本文は閲覧含め管理者専用。Sidebarのメニュー表示だけでは
  // URL直叩きを防げないため、champions/pageと同じ認証ガードを追加する(2026-08-05発覚)。
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setMessage('2文字以上で検索してください。'); setResults([]); setSearched(true); return; }
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '検索に失敗しました');
      setResults(data.results || []);
      setMessage(data.message || '');
    } catch (e: any) {
      setMessage('❌ ' + e.message); setResults([]);
    } finally { setLoading(false); setSearched(true); }
  }, []);

  // URL ?q= があれば初回検索
  useEffect(() => {
    if (isAuthenticated !== true) return;
    const q = params.get('q');
    if (q) { setQuery(q); runSearch(q); }
  }, [params, runSearch, isAuthenticated]);

  // 入力時の 300ms デバウンス自動検索
  useEffect(() => {
    if (isAuthenticated !== true) return;
    if (!query || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, runSearch, isAuthenticated]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); runSearch(query); };

  const grouped = results.reduce((acc: Record<string, any[]>, r) => {
    (acc[r.source] = acc[r.source] || []).push(r);
    return acc;
  }, {});
  const order = ['チャンピオン辞典', 'マッチアップメモ', 'ナレッジ'];

  if (isAuthenticated === null) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (isAuthenticated === false) {
    return (
      <div className="max-w-sm mx-auto mt-20 text-center rounded-2xl border border-black/10 bg-black/[0.03] p-8 backdrop-blur">
        <div className="text-4xl mb-4">🔑</div>
        <h2 className="text-lg font-bold mb-2 text-stone-900">認証が必要です</h2>
        <p className="text-sm text-stone-500 mb-6 leading-relaxed">横断検索は辞典・ナレッジ本文を含むため管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。</p>
        <a href="/login" className="inline-block w-full rounded-xl bg-[#a78bfa] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90">ログインページへ</a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-stone-900">
      <h1 className="text-3xl md:text-4xl font-extrabold mb-2 flex items-center gap-3">
        <SearchIcon className="text-[#a78bfa]" size={32} /> 横断検索
      </h1>
      <p className="text-stone-500 text-sm mb-6">チャンピオン辞典・マッチアップメモ・攻略ライブラリをまとめて検索します。</p>

      <form onSubmit={onSubmit} className="relative mb-6">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a78bfa]" size={20} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="チャンピオン名・キーワードで検索（例: Lillia, ガンク, ドラゴン）"
          className="w-full rounded-2xl border-2 border-black/10 bg-white py-4 pl-12 pr-28 text-stone-900 placeholder-stone-400 outline-none focus:border-[#a78bfa]/50 transition"
        />
        <button type="submit" disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[#a78bfa] text-black font-bold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? '検索中' : '検索'}
        </button>
      </form>

      {message && <p className="text-sm text-stone-500 mb-4">{message}</p>}

      {searched && !loading && (
        <p className="text-xs text-stone-500 mb-4">{results.length} 件ヒット</p>
      )}

      <div className="space-y-6">
        {order.filter((s) => grouped[s]?.length).map((source) => {
          const st = SOURCE_STYLE[source];
          const Icon = st.icon;
          return (
            <div key={source}>
              <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border mb-3 ${st.color}`}>
                <Icon size={13} /> {source} ({grouped[source].length})
              </div>
              <div className="space-y-2">
                {grouped[source].map((r: any, i: number) => (
                  <Link key={i} href={r.url}
                    className="block rounded-xl border border-black/10 bg-white/60 hover:bg-white hover:border-black/20 transition p-4 group">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-stone-900 group-hover:text-[#a78bfa] transition truncate">
                        {(r.title || '').replace(/_/g, ' ')}
                      </h3>
                      <ArrowRight size={16} className="text-stone-400 group-hover:text-[#a78bfa] shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {r.champion && <span className="text-[10px] text-stone-500 bg-black/5 border border-black/10 rounded px-1.5 py-0.5">{r.champion}</span>}
                      {r.enemy && <span className="text-[10px] text-stone-500 bg-black/5 border border-black/10 rounded px-1.5 py-0.5">vs {r.enemy}</span>}
                    </div>
                    {r.snippet && <p className="text-sm text-stone-500 mt-2 leading-relaxed line-clamp-2">{r.snippet}</p>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {searched && !loading && results.length === 0 && !message && (
        <EmptyState
          icon={<SearchIcon size={26} />}
          title="該当する情報が見つかりませんでした"
          message="キーワードを変えるか、辞典・ナレッジにメモを追加すると検索対象が増えます。"
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin" /></div>}>
      <SearchInner />
    </Suspense>
  );
}
