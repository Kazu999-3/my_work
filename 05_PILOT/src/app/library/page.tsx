"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  BookOpen, Search, RefreshCw, ChevronRight, X, ExternalLink, 
  Sparkles, Calendar, Tag, FileText, ArrowLeft, Copy, Check, Trash2, Undo2
} from "lucide-react";
import KnowledgeIngestModal from "@/components/KnowledgeIngestModal";
import { getChampIcon } from "@/lib/ddragonClient";

interface ArticleItem {
  id: number | string;
  title: string;
  champion?: string;
  channel?: string;
  char_count?: number;
  source_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  patch?: string;
  is_explicit_patch?: boolean;
  freshness?: 'fresh' | 'moderate' | 'stale';
  is_old_patch?: boolean;
  days_ago?: number;
  freshness_label?: string;
  freshness_color?: { bg: string; text: string; border: string };
}

interface ArticleDetail {
  id: number | string;
  title: string;
  champion?: string;
  source_url?: string;
  tags?: string[];
  content?: string;
  raw_content?: string;
  created_at: string;
  published_at?: string | null;
  patch?: string;
  is_explicit_patch?: boolean;
  freshness?: 'fresh' | 'moderate' | 'stale';
  is_old_patch?: boolean;
  days_ago?: number;
  freshness_label?: string;
  freshness_color?: { bg: string; text: string; border: string };
}

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
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // 🧭 カテゴリ切り替え ('lol' | 'general')
  const [activeCategory, setActiveCategory] = useState<'lol' | 'general'>('lol');
  const [counts, setCounts] = useState({ lol: 0, general: 0, all: 0 });

  // 📺 チャンネル絞り込み ＆ ⇅ ソート
  const [channels, setChannels] = useState<{ name: string; count: number }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<'date_desc' | 'published_desc' | 'volume_desc' | 'date_asc' | 'title_asc'>('date_desc');

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
    cat: 'lol' | 'general' = activeCategory,
    chan = selectedChannel,
    sort = selectedSort,
    append = false,
    offset = 0
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(
        `/api/library?q=${encodeURIComponent(query)}&category=${cat}&channel=${encodeURIComponent(chan)}&sort=${sort}&limit=60&offset=${offset}`
      );
      const data = await res.json();
      if (res.ok && data.articles) {
        if (append) {
          setArticles((prev) => [...prev, ...data.articles]);
        } else {
          setArticles(data.articles);
        }
        setTotalCount(data.total || data.articles.length);
        if (data.counts) setCounts(data.counts);
        if (data.channels) setChannels(data.channels);
      }
    } catch (e) {
      console.error("ライブラリ取得エラー:", e);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || loading || articles.length >= totalCount) return;
    fetchArticles(search, activeCategory, selectedChannel, selectedSort, true, articles.length);
  };

  const handleCategoryChange = (cat: 'lol' | 'general') => {
    setActiveCategory(cat);
    setSelectedChannel(""); // カテゴリ変更時はチャンネルリセット
    fetchArticles(search, cat, "", selectedSort, false, 0);
  };

  const handleChannelChange = (chan: string) => {
    setSelectedChannel(chan);
    fetchArticles(search, activeCategory, chan, selectedSort, false, 0);
  };

  const handleSortChange = (sort: 'date_desc' | 'volume_desc' | 'date_asc' | 'title_asc') => {
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
      if (res.ok && data.article) {
        setDetailArticle(data.article);
      }
    } catch {}
    finally {
      setDetailLoading(false);
    }
  };

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
      setSelectedId(null);
      setDetailArticle(null);
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
        {/* 🧭 カテゴリ切り替えタブ (LoL戦術 vs 一般・AIナレッジ) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-fit">
            <button
              onClick={() => handleCategoryChange('lol')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                activeCategory === 'lol'
                  ? 'bg-amber-500 text-zinc-950 shadow-md scale-102'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <span>🎮 LoL戦術アーカイブ</span>
              {counts.lol > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeCategory === 'lol' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-amber-300'
                }`}>
                  {counts.lol}
                </span>
              )}
            </button>

            <button
              onClick={() => handleCategoryChange('general')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                activeCategory === 'general'
                  ? 'bg-indigo-600 text-white shadow-md scale-102'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <span>💡 AI・一般ナレッジ</span>
              {counts.general > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeCategory === 'general' ? 'bg-indigo-950 text-indigo-200' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {counts.general}
                </span>
              )}
            </button>
          </div>

          <div className="text-xs text-zinc-400 font-bold px-1">
            {activeCategory === 'lol' ? (
              <span className="text-emerald-400 flex items-center gap-1">
                ✓ 全てチャンピオン辞典またはレーンガイドに直結済み
              </span>
            ) : (
              <span className="text-indigo-300">
                過去のAI開発・ChatGPT・note制作メモ（独立退避エリア）
              </span>
            )}
          </div>
        </div>

        {/* 検索バー ＆ カウンター */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96 flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="戦術記事・知見検索（タイトル、本文、チャンピオン）..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition cursor-pointer"
            >
              検索
            </button>
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  const urlMatch = clip.match(/https?:\/\/[^\s]+/i);
                  if (urlMatch) {
                    const res = await fetch('/api/youtube/queue', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: urlMatch[0] }),
                    });
                    const d = await res.json();
                    if (res.ok && d.success) {
                      alert(d.message || '✅ 解析キューに追加しました！');
                    } else {
                      alert(d.error || 'キュー追加に失敗しました');
                    }
                  } else {
                    const manual = prompt('YouTubeのURLを入力してください（Xの投稿は「ナレッジ取り込み」から）:');
                    if (manual) {
                      const res = await fetch('/api/youtube/queue', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: manual.trim() }),
                      });
                      const d = await res.json();
                      if (res.ok && d.success) {
                        alert(d.message || '✅ 解析キューに追加しました！');
                      } else {
                        alert(d.error || 'キュー追加に失敗しました');
                      }
                    }
                  }
                } catch {
                  const manual = prompt('YouTubeのURLを入力してください（Xの投稿は「ナレッジ取り込み」から）:');
                  if (manual) {
                    const res = await fetch('/api/youtube/queue', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: manual.trim() }),
                    });
                    const d = await res.json();
                    if (res.ok && d.success) {
                      alert(d.message || '✅ 解析キューに追加しました！');
                    } else {
                      alert(d.error || 'キュー追加に失敗しました');
                    }
                  }
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="コピーしたYouTubeのURLを解析キューに即追加"
            >
              <Sparkles size={13} className="text-indigo-400" />
              <span>📋 URL投函</span>
            </button>
            <div className="text-xs text-zinc-400 font-bold px-1">
              全 <strong className="text-amber-400">{totalCount}</strong> 件の戦術アーカイブ
            </div>
          </div>
        </div>

        {/* 📺 チャンネル絞り込み ＆ ⇅ ソートバー */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800/80 shadow-xs">
          {/* 📺 チャンネルセレクター */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-zinc-400 shrink-0 flex items-center gap-1">
              <span>📺</span>
              <span>チャンネル:</span>
            </span>
            <select
              value={selectedChannel}
              onChange={(e) => handleChannelChange(e.target.value)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500/80 max-w-64 cursor-pointer"
            >
              <option value="">全チャンネル ({totalCount}件)</option>
              {channels.map((ch) => (
                <option key={ch.name} value={ch.name}>
                  {ch.name} ({ch.count}件)
                </option>
              ))}
            </select>
            {selectedChannel && (
              <button
                onClick={() => handleChannelChange("")}
                className="text-[11px] text-zinc-400 hover:text-rose-400 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 transition cursor-pointer"
                title="チャンネル絞り込み解除"
              >
                ✕ 解除
              </button>
            )}
          </div>

          {/* ⇅ ソートセレクター */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
              <span>⇅</span>
              <span>並び替え:</span>
            </span>
            <select
              value={selectedSort}
              onChange={(e) => handleSortChange(e.target.value as any)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500/80 cursor-pointer"
            >
              <option value="date_desc">📅 取り込み順 (最新)</option>
              <option value="published_desc">📺 動画公開順 (最新)</option>
              <option value="volume_desc">📚 ボリューム順 (文字数)</option>
              <option value="date_asc">⏳ 古い順 (時系列)</option>
              <option value="title_asc">🔤 タイトル順 (五十音)</option>
            </select>
          </div>
        </div>

        {/* 記事一覧グリッド */}
        {loading ? (
          <div className="py-24 text-center text-amber-400 flex items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm font-bold">攻略ライブラリを検索中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {articles.map((a) => {
                const champs = a.champion ? a.champion.split(",").map(c => c.trim()).filter(Boolean) : [];
                return (
                  <div
                    key={a.id}
                    onClick={() => openDetail(a.id)}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer flex flex-col justify-between gap-3 shadow-xs hover:bg-zinc-850"
                  >
                    <div className="space-y-2">
                      {/* 🏷️ パッチ ＆ 鮮度バッジ */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {a.patch && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono text-[10px] font-bold border border-zinc-700">
                            🏷️ Patch {a.patch}
                          </span>
                        )}
                        {a.is_old_patch ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-950/70 text-rose-300 border border-rose-500/50 text-[10px] font-bold flex items-center gap-1">
                            ⚠️ 旧パッチ {a.days_ago ? `(${Math.floor(a.days_ago / 30)}ヶ月前)` : ''}
                          </span>
                        ) : a.freshness === 'fresh' ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            🟢 現行メタ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                            🟡 1〜2パッチ前
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-xs text-zinc-100 line-clamp-2 leading-snug hover:text-amber-300 transition">
                          {a.title}
                        </h3>
                        {champs.length > 0 && (
                          <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                            <img
                              src={getChampIcon(champs[0])}
                              alt={champs[0]}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* 📺 チャンネル ＆ 文字数バッジ */}
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5 flex-wrap">
                        {a.channel && a.channel !== "その他・一般" && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-bold border border-zinc-700/60 truncate max-w-40">
                            📺 {a.channel}
                          </span>
                        )}
                        {a.char_count && a.char_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-zinc-950 text-amber-400/90 font-mono border border-zinc-800 font-bold">
                            約{a.char_count.toLocaleString()}字
                          </span>
                        )}
                      </div>

                      {/* 🎯 紐付き先ジャンプ（チャンピオン辞典 または レーンガイド） */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
                        {champs.filter(c => c !== "Unknown").map((c) => (
                          <Link
                            key={c}
                            href={`/?c=${encodeURIComponent(c)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition font-black"
                            title={`${c} のチャンピオン辞典・ビルドへジャンプ`}
                          >
                            <img
                              src={getChampIcon(c)}
                              alt={c}
                              className="w-4 h-4 rounded-full object-cover border border-amber-400/40"
                              onError={(ev) => { (ev.target as HTMLElement).style.display = 'none'; }}
                            />
                            <span>{c} 辞典 ↗</span>
                          </Link>
                        ))}

                        {(!a.champion || a.champion === "Unknown" || champs.length === 0) && (
                          <Link
                            href="/lane-guides"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 transition font-black"
                            title="全JG共通の普遍的マクロ（レーンガイド）へジャンプ"
                          >
                            <span>📚 レーンガイド(JG) ↗</span>
                          </Link>
                        )}

                        {a.tags && Array.isArray(a.tags) && a.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 text-[10px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2">
                      <div className="flex items-center gap-2">
                        {a.published_at ? (
                          <span className="text-zinc-400 font-mono" title={`YouTube公開日: ${a.published_at}`}>
                            📺 公開: {a.published_at}
                          </span>
                        ) : (
                          <span title="取込日">📅 取込: {a.created_at ? a.created_at.split("T")[0] : "-"}</span>
                        )}
                      </div>
                      <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                        詳細を読む <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">
                    ARTICLE DETAIL
                  </span>
                  {detailArticle?.patch && (
                    <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono text-[10px] font-bold border border-zinc-700">
                      🏷️ Patch {detailArticle.patch}
                    </span>
                  )}
                  {detailArticle?.is_old_patch ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-950/70 text-rose-300 border border-rose-500/50 text-[10px] font-bold">
                      ⚠️ 旧パッチ {detailArticle.days_ago ? `(${Math.floor(detailArticle.days_ago / 30)}ヶ月前)` : ''}
                    </span>
                  ) : detailArticle?.freshness === 'fresh' ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      🟢 現行メタ
                    </span>
                  ) : detailArticle?.freshness === 'moderate' ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      🟡 1〜2パッチ前
                    </span>
                  ) : null}
                  {detailArticle?.published_at && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      📺 {detailArticle.published_at} 公開
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-black text-zinc-100 truncate">
                  {detailArticle?.title || "記事読み込み中..."}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyContent}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="本文をコピー"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? "コピー完了" : "コピー"}</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!detailArticle || deleting}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/60 text-rose-400 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="この記事をライブラリから削除"
                >
                  <Trash2 size={13} />
                  <span>{deleting ? "削除中..." : "削除"}</span>
                </button>
                <button
                  onClick={() => { setSelectedId(null); setDetailArticle(null); }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
              {detailLoading ? (
                <div className="py-20 text-center text-zinc-500">記事データを取得中...</div>
              ) : detailArticle ? (
                <>
                  {/* ⚠️ 旧パッチ警告バナー */}
                  {detailArticle.is_old_patch && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                      <span className="text-base shrink-0">⚠️</span>
                      <div className="space-y-0.5">
                        <div className="font-bold text-rose-300">
                          旧パッチ・過去環境のアーカイブです (推定 Patch {detailArticle.patch} / 公開: {detailArticle.published_at || '不明'})
                        </div>
                        <p className="text-[11px] text-rose-300/80 leading-snug">
                          アイテム・ルーンの数値仕様やジャングルペットの仕様など、現在の最新シーズン仕様と乖離している可能性があります。普遍的なマクロや判断原則を中心に参考にしてください。
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 双方向連携バナー */}
                  {detailArticle.champion && detailArticle.champion !== "Unknown" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={getChampIcon(detailArticle.champion)}
                          alt={detailArticle.champion}
                          className="w-6 h-6 rounded-md object-cover border border-indigo-400"
                        />
                        <span className="font-bold text-indigo-200">
                          対象チャンピオン: {detailArticle.champion}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/?c=${encodeURIComponent(detailArticle.champion)}`}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition flex items-center gap-1"
                        >
                          👑 辞典でビルド・思考録を見る
                        </Link>
                        <Link
                          href={`/coach?my=${encodeURIComponent(detailArticle.champion)}`}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          🤖 AIコーチで設計図を見る
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-emerald-400" />
                        <span className="font-bold text-emerald-200">
                          分類: 全JG共通の普遍的マクロ知見
                        </span>
                      </div>
                      <Link
                        href="/lane-guides"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition flex items-center gap-1"
                      >
                        📚 レーンガイド（JG章）で読む ↗
                      </Link>
                    </div>
                  )}

                  {detailArticle.source_url && (
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] flex items-center justify-between gap-2">
                      <span className="text-zinc-400 truncate">元ソース: {detailArticle.source_url}</span>
                      <a
                        href={detailArticle.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:text-amber-300 font-bold shrink-0 flex items-center gap-0.5"
                      >
                        開く <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {detailArticle.content || detailArticle.raw_content || "本文がありません"}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-zinc-500">記事の取得に失敗しました。</div>
              )}
            </div>
          </div>
        </div>
      )}

      <KnowledgeIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
      />
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
