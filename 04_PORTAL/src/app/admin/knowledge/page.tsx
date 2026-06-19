'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, Plus, Trash2, Calendar, Link as LinkIcon, RefreshCw, FileText, ChevronDown, ChevronUp, BookOpen, Layers, Sparkles, Tag, Video } from 'lucide-react';
import Link from 'next/link';
import YoutubeQueueManager from '../youtube/YoutubeQueueManager';

interface KnowledgeItem {
  id: number;
  created_at: string;
  title: string;
  content: string;
  raw_content?: string;
  source_url?: string;
  genre: string;
  tags?: string[];
}

export default function KnowledgeBase() {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // 入力フォームの状態
  const [inputType, setInputType] = useState<'url' | 'memo'>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [inputMemo, setInputMemo] = useState('');

  // 検索とフィルタ
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('all');

  // カード展開用
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ページ内タブ: ナレッジ一覧 or 動画キュー
  const [activeTab, setActiveTab] = useState<'knowledge' | 'video'>('knowledge');

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // 1. ナレッジ一覧取得
  const fetchKnowledge = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/admin/knowledge?genre=${filterGenre}&query=${searchQuery}`);
      if (res.ok) {
        const data = await res.json();
        setKnowledgeList(Array.isArray(data) ? data : []);
      } else {
        showFeedback('ナレッジの取得に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, [filterGenre]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKnowledge();
  };

  // YouTube URL判定
  const isYoutubeUrl = (url: string): boolean => {
    return /youtube\.com\/watch|youtu\.be\//i.test(url);
  };

  // 2. ナレッジの追加（要約＆分類）— YouTube URLは動画キューへ自動振り分け
  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {};
    if (inputType === 'url') {
      if (!inputUrl.trim()) return;
      payload.url = inputUrl.trim();
    } else {
      if (!inputMemo.trim()) return;
      payload.text = inputMemo.trim();
    }

    setActionLoading(true);
    try {
      // YouTube URLの場合は動画キューに送る
      if (inputType === 'url' && isYoutubeUrl(payload.url)) {
        const res = await fetch('/api/admin/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload.url }),
        });
        const result = await res.json();
        if (res.ok) {
          showFeedback('📺 YouTube動画としてキューに追加しました。SREデーモンが自動解析します。', 'success');
          setInputUrl('');
          setActiveTab('video'); // 動画キュータブに自動切り替え
        } else {
          showFeedback(result.error || '動画キューへの追加に失敗しました。', 'error');
        }
      } else {
        // 通常のURLまたはメモ → AI要約・分類
        const res = await fetch('/api/admin/knowledge/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) {
          showFeedback(result.message || 'ナレッジを追加しました。', 'success');
          setInputUrl('');
          setInputMemo('');
          fetchKnowledge(true);
        } else {
          showFeedback(result.error || 'ナレッジの解析に失敗しました。', 'error');
        }
      }
    } catch (err) {
      showFeedback('解析リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. ナレッジの削除
  const handleDeleteKnowledge = async (id: number, title: string) => {
    if (!confirm(`ナレッジ「${title}」を削除しますか？`)) return;

    setDeleteLoading(id);
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('ナレッジを削除しました。', 'success');
        fetchKnowledge(true);
      } else {
        showFeedback(result.error || '削除に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setDeleteLoading(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getGenreBadge = (genre: string) => {
    let classes = 'px-3 py-1 text-xs font-black rounded-full border ';
    if (genre === 'LoL攻略') {
      classes += 'bg-blue-950/40 text-blue-400 border-blue-800/60';
    } else if (genre === 'AIツール') {
      classes += 'bg-purple-950/40 text-purple-400 border-purple-800/60';
    } else if (genre === '副業ノウハウ') {
      classes += 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
    } else {
      classes += 'bg-gray-950/40 text-gray-400 border-gray-800/60';
    }
    return <span className={classes}>{genre}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-8 relative">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-pink-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-pink-200 to-indigo-400 flex items-center gap-3">
            <Brain className="text-pink-400 animate-pulse" size={36} />
            Sovereign パーソナル・ナレッジベース
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            URLやメモを投げるだけでAIが自動要約・分類。「あのとき読んだ知識」を資産化し、記事のインスピレーションを得る司令部。
          </p>
        </div>
      </div>

      {/* フィードバックメッセージ */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-sm transition-all duration-300 ${
            message.type === 'success'
              ? 'bg-green-950/30 text-green-400 border-green-800/60 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
              : 'bg-red-950/30 text-red-400 border-red-800/60 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ナレッジ投入エリア */}
      <div className="bg-[#0f111a] border border-gray-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-pink-500 via-pink-300 to-indigo-500" />
        
        <div className="flex gap-4 mb-6 border-b border-gray-800/60 pb-3">
          <button
            onClick={() => setInputType('url')}
            className={`text-sm font-bold pb-2 border-b-2 transition-all flex items-center gap-1.5 ${
              inputType === 'url' ? 'border-pink-500 text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <LinkIcon size={14} /> URLから登録
          </button>
          <button
            onClick={() => setInputType('memo')}
            className={`text-sm font-bold pb-2 border-b-2 transition-all flex items-center gap-1.5 ${
              inputType === 'memo' ? 'border-pink-500 text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText size={14} /> メモから要約登録
          </button>
        </div>

        <form onSubmit={handleAddKnowledge} className="space-y-4">
          {inputType === 'url' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="url"
                  placeholder="https://example.com/lol-guide または YouTube URL"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3.5 bg-[#07080e] border border-gray-800 rounded-2xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm text-gray-200 placeholder-gray-600 transition-all"
                />
                <button
                  type="submit"
                  disabled={actionLoading || !inputUrl.trim()}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(244,63,94,0.25)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center min-w-[150px] gap-2"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {inputUrl && isYoutubeUrl(inputUrl) ? 'キュー追加中...' : 'AI解析中...'}
                    </>
                  ) : inputUrl && isYoutubeUrl(inputUrl) ? (
                    <>
                      <Video size={16} />
                      動画キューに追加
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      要約・登録
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 pl-1 flex items-center gap-1">
                <Video size={10} className="text-red-400" />
                YouTubeリンクを入力すると自動的に動画解析キューに追加されます
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <textarea
                placeholder="日々の気づき、後で整理したいノウハウ、外部からコピペした文章などを入力してください..."
                value={inputMemo}
                onChange={(e) => setInputMemo(e.target.value)}
                disabled={actionLoading}
                rows={4}
                className="w-full px-4 py-3.5 bg-[#07080e] border border-gray-800 rounded-2xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm text-gray-200 placeholder-gray-600 transition-all font-sans leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={actionLoading || !inputMemo.trim()}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(244,63,94,0.25)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center min-w-[150px] gap-2"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      AI解析中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      AI自動要約・分類
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* タブ切り替え: ナレッジ一覧 / 動画キュー */}
      <div className="flex bg-[#0f111a] p-1 rounded-2xl border border-gray-800/60">
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'knowledge'
              ? 'bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-pink-400 border border-pink-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Brain size={16} /> ナレッジ一覧
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'video'
              ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Video size={16} /> 動画解析キュー
        </button>
      </div>

      {/* タブに応じてコンテンツ切り替え */}
      {activeTab === 'knowledge' ? (
        <>
          {/* 検索・絞り込み */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#0f111a] border border-gray-800/80 rounded-3xl p-4 shadow-lg">
            {/* ジャンルフィルタ */}
            <div className="flex flex-wrap gap-1 bg-[#07080e] p-1 rounded-2xl border border-gray-800/60 w-full md:w-auto">
              {[
                { id: 'all', label: 'すべて', count: knowledgeList.length },
                { id: 'LoL攻略', label: '⚔️ LoL攻略' },
                { id: 'AIツール', label: '🤖 AIツール' },
                { id: '副業ノウハウ', label: '💰 副業ノウハウ' },
                { id: 'その他', label: '📁 その他' },
              ].map((tab) => {
                const isActive = filterGenre === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterGenre(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive ? 'bg-pink-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* 検索窓 */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="ナレッジを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-xs text-gray-200"
              />
              <button type="submit" className="absolute left-3 top-3 text-gray-600 hover:text-pink-400 transition-colors">
                <Search size={14} />
              </button>
            </form>
          </div>

          {/* ナレッジ一覧リスト */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-[#0f111a] border border-gray-800/60 rounded-3xl">
                <RefreshCw className="animate-spin h-8 w-8 text-pink-400" />
                <span className="text-sm text-gray-400">知識資産をロード中...</span>
              </div>
            ) : knowledgeList.length === 0 ? (
              <div className="py-20 text-center text-gray-500 text-sm bg-[#0f111a] border border-gray-800/60 rounded-3xl">
                ナレッジが見つかりません。新しいURLやメモを登録してみましょう！
              </div>
            ) : (
              knowledgeList.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    className="bg-[#0f111a] border border-gray-800/60 rounded-3xl p-5 hover:border-gray-700/60 transition-all duration-300 relative overflow-hidden"
                  >
                    {/* カードヘッダー */}
                    <div className="flex justify-between items-start gap-4 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {getGenreBadge(item.genre)}
                          <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(item.created_at).toLocaleDateString('ja-JP')}
                          </span>
                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-pink-400 hover:text-pink-300 text-[10px] flex items-center gap-0.5 shrink-0"
                            >
                              <LinkIcon size={10} /> URLリンク
                            </a>
                          )}
                        </div>
                        <h2 className="text-lg font-bold text-gray-100 line-clamp-1">{item.title || '無題のナレッジ'}</h2>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKnowledge(item.id, item.title);
                          }}
                          disabled={deleteLoading === item.id}
                          className="p-2 hover:bg-red-500/10 rounded-xl text-gray-500 hover:text-red-400 transition-all"
                          title="ナレッジ削除"
                        >
                          {deleteLoading === item.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                        <button className="text-gray-500 hover:text-pink-400 p-2">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* 短縮要約（展開されていない時に少し見せる） */}
                    {!isExpanded && (
                      <p className="text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed bg-[#07080e]/40 p-3 rounded-xl border border-gray-900/60">
                        {(item.content || '').replace(/[#*`]/g, '')}
                      </p>
                    )}

                    {/* 展開時の中身 */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 pt-4 border-t border-gray-800/80 space-y-4"
                        >
                          {/* 要約 (Markdown風表示) */}
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1">
                              <BookOpen size={10} /> AI要約 (ナレッジベース)
                            </p>
                            <div className="bg-[#07080e] p-4 rounded-2xl border border-gray-900 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                              {item.content || '要約データはありません。'}
                            </div>
                          </div>

                          {/* タグ一覧 */}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {item.tags.map((tag, tIdx) => (
                                <span key={tIdx} className="px-2 py-0.5 rounded bg-black/40 border border-white/5 text-[10px] text-gray-400 flex items-center gap-1">
                                  <Tag size={8} /> {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 生の登録テキスト（メモや記事本文） */}
                          {item.raw_content && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                <Layers size={10} /> 収集テキスト (生データ)
                              </p>
                              <div className="bg-[#07080e]/50 p-4 rounded-2xl border border-gray-900/60 text-[11px] text-gray-500 leading-relaxed max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                                {item.raw_content || '収集テキスト（生データ）はありません。'}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* 動画キュータブ: 既存のYoutubeQueueManagerをそのまま表示 */
        <YoutubeQueueManager />
      )}
    </div>
  );
}
