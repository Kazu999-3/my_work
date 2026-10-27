'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Copy, Check, BookOpen, Clock, Tag, ChevronDown, ChevronUp, Sparkles, ExternalLink, AlertCircle,
  Rocket, CheckSquare, Square, Share2, MessageSquare, ThumbsUp, Eye, Edit3
} from 'lucide-react';
import initialDraftsData from '@/data/note_drafts.json';

interface NotePublishRecord {
  isPublished: boolean;
  publishedUrl?: string;
  publishedAt?: string;
  likes?: string;
  views?: string;
  notes?: string;
}

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
  const staticDrafts: NoteDraft[] = (initialDraftsData as any)?.drafts || [];
  const [drafts, setDrafts] = useState<NoteDraft[]>(staticDrafts);
  const [loading, setLoading] = useState(staticDrafts.length === 0);
  const [selectedId, setSelectedId] = useState<string>(staticDrafts[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [showToc, setShowToc] = useState(false);

  // 🚀 公開ステータス＆メモのローカル永続化
  const [publishMap, setPublishMap] = useState<Record<string, NotePublishRecord>>({});
  const [showChecklist, setShowChecklist] = useState(false);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [tagsCopied, setTagsCopied] = useState(false);
  const [copiedSingleTag, setCopiedSingleTag] = useState<string | null>(null);
  const [checklistChecks, setChecklistChecks] = useState<Record<string, boolean>>({});

  // LocalStorageから公開ステータスを読み込み
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sovereign_note_publish_status');
      if (saved) {
        setPublishMap(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load note publish status:', e);
    }
  }, []);

  // 公開ステータス保存ヘルパー
  const updatePublishRecord = (draftId: string, updates: Partial<NotePublishRecord>) => {
    setPublishMap((prev) => {
      const current = prev[draftId] || { isPublished: false };
      const updated = {
        ...prev,
        [draftId]: { ...current, ...updates }
      };
      try {
        localStorage.setItem('sovereign_note_publish_status', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save note publish status:', e);
      }
      return updated;
    });
  };

  // クライアント側での差分リフレッシュ（SWR・フェッチ失敗しても静的データで確実に表示）
  useEffect(() => {
    fetch('/api/note')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.drafts) && data.drafts.length > 0) {
          setDrafts(data.drafts);
          if (!selectedId) {
            setSelectedId(data.drafts[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('API fetch warning (using static fallback):', err);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

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
      // **太字** と *斜体/注釈* の変換
      const parts = str.split(/(\*\*.*?\*\*|\*[^*]+?\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="text-amber-300 font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          return (
            <span key={i} className="text-zinc-400 text-xs italic block text-center mt-1">
              {part.slice(1, -1)}
            </span>
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

      // 画像記法 ![alt](src)
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        const alt = imgMatch[1];
        const src = imgMatch[2];
        elements.push(
          <div key={index} className="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 p-1.5 shadow-lg">
            <img 
              src={src} 
              alt={alt} 
              className="w-full h-auto object-contain rounded-lg max-h-96 mx-auto" 
              loading="lazy" 
            />
            {alt && (
              <p className="text-center text-xs text-zinc-400 mt-1.5 font-medium">
                {alt}
              </p>
            )}
          </div>
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
            {drafts.map((d) => {
              let label = d.title.length > 14 ? d.title.slice(0, 14) + '…' : d.title;
              if (d.id === 'profile_intro') label = '✨ 自己紹介';
              if (d.id === 'zyra_jg_guide') label = '🌿 ザイラJG攻略';
              const isPub = publishMap[d.id]?.isPublished;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    d.id === selectedId
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  <span>{label}</span>
                  {isPub && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      d.id === selectedId ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      🚀 公開済
                    </span>
                  )}
                </button>
              );
            })}
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
      {currentDraft ? (
        <main className="max-w-3xl mx-auto px-4 py-6">
          
          {/* 記事メタ情報カード */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {publishMap[currentDraft.id]?.isPublished ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-black border border-emerald-500/40 flex items-center gap-1">
                    <Rocket className="w-3 h-3" />
                    <span>公開済み</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40">
                    📝 下書き推敲中
                  </span>
                )}
                
                <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[11px] font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  {currentDraft.charCount.toLocaleString()} 文字
                </span>

                <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold flex items-center gap-1 ${
                  currentDraft.title.length <= 32 
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' 
                    : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                }`}>
                  タイトル {currentDraft.title.length}/32文字 {currentDraft.title.length <= 32 ? '✓' : '⚠️'}
                </span>

                {currentDraft.meta?.target_rank && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/60 text-[11px] font-bold">
                    🎯 {currentDraft.meta.target_rank}
                  </span>
                )}
              </div>

              {/* note直リンク（公開URLがある場合） */}
              {publishMap[currentDraft.id]?.publishedUrl && (
                <a
                  href={publishMap[currentDraft.id].publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>noteを開く</span>
                </a>
              )}
            </div>

            <h1 className="text-base sm:text-xl font-black text-white leading-snug mb-3">
              {currentDraft.title}
            </h1>

            {/* クイックツールバー（チェックリスト ＆ 公開ステータス管理） */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800">
              <button
                onClick={() => {
                  setShowChecklist(!showChecklist);
                  setShowPublishPanel(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                  showChecklist 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                    : 'bg-zinc-950 text-zinc-300 hover:text-white border-zinc-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>公開前チェックリスト</span>
                {showChecklist ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>

              <button
                onClick={() => {
                  setShowPublishPanel(!showPublishPanel);
                  setShowChecklist(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                  showPublishPanel 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                    : publishMap[currentDraft.id]?.isPublished
                      ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40'
                      : 'bg-zinc-950 text-zinc-300 hover:text-white border-zinc-800'
                }`}
              >
                <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                <span>{publishMap[currentDraft.id]?.isPublished ? '公開データ・メモ' : '投稿完了・ステータス'}</span>
                {showPublishPanel ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>
            </div>

            {/* 📋 ① 公開前チェックリストパネル */}
            {showChecklist && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-950/90 border border-amber-500/30 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <h3 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    <span>note投稿前の4大セルフチェック</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400">公開直前の最終確認</span>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-300">
                  {/* チェック1: タイトル32文字 */}
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <div className="mt-0.5 text-amber-400">
                      {currentDraft.title.length <= 32 ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-200">タイトル32文字以内（一覧視認性）</span>
                        <span className={`font-mono text-[11px] font-bold ${currentDraft.title.length <= 32 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currentDraft.title.length} / 32文字
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {currentDraft.title.length <= 32 ? 'スマホ・一覧で途切れず綺麗に表示されます！' : '32文字を超えているためスマホ一覧で末尾が「…」と途切れる可能性があります。'}
                      </p>
                    </div>
                  </div>

                  {/* チェック2: 推奨タグの候補リスト ＆ ワンタップコピー */}
                  {(() => {
                    const isProfile = currentDraft.id === 'profile_intro';
                    const coreTags = isProfile
                      ? ['#自己紹介', '#はじめてのnote', '#LeagueofLegends', '#LoL', '#ジャングル', '#コミュニティ運営']
                      : ['#LeagueofLegends', '#LoL', '#ジャングル', '#ザイラ', '#低ランク脱出'];
                    
                    const audienceTags = isProfile
                      ? [
                          { tag: '#社会人ゲーマー', desc: '昼は会社員・夜はリフトの同世代に刺さる' },
                          { tag: '#個人開発', desc: 'Bot開発や自動化に関心あるIT層向け' },
                          { tag: '#LoL初心者', desc: '治安の良い温かいKTMを探す初心者向け' },
                          { tag: '#ランク戦', desc: 'ブロンズ〜プラチナ奮闘記を読みたい層向け' }
                        ]
                      : [
                          { tag: '#初心者向け攻略', desc: 'アイアン〜ゴールドで伸び悩む読者向け' },
                          { tag: '#ゲーム攻略', desc: 'note全体のゲーム読者向け' },
                          { tag: '#シルバー脱出', desc: 'シルバー帯で勝てない読者の検索対策' },
                          { tag: '#プラチナ昇格', desc: '勝率6割でプラチナ到達の実績に惹かれる層向け' },
                          { tag: '#ソロキュー', desc: '味方に依存せず一人で勝ちたい層向け' }
                        ];

                    const handleCopySingle = (tag: string) => {
                      navigator.clipboard.writeText(tag);
                      setCopiedSingleTag(tag);
                      setTimeout(() => setCopiedSingleTag(null), 1800);
                    };

                    const handleCopyAll = () => {
                      navigator.clipboard.writeText(coreTags.join(' '));
                      setTagsCopied(true);
                      setTimeout(() => setTagsCopied(false), 2000);
                    };

                    return (
                      <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                        {/* ヘッダー＆一括コピーボタン */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-zinc-100 flex items-center gap-1.5 text-xs">
                            <Tag className="w-3.5 h-3.5 text-amber-400" />
                            <span>タグ候補リスト（タップで即時コピー）</span>
                          </span>
                          <button
                            onClick={handleCopyAll}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-sm ${
                              tagsCopied ? 'bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black font-black'
                            }`}
                          >
                            {tagsCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{tagsCopied ? '王道セットをコピー完了！' : '👑 王道セットを一括コピー'}</span>
                          </button>
                        </div>

                        {/* 王道必須セット */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-300/90 uppercase tracking-wider block">
                            【👑 王道・必須セット】（note公式・検索対策）
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {coreTags.map((t) => (
                              <button
                                key={t}
                                onClick={() => handleCopySingle(t)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 border ${
                                  copiedSingleTag === t
                                    ? 'bg-emerald-600 text-white border-emerald-500 scale-105'
                                    : 'bg-zinc-800/80 hover:bg-zinc-700 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                <span>{t}</span>
                                {copiedSingleTag === t && <Check className="w-2.5 h-2.5 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 読者層拡大・追加候補 */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            【🎯 追加候補】（読者層に合わせて自由にチョイス）
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {audienceTags.map(({ tag, desc }) => (
                              <button
                                key={tag}
                                onClick={() => handleCopySingle(tag)}
                                className={`p-1.5 rounded-lg text-left transition cursor-pointer border flex items-center justify-between gap-1.5 ${
                                  copiedSingleTag === tag
                                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                                    : 'bg-black/40 hover:bg-zinc-800/60 border-zinc-800/80 text-zinc-300'
                                }`}
                              >
                                <div className="truncate">
                                  <span className="font-mono font-bold text-[11px] text-zinc-200 block truncate">{tag}</span>
                                  <span className="text-[10px] text-zinc-400 block truncate">{desc}</span>
                                </div>
                                <span className="text-[10px] font-bold shrink-0 text-amber-400/80">
                                  {copiedSingleTag === tag ? '✓ コピー済' : 'コピー'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* チェック3: 見出し画像・目次・コピー確認 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={!!checklistChecks[`${currentDraft.id}_cover`]}
                        onChange={(e) => setChecklistChecks({...checklistChecks, [`${currentDraft.id}_cover`]: e.target.checked})}
                        className="rounded border-zinc-700 text-amber-500 focus:ring-0" 
                      />
                      <span className="text-[11px] text-zinc-300">見出し画像（サムネ）設定済み</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={!!checklistChecks[`${currentDraft.id}_copy`]}
                        onChange={(e) => setChecklistChecks({...checklistChecks, [`${currentDraft.id}_copy`]: e.target.checked})}
                        className="rounded border-zinc-700 text-amber-500 focus:ring-0" 
                      />
                      <span className="text-[11px] text-zinc-300">noteエディタに全文ペースト完了</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 🚀 ② 公開ステータス設定 ＆ URL・メモ記録パネル */}
            {showPublishPanel && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-950/90 border border-emerald-500/30 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <h3 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                    <Rocket className="w-4 h-4" />
                    <span>投稿ステータス ＆ 公開後データ記録</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400">端末に自動保存</span>
                </div>

                {/* 公開トグルスイッチ */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>この記事のステータス:</span>
                      {publishMap[currentDraft.id]?.isPublished ? (
                        <span className="text-emerald-400 font-black">【🚀 公開済み】</span>
                      ) : (
                        <span className="text-amber-400 font-bold">【📝 下書き作成中】</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {publishMap[currentDraft.id]?.isPublished 
                        ? 'タブや一覧で「公開済」バッジが表示されています。' 
                        : 'noteに投稿完了したらオンにしてください。'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const current = publishMap[currentDraft.id] || { isPublished: false };
                      updatePublishRecord(currentDraft.id, {
                        isPublished: !current.isPublished,
                        publishedAt: !current.isPublished ? new Date().toISOString().split('T')[0] : current.publishedAt
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-sm ${
                      publishMap[currentDraft.id]?.isPublished
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {publishMap[currentDraft.id]?.isPublished ? '公開中（解除する）' : '🚀 投稿完了にする'}
                  </button>
                </div>

                {/* note公開URL入力 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                    <Share2 className="w-3 h-3 text-emerald-400" />
                    <span>公開したnote記事のURL</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      placeholder="https://note.com/kazu311/n/..."
                      value={publishMap[currentDraft.id]?.publishedUrl || ''}
                      onChange={(e) => updatePublishRecord(currentDraft.id, { publishedUrl: e.target.value })}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                    {publishMap[currentDraft.id]?.publishedUrl && (
                      <a
                        href={publishMap[currentDraft.id].publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-bold flex items-center gap-1 border border-zinc-700 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>開く</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* スキ数 ＆ PV数 ＆ 所感メモ */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-rose-400" />
                        <span>スキ数</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例: 15"
                        value={publishMap[currentDraft.id]?.likes || ''}
                        onChange={(e) => updatePublishRecord(currentDraft.id, { likes: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <span>PV数</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例: 350"
                        value={publishMap[currentDraft.id]?.views || ''}
                        onChange={(e) => updatePublishRecord(currentDraft.id, { views: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" />
                      <span>読者の反応・所感メモ</span>
                    </label>
                    <textarea
                      placeholder="例: 投稿初日にザイラ使いの方から参考になったとコメントあり。次回はルーン解説を深掘り予定。"
                      rows={2}
                      value={publishMap[currentDraft.id]?.notes || ''}
                      onChange={(e) => updatePublishRecord(currentDraft.id, { notes: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

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
      ) : (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-500">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-zinc-200 mb-1">
            note ドラフトがまだありません
          </h2>
          <p className="text-xs text-zinc-500">
            02_FACTORY/01_DRAFTS/note/ 配下に .md ファイルを配置すると自動で表示されます。
          </p>
        </div>
      )}
    </div>
  );
}
