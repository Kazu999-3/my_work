"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { 
  BookOpen, Sparkles, RefreshCw, ChevronRight, Layers, 
  Clock, ArrowLeft, ExternalLink, Compass, Swords, Shield, Zap
} from "lucide-react";
import KnowledgeIngestModal from "@/components/KnowledgeIngestModal";

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
  const [activeLane, setActiveLane] = useState<string>("TOP");
  const [loading, setLoading] = useState(true);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  useEffect(() => {
    fetch("/api/lane-guides")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGuides(data.guides || []);
          setLanes(data.lanes || []);
          if (data.guides && data.guides.length > 0) {
            setActiveLane(data.guides[0].lane);
          }
        }
      })
      .catch((e) => console.error("レーンガイド取得エラー:", e))
      .finally(() => setLoading(false));
  }, []);

  const currentGuide = useMemo(() => {
    return guides.find((g) => g.lane === activeLane) || null;
  }, [guides, activeLane]);

  // 目次（TOC）抽出
  const headings = useMemo(() => {
    if (!currentGuide?.body) return [];
    const lines = currentGuide.body.split("\n");
    const list: Array<{ text: string; level: number; id: string }> = [];
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "-");
        list.push({ text, level, id });
      }
    }
    return list;
  }, [currentGuide?.body]);

  return (
    <div className="min-h-screen bg-[#101012] text-zinc-100 flex flex-col font-sans">


      {/* 📖 メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* レーンセレクターバー */}
        <div className="flex items-center justify-between gap-3 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {lanes.map((l) => (
              <button
                key={l.key}
                onClick={() => setActiveLane(l.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeLane === l.key
                    ? "bg-amber-500 text-zinc-950 shadow-sm scale-102"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {currentGuide && (
            <div className="text-[11px] text-zinc-400 font-bold shrink-0 hidden sm:block">
              統合ソース: <strong className="text-amber-400">{currentGuide.source_count}</strong> 件
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
            {/* 左カラム: 目次 (TOC) */}
            <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm sticky top-16 max-h-[80vh] overflow-y-auto hidden lg:block text-xs">
              <span className="text-xs font-black text-amber-400 block mb-2.5 flex items-center gap-1.5">
                <Compass size={14} /> 目次ナビゲーション
              </span>
              <ul className="space-y-1.5">
                {headings.map((h, i) => (
                  <li
                    key={i}
                    style={{ paddingLeft: `${(h.level - 2) * 12}px` }}
                  >
                    <a
                      href={`#${h.id}`}
                      className="text-zinc-400 hover:text-amber-300 block truncate transition py-0.5"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* 右カラム: ガイド本文 (Markdownビュー) */}
            <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-7 shadow-sm space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/30">
                    {activeLane} BIBLE
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    最終更新: {currentGuide.updated_at ? currentGuide.updated_at.split("T")[0] : "-"}
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-black text-zinc-100">
                  {currentGuide.title}
                </h1>
              </div>

              {/* 本文プレビュー */}
              <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans space-y-4">
                {currentGuide.body}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800">
            このレーンの攻略バイブルはまだ作成されていません。
          </div>
        )}
      </main>

      <KnowledgeIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
      />
    </div>
  );
}

export default function LaneGuidesPage() {
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
