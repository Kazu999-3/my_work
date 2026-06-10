"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, BookOpen, X } from "lucide-react";
import Link from "next/link";
import { getChampIcon } from "../lib/ddragonClient";

// お気に入りデータの型
export interface FavoritesData {
  champions: string[]; // チャンピオンID (例: "Wukong", "Lillia")
  articles: { id: number; title: string }[]; // 記事ID + 短縮タイトル
}

// localStorageキー
const STORAGE_KEY = "sovereign_favorites";

// お気に入りの読み書きユーティリティ（外部からも使える）
export function getFavorites(): FavoritesData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { champions: [], articles: [] };
    return JSON.parse(raw);
  } catch {
    return { champions: [], articles: [] };
  }
}

export function saveFavorites(data: FavoritesData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // カスタムイベントで他コンポーネントに通知
  window.dispatchEvent(new CustomEvent("favorites-updated", { detail: data }));
}

export function toggleFavoriteChampion(champId: string): boolean {
  const favs = getFavorites();
  const idx = favs.champions.indexOf(champId);
  if (idx >= 0) {
    favs.champions.splice(idx, 1);
    saveFavorites(favs);
    return false; // 削除された
  } else {
    favs.champions.push(champId);
    saveFavorites(favs);
    return true; // 追加された
  }
}

export function toggleFavoriteArticle(id: number, title: string): boolean {
  const favs = getFavorites();
  const idx = favs.articles.findIndex((a) => a.id === id);
  if (idx >= 0) {
    favs.articles.splice(idx, 1);
    saveFavorites(favs);
    return false;
  } else {
    favs.articles.push({ id, title: title.substring(0, 30) });
    saveFavorites(favs);
    return true;
  }
}

export function isFavoriteChampion(champId: string): boolean {
  return getFavorites().champions.includes(champId);
}

export function isFavoriteArticle(id: number): boolean {
  return getFavorites().articles.some((a) => a.id === id);
}

// サイドバーに表示するお気に入りパネル
export default function FavoritesPanel() {
  const [favs, setFavs] = useState<FavoritesData>({ champions: [], articles: [] });

  const loadFavorites = useCallback(() => {
    setFavs(getFavorites());
  }, []);

  useEffect(() => {
    loadFavorites();
    // カスタムイベントでリアルタイム更新
    const handler = () => loadFavorites();
    window.addEventListener("favorites-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("favorites-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, [loadFavorites]);

  // お気に入りが空なら何も表示しない
  if (favs.champions.length === 0 && favs.articles.length === 0) return null;

  const removeChamp = (id: string) => {
    toggleFavoriteChampion(id);
  };

  const removeArticle = (id: number) => {
    const favData = getFavorites();
    const article = favData.articles.find((a) => a.id === id);
    if (article) toggleFavoriteArticle(id, article.title);
  };

  return (
    <div className="pt-4 border-t border-white/5">
      <h4 className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 px-2">
        <Star size={12} className="text-amber-400" /> お気に入り
      </h4>

      {/* チャンピオン一覧 */}
      {favs.champions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 px-2">
          {favs.champions.map((champId) => (
            <Link
              key={champId}
              href={`/champions?select=${champId}`}
              prefetch={false}
              className="relative group"
              title={champId}
            >
              <img
                src={getChampIcon(champId)}
                alt={champId}
                className="w-8 h-8 rounded-full border border-amber-400/30 hover:border-amber-400 transition-all hover:scale-110 hover:shadow-[0_0_10px_rgba(200,155,60,0.3)]"
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeChamp(champId);
                }}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full items-center justify-center text-white hidden group-hover:flex shadow"
              >
                <X size={8} />
              </button>
            </Link>
          ))}
        </div>
      )}

      {/* 記事一覧 */}
      {favs.articles.length > 0 && (
        <div className="space-y-1 px-1">
          {favs.articles.slice(0, 5).map((article) => (
            <div key={article.id} className="flex items-center gap-2 group">
              <Link
                href={`/library?article=${article.id}`}
                prefetch={false}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-[#a78bfa] hover:bg-white/5 transition-all truncate"
              >
                <BookOpen size={12} className="shrink-0 text-[#a78bfa]/50" />
                <span className="truncate">{article.title.replace(/_/g, " ")}</span>
              </Link>
              <button
                onClick={() => removeArticle(article.id)}
                className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {favs.articles.length > 5 && (
            <p className="text-[10px] text-gray-600 px-2">+{favs.articles.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
}
