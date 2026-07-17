"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, BookHeart, Brain, Swords, ArrowRight } from 'lucide-react';

const SOURCE_STYLE: Record<string, { color: string; icon: any }> = {
  'チャンピオン辞典': { color: 'text-[#c89b3c] border-[#c89b3c]/40 bg-[#c89b3c]/10', icon: BookHeart },
  'マッチアップメモ': { color: 'text-[#00cfef] border-[#00cfef]/40 bg-[#00cfef]/10', icon: Swords },
  'ナレッジ': { color: 'text-pink-400 border-pink-400/40 bg-pink-400/10', icon: Brain },
};

function SearchInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setMessage('2文字以上で検索してください。'); setResults([]); setSearched(true); return; }
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
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
    const q = params.get('q');
    if (q) { setQuery(q); runSearch(q); }
  }, [params, runSearch]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); runSearch(query); };

  const grouped = results.reduce((acc: Record<string, any[]>, r) => {
    (acc[r.source] = acc[r.source] || []).push(r);
    return acc;
  }, {});
  const order = ['チャンピオン辞典', 'マッチアップメモ', 'ナレッジ'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl md:text-4xl font-extrabold mb-2 flex items-center gap-3">
        <SearchIcon className="text-[#a78bfa]" size={32} /> 横断検索
      </h1>
      <p className="text-white/40 text-sm mb-6">チャンピオン辞典・マッチアップメモ・攻略ライブラリをまとめて検索します。</p>

      <form onSubmit={onSubmit} className="relative mb-6">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a78bfa]" size={20} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="チャンピオン名・キーワードで検索（例: Lillia, ガンク, ドラゴン）"
          className="w-full rounded-2xl border-2 border-white/10 bg-white/5 py-4 pl-12 pr-28 text-white placeholder-white/30 outline-none focus:border-[#a78bfa]/50 transition"
        />
        <button type="submit" disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[#a78bfa] text-black font-bold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? '検索中' : '検索'}
        </button>
      </form>

      {message && <p className="text-sm text-white/50 mb-4">{message}</p>}

      {searched && !loading && (
        <p className="text-xs text-white/40 mb-4">{results.length} 件ヒット</p>
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
                    className="block rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition p-4 group">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-white group-hover:text-[#a78bfa] transition truncate">
                        {(r.title || '').replace(/_/g, ' ')}
                      </h3>
                      <ArrowRight size={16} className="text-white/30 group-hover:text-[#a78bfa] shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {r.champion && <span className="text-[10px] text-white/50 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{r.champion}</span>}
                      {r.enemy && <span className="text-[10px] text-white/50 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">vs {r.enemy}</span>}
                    </div>
                    {r.snippet && <p className="text-sm text-white/50 mt-2 leading-relaxed line-clamp-2">{r.snippet}</p>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {searched && !loading && results.length === 0 && !message && (
        <div className="text-center py-16 text-white/40">
          <SearchIcon size={40} className="mx-auto mb-3 opacity-40" />
          <p>該当する情報が見つかりませんでした。</p>
        </div>
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
