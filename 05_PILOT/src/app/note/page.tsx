'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Copy, Check, BookOpen, Clock, Tag, ChevronDown, ChevronUp, Sparkles, ExternalLink 
} from 'lucide-react';

interface NoteDraft {
  id: string;
  filename: string;
  title: string;
  meta: Record<string, string>;
  charCount: number;
  headings: Array<{ level: number; text: string }>;
  content: string;
  updatedAt: string;
}

export default function NoteDraftsPage() {
  const [drafts, setDrafts] = useState<NoteDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    fetch('/api/note')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.drafts?.length > 0) {
          setDrafts(data.drafts);
          // デフォルトで最初の記事（ザイラJGまたは最新）を選択
          setSelectedId(data.drafts[0].id);
        }
      })
      .catch((err) => console.error('Failed to load drafts:', err))
      .finally(() => setLoading(false));
  }, []);

  const currentDraft = drafts.find((d) => d.id === selectedId) || drafts[0];

  const handleCopy = () => {
    if (!currentDraft) return;
    navigator.clipboard.writeText(currentDraft.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // 簡易 Markdown レンダラー（スマホでの読みやすさ特化）
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: string[] = [];

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={key} className="space-y-2 my-3 pl-4 list-disc list-outside text-zinc-300 text-sm leading-relaxed">
            {listItems.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    const parseInline = (str: string) => {
      // **太字** の変換
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="text-amber-300 font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // リスト項目の判定
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        listItems.push(trimmed.slice(2));
        return;
      } else {
        if (inList) {
          flushList(`list-${index}`);
          inList = false;
        }
      }

      // H1 見出し
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-xl sm:text-2xl font-black text-amber-400 mt-6 mb-4 pb-2 border-b border-amber-500/30">
            {line.slice(2)}
          </h1>
        );
        return;
      }

      // H2 見出し
      if (line.startsWith('## ')) {
        const text = line.slice(3);
        const anchor = text.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '-');
        elements.push(
          <h2 id={anchor} key={index} className="text-lg sm:text-xl font-black text-zinc-100 mt-8 mb-3 pt-2 flex items-center gap-2 border-b border-zinc-800 pb-1.5">
            <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block"></span>
            {text}
          </h2>
        );
        return;
      }

      // H3 見出し
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-base sm:text-lg font-bold text-amber-200/90 mt-5 mb-2">
            {line.slice(4)}
          </h3>
        );
        return;
      }

      // 引用
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={index} className="border-l-4 border-amber-500/60 bg-amber-950/20 px-4 py-2.5 rounded-r-lg my-3 text-zinc-300 text-sm italic">
            {parseInline(line.slice(2))}
          </blockquote>
        );
        return;
      }

      // 区切り線
      if (trimmed === '---') {
        elements.push(<hr key={index} className="border-zinc-800 my-6" />);
        return;
      }

      // 空行
      if (!trimmed) {
        elements.push(<div key={index} className="h-3" />);
        return;
      }

      // 通常段落
      elements.push(
        <p key={index} className="text-zinc-200 text-sm sm:text-base leading-relaxed my-2.5">
          {parseInline(line)}
        </p>
      );
    });

    if (inList) {
      flushList('list-end');
    }

    return elements;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-300 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <Sparkles className="w-5 h-5 animate-spin" />
          <span>note ドラフトを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-20">
      {/* 📱 トップ固定コントロールヘッダー */}
      <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-3 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          
          {/* 記事切り替えタブ */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
            {drafts.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  d.id === selectedId
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {d.title.length > 16 ? d.title.slice(0, 16) + '…' : d.title}
              </button>
            ))}
          </div>

          {/* コピーボタン（目立つ主役） */}
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-md ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/40'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>コピー完了！</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>全文コピー</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      {currentDraft && (
        <main className="max-w-3xl mx-auto px-4 py-6">
          
          {/* 記事メタ情報カード */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40">
                📝 note下書き
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[11px] font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                {currentDraft.charCount.toLocaleString()} 文字
              </span>
              {currentDraft.meta?.target_rank && (
                <span className="px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/60 text-[11px] font-bold">
                  🎯 {currentDraft.meta.target_rank}
                </span>
              )}
            </div>

            <h1 className="text-base sm:text-xl font-black text-white leading-snug mb-3">
              {currentDraft.title}
            </h1>

            {/* 目次トグルボタン */}
            {currentDraft.headings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800/80">
                <button
                  onClick={() => setShowToc(!showToc)}
                  className="flex items-center justify-between w-full text-xs font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>目次（全 {currentDraft.headings.length} 項目）</span>
                  </span>
                  {showToc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showToc && (
                  <div className="mt-3 bg-zinc-950/70 rounded-xl p-3 border border-zinc-800/60 space-y-1.5">
                    {currentDraft.headings.map((h, i) => (
                      <a
                        key={i}
                        href={`#${h.text.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '-')}`}
                        onClick={() => setShowToc(false)}
                        className={`block text-xs text-zinc-300 hover:text-amber-300 transition truncate ${
                          h.level === 3 ? 'pl-4 text-zinc-400' : 'font-bold'
                        }`}
                      >
                        {h.text}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 本文リーダー */}
          <article className="bg-zinc-950/60 border border-zinc-800/70 rounded-2xl p-4 sm:p-7 shadow-2xl">
            {renderMarkdown(currentDraft.content)}
          </article>

          {/* フッターアクションバー */}
          <div className="mt-8 p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-xs font-bold text-zinc-300">
                読み終わったらそのままコピー！
              </p>
              <p className="text-[11px] text-zinc-500">
                スマホの note アプリの新規投稿画面に直接ペーストできます。
              </p>
            </div>
            <button
              onClick={handleCopy}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>クリップボードにコピーしました！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>note 用に全文コピー</span>
                </>
              )}
            </button>
          </div>

        </main>
      )}
    </div>
  );
}
