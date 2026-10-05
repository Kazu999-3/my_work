'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { 
  BookOpen, Sparkles, RefreshCw, ChevronRight, Layers, 
  Clock, ArrowLeft, ExternalLink, Compass, Swords, Shield, Zap, Filter
} from 'lucide-react';
import LaneGuideOptimizeModal from '@/components/LaneGuideOptimizeModal';

interface LaneGuide {
  lane: string;
  title: string;
  body: string;
  source_count: number;
  updated_at: string;
}

interface LaneOption {
  key: string;
  label: string;
}

function LaneGuidesApp() {
  const [guides, setGuides] = useState<LaneGuide[]>([]);
  const [lanes, setLanes] = useState<LaneOption[]>([]);
  const [activeLane, setActiveLane] = useState<string>('JG');
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);

  const fetchGuides = useCallback(async (selectJgDefault = false) => {
    try {
      const res = await fetch('/api/lane-guides');
      const data = await res.json();
      if (data.success) {
        setGuides(data.guides || []);
        setLanes(data.lanes || []);
        if (selectJgDefault && data.guides && data.guides.length > 0) {
          const hasJg = data.guides.some((g: LaneGuide) => g.lane === 'JG');
          setActiveLane(hasJg ? 'JG' : data.guides[0].lane);
        }
      }
    } catch (e) {
      console.error('レーンガイド取得エラー:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuides(true);
  }, [fetchGuides]);

  const currentGuide = useMemo(() => {
    return guides.find((g) => g.lane === activeLane) || null;
  }, [guides, activeLane]);

  // 章（セクション）ごとの構造化パース
  const sections = useMemo(() => {
    if (!currentGuide?.body) return [];
    const raw = currentGuide.body;
    // '## ' で分割
    const parts = raw.split(/\n(?=##\s+)/);
    return parts.map((part, index) => {
      const lines = part.split('\n');
      const firstLine = lines[0] || '';
      const isHeading = firstLine.startsWith('## ');
      const title = isHeading ? firstLine.replace(/^##\s+/, '').trim() : (index === 0 ? 'イントロダクション' : `セクション ${index + 1}`);
      const content = isHeading ? lines.slice(1).join('\n').trim() : part.trim();
      const id = `section-${index}-${title.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-')}`;
      return { title, content, id, raw: part, index };
    });
  }, [currentGuide?.body]);

  // 目次（TOC）抽出
  const headings = useMemo(() => {
    return sections.map((sec) => ({
      text: sec.title,
      id: sec.id,
      index: sec.index,
    }));
  }, [sections]);

  // フィルタリングされたセクション
  const displayedSections = useMemo(() => {
    if (activeSectionFilter === 'ALL') return sections;
    return sections.filter((s) => s.id === activeSectionFilter);
  }, [sections, activeSectionFilter]);

  return (
    <div className="min-h-screen bg-[#101012] text-zinc-100 flex flex-col font-sans">
      {/* サブヘッダーバー */}
      <div className="bg-[#16161a] border-b border-zinc-800/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition border border-zinc-700 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} /> <span>← チャンピオン辞典へ戻る</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/library?q=${encodeURIComponent(activeLane)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 text-xs font-bold transition shadow-sm"
              title="このレーンの全ライブラリ記事を検索"
            >
              <BookOpen size={13} className="text-amber-400" />
              <span>📚 {activeLane} 関連記事をライブラリ検索</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 📖 メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* レーンセレクターバー */}
        <div className="flex items-center justify-between gap-3 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {lanes.map((l) => (
              <button
                key={l.key}
                onClick={() => {
                  setActiveLane(l.key);
                  setActiveSectionFilter('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeLane === l.key
                    ? 'bg-amber-500 text-zinc-950 shadow-sm scale-102'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {currentGuide && (
            <div className="text-[11px] text-zinc-400 font-bold shrink-0 hidden sm:block">
              全 <strong className="text-amber-400">{sections.length}</strong> 章構成 ｜ 統合ソース: <strong className="text-zinc-200">{currentGuide.source_count}</strong> 件
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-24 text-center text-amber-400 flex items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm font-bold">レーン攻略バイブルを読み込み中...</span>
          </div>
        ) : currentGuide ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* 左カラム: 目次 (TOC) & 章フィルター */}
            <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm sticky top-16 max-h-[85vh] overflow-y-auto hidden lg:block text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <Compass size={14} /> 章ナビゲーション
                </span>
                {activeSectionFilter !== 'ALL' && (
                  <button
                    onClick={() => setActiveSectionFilter('ALL')}
                    className="text-[10px] text-zinc-400 hover:text-amber-400 font-bold transition"
                  >
                    全表示に戻す
                  </button>
                )}
              </div>

              <ul className="space-y-1">
                {headings.map((h) => {
                  const isFiltered = activeSectionFilter === h.id;
                  return (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        onClick={(e) => {
                          if (activeSectionFilter !== 'ALL') {
                            e.preventDefault();
                            setActiveSectionFilter(h.id);
                          }
                        }}
                        className={`block px-2 py-1.5 rounded-lg transition text-xs font-semibold truncate ${
                          isFiltered
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                        }`}
                        title={h.text}
                      >
                        {h.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 右カラム: ガイド本文 (章別構造化カード) */}
            <div className="lg:col-span-3 space-y-4">
              {/* ガイドタイトルヘッダー */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/30">
                      {activeLane} BIBLE
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      最終更新: {currentGuide.updated_at ? currentGuide.updated_at.split('T')[0] : '2026'}
                    </span>
                  </div>
                  {activeSectionFilter !== 'ALL' && (
                    <button
                      onClick={() => setActiveSectionFilter('ALL')}
                      className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>全章表示に切り替え</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-zinc-100">
                    {currentGuide.title}
                  </h1>
                  <button
                    onClick={() => setIsOptimizeModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 text-xs font-black transition cursor-pointer shadow-sm"
                    title="第8章の蓄積知見を体系的各章へ統合・再構築"
                  >
                    <Sparkles size={13} className="text-amber-400" />
                    <span>🧠 AIガイド最適化・再構築</span>
                  </button>
                </div>
              </div>

              {/* 章ごとの構造化カード一覧 */}
              {displayedSections.map((sec) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-5 sm:p-6 shadow-sm transition space-y-3 scroll-mt-20"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <h2 className="text-sm sm:text-base font-black text-amber-400 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block" />
                      <span>{sec.title}</span>
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-950 text-zinc-500 font-mono border border-zinc-800">
                      CHAPTER #{sec.index + 1}
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans space-y-3">
                    {sec.content}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800">
            このレーンの攻略バイブルはまだ作成されていません。
          </div>
        )}
      </main>

      {/* 🧠 レーンガイドAI最適化・再構築モーダル */}
      <LaneGuideOptimizeModal
        lane={activeLane}
        laneLabel={currentGuide?.title || activeLane}
        isOpen={isOptimizeModalOpen}
        onClose={() => setIsOptimizeModalOpen(false)}
        onSuccess={() => fetchGuides(false)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#101012] flex items-center justify-center text-amber-400">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LaneGuidesApp />
    </Suspense>
  );
}
