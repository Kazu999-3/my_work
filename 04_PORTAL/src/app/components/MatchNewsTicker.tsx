'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, Trophy, Flame, Sparkles, ChevronRight, RefreshCw, MessageSquareQuote } from 'lucide-react';

interface NewsItem {
  id: string;
  matchId: string | number;
  createdAt: string;
  winningTeam: 'BLUE' | 'RED';
  article: {
    headline: string;
    subheadline: string;
    lead: string;
    mvp: {
      name: string;
      champion?: string;
      kda: string;
      role: string;
      comment: string;
    };
    turningPoint: string;
    interviewQuote: string;
    sideStory: string;
  };
}

export default function MatchNewsTicker() {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/match/news?limit=3');
      const data = await res.json();
      if (data.success && Array.isArray(data.news)) {
        setNewsList(data.news);
        if (data.news.length > 0) {
          setExpandedId(data.news[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch match news:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  if (loading && newsList.length === 0) return null;
  if (!loading && newsList.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-2 border-amber-400/60 dark:border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-amber-300/40 dark:border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-sm shadow-xs">
            📰
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                <span>月刊KTMスポーツ速報</span>
                <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                  号外
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              直近の公式カスタム試合結果をAIデスクが面白ダイジェスト実況！
            </p>
          </div>
        </div>

        <Link
          href="/history"
          className="text-xs font-black text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5"
        >
          <span>過去の試合</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ニュースカード */}
      <div className="space-y-3">
        {newsList.map((item) => {
          const art = item.article;
          if (!art) return null;
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'bg-white/95 dark:bg-[#2b2d31]/95 border-amber-400 dark:border-amber-500/40 shadow-md'
                  : 'bg-white/60 dark:bg-[#2b2d31]/60 border-stone-200/80 dark:border-[#3f4147] hover:border-amber-300'
              }`}
            >
              {/* ヘッドラインバー（クリックで展開・折りたたみ） */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full text-left p-3.5 sm:p-4 flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      item.winningTeam === 'BLUE'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-rose-300 border border-red-300'
                    }`}>
                      {item.winningTeam === 'BLUE' ? '🟦 BLUE勝利' : '🟥 RED勝利'}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {new Date(item.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-stone-900 dark:text-white leading-snug hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
                    {art.headline}
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-300 font-bold truncate">
                    {art.subheadline}
                  </p>
                </div>

                <span className="text-xs text-stone-400 font-bold shrink-0 pt-1">
                  {isExpanded ? '閉じる ▲' : '読む ▼'}
                </span>
              </button>

              {/* 記事詳細（展開時） */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-stone-100 dark:border-stone-800 space-y-3.5 text-xs text-stone-700 dark:text-stone-200 animate-in fade-in">
                  {/* リード文 */}
                  <p className="leading-relaxed font-sans text-stone-800 dark:text-stone-100 text-[13px] bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/40">
                    {art.lead}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* MVP寸評 */}
                    {art.mvp && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#1e1f22] border border-stone-200 dark:border-stone-700 space-y-1">
                        <div className="flex items-center gap-1.5 font-black text-amber-700 dark:text-amber-400">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>本日のMVP: {art.mvp.name} 選手 ({art.mvp.role})</span>
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          KDA: <strong className="text-stone-800 dark:text-white">{art.mvp.kda}</strong>
                        </div>
                        <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-tight">
                          {art.mvp.comment}
                        </p>
                      </div>
                    )}

                    {/* ターニングポイント */}
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#1e1f22] border border-stone-200 dark:border-stone-700 space-y-1">
                      <div className="flex items-center gap-1.5 font-black text-rose-700 dark:text-rose-400">
                        <Flame className="w-3.5 h-3.5" />
                        <span>勝負の分水嶺</span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                        {art.turningPoint}
                      </p>
                    </div>
                  </div>

                  {/* 試合後インタビュー ＆ サイドストーリー */}
                  <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 italic text-stone-600 dark:text-stone-300">
                      <MessageSquareQuote className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>「{art.interviewQuote}」</span>
                    </div>
                    {art.sideStory && (
                      <span className="text-stone-500 dark:text-stone-400 font-medium">
                        💡 {art.sideStory}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
