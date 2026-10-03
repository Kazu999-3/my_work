"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  BookOpen, Search, RefreshCw, ChevronRight, X, ExternalLink, 
  Sparkles, Calendar, Tag, FileText, ArrowLeft, Copy, Check
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
}

function LibraryApp() {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") || "";
  const initialId = searchParams?.get("id") || null;

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
  const [selectedSort, setSelectedSort] = useState<'date_desc' | 'volume_desc' | 'date_asc' | 'title_asc'>('date_desc');

  // 選択中記事の詳細モーダル
  const [selectedId, setSelectedId] = useState<number | string | null>(initialId);
  const [detailArticle, setDetailArticle] = useState<ArticleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 記事一覧フェッチ
  const fetchArticles = async (
    query = search,
    cat: 'lol' | 'general' = activeCategory,
    chan = selectedChannel,
    sort = selectedSort
  ) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/library?q=${encodeURIComponent(query)}&category=${cat}&channel=${encodeURIComponent(chan)}&sort=${sort}&limit=60`
      );
      const data = await res.json();
      if (res.ok && data.articles) {
        setArticles(data.articles);
        setTotalCount(data.total || data.articles.length);
        if (data.counts) setCounts(data.counts);
        if (data.channels) setChannels(data.channels);
      }
    } catch (e) {
      console.error("ライブラリ取得エラー:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (cat: 'lol' | 'general') => {
    setActiveCategory(cat);
    setSelectedChannel(""); // カテゴリ変更時はチャンネルリセット
    fetchArticles(search, cat, "", selectedSort);
  };

  const handleChannelChange = (chan: string) => {
    setSelectedChannel(chan);
    fetchArticles(search, activeCategory, chan, selectedSort);
  };

  const handleSortChange = (sort: 'date_desc' | 'volume_desc' | 'date_asc' | 'title_asc') => {
    setSelectedSort(sort);
    fetchArticles(search, activeCategory, selectedChannel, sort);
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
    }
  }, [initialQ, initialId]);

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
              <option value="date_desc">📅 新しい順 (最新メタ)</option>
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
                    <span>{a.created_at ? a.created_at.split("T")[0] : "-"}</span>
                    <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                      詳細を読む <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 記事詳細モーダル */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80">
              <div className="min-w-0 flex-1 pr-3">
                <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block mb-0.5">
                  ARTICLE DETAIL
                </span>
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
