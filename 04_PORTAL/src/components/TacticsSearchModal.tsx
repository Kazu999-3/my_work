"use client";

import React, { useState, useEffect, useDeferredValue } from 'react';
import { Search, X, Sparkles, BookOpen, Video, ExternalLink, Zap } from 'lucide-react';
import Image from 'next/image';
import { getChampIcon } from '../lib/ddragonClient';
import type { TacticsSearchResult } from '../app/api/tactics/search/route';

interface TacticsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChampion?: (champName: string) => void;
}

const POPULAR_CONCEPTS = [
  'インベード',
  'Lv3ガンク',
  'オブジェクト',
  'パワースパイク',
  'ウェーブ管理',
  'キルライン',
  'スプリットプッシュ',
  '没理由'
];

export default function TacticsSearchModal({ isOpen, onClose, onSelectChampion }: TacticsSearchModalProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<TacticsSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (!deferredQuery || deferredQuery.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/tactics/search?q=${encodeURIComponent(deferredQuery.trim())}&limit=25`, {
      signal: abortController.signal
    })
      .then(res => res.json())
      .then(data => {
        if (data.results) {
          setResults(data.results);
        } else {
          setResults([]);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message || '検索に失敗しました');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => abortController.abort();
  }, [deferredQuery, isOpen]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-10 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[85vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 bg-stone-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Zap size={18} className="fill-amber-500/20" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                戦術概念 逆引きインデックス
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold">RAG</span>
              </h3>
              <p className="text-xs text-stone-500">
                全30体のバイブル ＆ 170本超の動画解析からTips・立ち回りを即座に横断検索
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* 検索入力バー */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={18} />
            <input
              type="text"
              autoFocus
              placeholder="戦術キーワードを入力 (例: インベード, Lv3ガンク, オブジェクト放棄, 没理由)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 focus:bg-white rounded-2xl py-3 pl-10 pr-10 text-stone-900 font-bold outline-none transition text-sm shadow-2xs"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-200/60"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* クイックサジェストピル */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-stone-400 mr-1 flex items-center gap-1">
              <Sparkles size={12} /> おすすめ:
            </span>
            {POPULAR_CONCEPTS.map(concept => (
              <button
                key={concept}
                type="button"
                onClick={() => setQuery(concept)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  query === concept
                    ? 'bg-amber-500 text-stone-950 border-amber-500'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {concept}
              </button>
            ))}
          </div>
        </div>

        {/* 結果エリア */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
              <div className="w-6 h-6 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold">戦術バイブルを横断検索中...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold">
              エラー: {error}
            </div>
          )}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <div className="py-12 text-center text-stone-400">
              <p className="text-sm font-bold">「{query}」に一致する戦術Tipsは見つかりませんでした</p>
              <p className="text-xs mt-1 text-stone-500">別のキーワードや短い単語でお試しください</p>
            </div>
          )}

          {!loading && !error && query.trim().length < 2 && (
            <div className="py-12 text-center text-stone-400 space-y-2">
              <div className="text-3xl">🔍</div>
              <p className="text-sm font-bold text-stone-700">戦術概念キーワードを2文字以上入力してください</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                上のピルをタップするか、「インベード」「ガンク回避」「ウェーブ管理」などを検索すると該当チャンピオンのバイブルが即座に表示されます。
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-black text-stone-500 px-1">
                ヒット件数: {results.length} 件
              </div>

              {results.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (onSelectChampion && item.champion) {
                      onSelectChampion(item.champion);
                      onClose();
                    }
                  }}
                  className="group bg-stone-50/70 hover:bg-amber-50/40 border border-stone-200 hover:border-amber-300 p-3.5 rounded-2xl transition cursor-pointer flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.champion && (
                        <Image
                          src={getChampIcon(item.champion)}
                          alt={item.champion}
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-full border border-stone-200 shrink-0 object-cover"
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <span className="font-black text-stone-900 text-xs truncate">
                        {item.championJa} ({item.champion})
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.type === 'bible'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {item.type === 'bible' ? '戦術バイブル' : '動画解析Tips'}
                      </span>
                      <span className="text-[11px] font-bold text-stone-500 truncate">
                        › {item.section}
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-700 group-hover:translate-x-0.5 transition">
                      <span>辞典で開く</span>
                      <ExternalLink size={12} />
                    </div>
                  </div>

                  {/* スニペット本文 */}
                  <p className="text-xs text-stone-700 leading-relaxed pl-9 bg-white/60 p-2 rounded-xl border border-stone-200/60 font-medium">
                    {item.snippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-center text-[11px] text-stone-400 font-bold">
          ESCキーで閉じる • 該当チャンピオンをクリックして辞典へ直行
        </div>
      </div>
    </div>
  );
}
