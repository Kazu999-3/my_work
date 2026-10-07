"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, X, Undo2 } from "lucide-react";
import LibraryControls from "./_library/LibraryControls";
import ArticleCard from "./_library/ArticleCard";
import ArticleDetailModal from "./_library/ArticleDetailModal";
import type { ArticleDetail, ArticleItem, LibraryCategory, LibrarySort } from "./_library/types";

// 攻略ライブラリ。状態と通信だけをここに置き、表示は _library/ の部品が持つ。
// 2026-10-07: 796行から分割（表示・動作は分割前と同じ）。使われていなかった KnowledgeIngestModal の重複
// （開くボタンが無く、取り込みは共通ナビ GlobalNavbar から開く）を削除。
function LibraryApp() {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") || "";
  const initialId = searchParams?.get("id") || null;
  // ?src=<元動画URL> … その動画から作られた記事の詳細を直接開く
  const initialSrc = searchParams?.get("src") || null;

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState(initialQ);
  const [loading, setLoading] = useState(true);

  // 🧭 カテゴリ切り替え ('lol' | 'general')
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('lol');
  const [counts, setCounts] = useState({ lol: 0, general: 0, all: 0 });

  // 📺 チャンネル絞り込み ＆ ⇅ ソート
  const [channels, setChannels] = useState<{ name: string; count: number }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<LibrarySort>('date_desc');

  // 選択中記事の詳細モーダル
  const [selectedId, setSelectedId] = useState<number | string | null>(initialId);
  const [detailArticle, setDetailArticle] = useState<ArticleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // 記事の削除（論理削除）と取り消し（2026-10-06）
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; undoId?: number | string } | null>(null);

  // 記事一覧フェッチ
  const fetchArticles = async (
    query = search,
    cat: LibraryCategory = activeCategory,
    chan = selectedChannel,
    sort: LibrarySort = selectedSort,
    append = false,
    offset = 0
  ) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetch(
        `/api/library?q=${encodeURIComponent(query)}&category=${cat}&channel=${encodeURIComponent(chan)}&sort=${sort}&limit=60&offset=${offset}`
      );
      const data = await res.json();
      if (res.ok && data.articles) {
        if (append) setArticles((prev) => [...prev, ...data.articles]);
        else setArticles(data.articles);
        setTotalCount(data.total || data.articles.length);
        if (data.counts) setCounts(data.counts);
        if (data.channels) setChannels(data.channels);
      }
    } catch (e) {
      console.error("ライブラリ取得エラー:", e);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || loading || articles.length >= totalCount) return;
    fetchArticles(search, activeCategory, selectedChannel, selectedSort, true, articles.length);
  };

  const handleCategoryChange = (cat: LibraryCategory) => {
    setActiveCategory(cat);
    setSelectedChannel(""); // カテゴリ変更時はチャンネルリセット
    fetchArticles(search, cat, "", selectedSort, false, 0);
  };

  const handleChannelChange = (chan: string) => {
    setSelectedChannel(chan);
    fetchArticles(search, activeCategory, chan, selectedSort, false, 0);
  };

  const handleSortChange = (sort: LibrarySort) => {
    setSelectedSort(sort);
    fetchArticles(search, activeCategory, selectedChannel, sort, false, 0);
  };

  useEffect(() => {
    if (initialQ) {
      setSearch(initialQ);
      fetchArticles(initialQ, "lol", "", "date_desc");
    } else {
      fetchArticles("", "lol", "", "date_desc");
    }

    if (initialId) {
      openDetail(initialId);
    } else if (initialSrc) {
      fetch(`/api/library?source=${encodeURIComponent(initialSrc)}&category=all&limit=1`)
        .then((r) => r.json())
        .then((d) => {
          const id = d?.articles?.[0]?.id;
          if (id) openDetail(id);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, initialId, initialSrc]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles(search);
  };

  // 単一記事詳細取得
  const openDetail = async (id: number | string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setCopied(false);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.article) setDetailArticle(data.article);
    } catch {}
    finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setSelectedId(null); setDetailArticle(null); };

  const handleDelete = async () => {
    if (!detailArticle || deleting) return;
    if (!window.confirm(`「${detailArticle.title}」をライブラリから削除しますか？
（辞典・レーンガイドに統合済みの内容は消えません。直後なら元に戻せます）`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detailArticle.id }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "削除に失敗しました");
      const removedId = detailArticle.id;
      setArticles((prev) => prev.filter((a) => a.id !== removedId));
      setTotalCount((n) => Math.max(0, n - 1));
      closeDetail();
      setNotice({ ok: true, text: d.message, undoId: removedId });
    } catch (e: any) {
      setNotice({ ok: false, text: e.message || "削除に失敗しました" });
    } finally {
      setDeleting(false);
    }
  };

  const handleUndoDelete = async (id: number | string) => {
    try {
      const res = await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, restore: true }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "元に戻せませんでした");
      setNotice({ ok: true, text: d.message });
      fetchArticles(search);
    } catch (e: any) {
      setNotice({ ok: false, text: e.message || "元に戻せませんでした" });
    }
  };

  const handleCopyContent = () => {
    if (!detailArticle) return;
    const body = detailArticle.content || detailArticle.raw_content || "";
    navigator.clipboard.writeText(`# ${detailArticle.title}\n\n${body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#101012] text-zinc-100 flex flex-col font-sans">
      {/* 📖 メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        <LibraryControls
          activeCategory={activeCategory}
          counts={counts}
          search={search}
          setSearch={setSearch}
          totalCount={totalCount}
          channels={channels}
          selectedChannel={selectedChannel}
          selectedSort={selectedSort}
          onCategoryChange={handleCategoryChange}
          onSearchSubmit={handleSearchSubmit}
          onChannelChange={handleChannelChange}
          onSortChange={handleSortChange}
        />

        {/* 記事一覧グリッド */}
        {loading ? (
          <div className="py-24 text-center text-amber-400 flex items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm font-bold">攻略ライブラリを検索中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} onOpen={() => openDetail(a.id)} />
              ))}
            </div>

            {/* さらに読み込む（Load More）ボタン */}
            {articles.length < totalCount && (
              <div className="pt-4 pb-8 flex flex-col items-center justify-center gap-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 font-bold border border-zinc-700/80 hover:border-amber-500/50 transition cursor-pointer flex items-center gap-2 shadow-sm text-xs disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>読み込み中...</span>
                    </>
                  ) : (
                    <>
                      <span>⬇️ さらに読み込む (+60件)</span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        (残り {totalCount - articles.length} 件)
                      </span>
                    </>
                  )}
                </button>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {articles.length} / {totalCount} 件表示中
                </div>
              </div>
            )}

            {articles.length >= totalCount && articles.length > 0 && (
              <div className="py-6 text-center text-xs text-zinc-500">
                ✅ 全 {totalCount} 件のアーカイブをすべて表示しました
              </div>
            )}
          </div>
        )}
      </main>

      {/* 削除・取り消しの通知 */}
      {notice && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100%-2rem)] px-4 py-2.5 rounded-xl border text-xs font-bold shadow-lg flex items-center gap-3 ${
          notice.ok ? "bg-emerald-950/90 border-emerald-800/60 text-emerald-400" : "bg-rose-950/90 border-rose-800/60 text-rose-400"
        }`}>
          <span className="min-w-0 break-words">{notice.text}</span>
          {notice.undoId != null && (
            <button
              onClick={() => handleUndoDelete(notice.undoId!)}
              className="shrink-0 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <Undo2 size={12} /> 元に戻す
            </button>
          )}
          <button onClick={() => setNotice(null)} className="shrink-0 text-zinc-400 hover:text-zinc-200 cursor-pointer" title="閉じる">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 記事詳細モーダル */}
      {selectedId && (
        <ArticleDetailModal
          detailArticle={detailArticle}
          detailLoading={detailLoading}
          copied={copied}
          deleting={deleting}
          onCopy={handleCopyContent}
          onDelete={handleDelete}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#101012] flex items-center justify-center text-amber-400">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LibraryApp />
    </Suspense>
  );
}
