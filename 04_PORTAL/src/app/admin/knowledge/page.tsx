'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, Plus, Trash2, Calendar, Link as LinkIcon, RefreshCw, FileText, ChevronDown, ChevronUp, BookOpen, Layers, Sparkles, Tag, Video } from 'lucide-react';
import Link from 'next/link';
import YoutubeQueueManager from '../youtube/YoutubeQueueManager';
import LibraryTabContent from './LibraryTabContent';
import DictReviewPanel from './DictReviewPanel';
import DictInsightsPanel from './DictInsightsPanel';
import RevisionsPanel from './RevisionsPanel';
import { supabaseBrowser } from '../../../lib/supabaseBrowserClient';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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

  // ページ内タブ: ナレッジ一覧 or 動画キュー or 攻略ライブラリ or 鮮度レビュー
  const [activeTab, setActiveTab] = useState<'knowledge' | 'video' | 'library' | 'maintenance' | 'review'>('knowledge');

  // 認証の確認（middleware.tsが/admin/*をCookieでゲート済み。UIローディング制御のみ）
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // 1. ナレッジ一覧取得 (認証ヘッダーを自動付与)
  const fetchKnowledge = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/admin/knowledge?genre=${filterGenre}&query=${searchQuery}`, {
        headers
      });
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

  // 検索とフィルタの自動デバウンス実行
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        fetchKnowledge();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [filterGenre, searchQuery, isAuthenticated]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // YouTube URLの場合は動画キューに送る
      if (inputType === 'url' && isYoutubeUrl(payload.url)) {
        const res = await fetch('/api/admin/youtube', {
          method: 'POST', credentials: 'include',
          headers,
          body: JSON.stringify({ url: payload.url })
        });
        if (res.ok) {
          showFeedback('YouTube動画を解析キューに追加しました！(SREデーモンが順次要約します)', 'success');
          setInputUrl('');
          setActiveTab('video'); // キュー一覧タブへ遷移
        } else {
          const err = await res.json().catch(() => ({}));
          showFeedback(err.error || 'キュー追加に失敗しました。', 'error');
        }
      } else {
        // 通常ナレッジ追加
        const res = await fetch('/api/admin/knowledge/add', {
          method: 'POST', credentials: 'include',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showFeedback('新しいナレッジを自動要約して登録しました！', 'success');
          setInputUrl('');
          setInputMemo('');
          fetchKnowledge(true);
        } else {
          const err = await res.json().catch(() => ({}));
          showFeedback(err.error || '登録に失敗しました。', 'error');
        }
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. ナレッジの削除
  const handleDeleteKnowledge = async (id: number, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;
    setDeleteLoading(id);
    try {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/knowledge', {
        method: 'DELETE', credentials: 'include',
        headers,
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        showFeedback('ナレッジを削除しました。', 'success');
        setKnowledgeList(prev => prev.filter(item => item.id !== id));
      } else {
        showFeedback('削除に失敗しました。', 'error');
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
    const defaultStyle = 'bg-gray-800 text-gray-400 border border-gray-700';
    const styles: Record<string, string> = {
      'LoL攻略': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      'AIツール': 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      '副業ノウハウ': 'bg-green-500/10 text-green-400 border border-green-500/20',
      'その他': 'bg-gray-800 text-gray-400 border border-gray-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${styles[genre] || defaultStyle}`}>
        {genre || '分類なし'}
      </span>
    );
  };

  // 動画IDしかタイトルに入っていない場合に美化するヘルパー
  const formatTitle = (item: KnowledgeItem) => {
    const t = item.title || '';
    // 英数字のみで構成される11桁のYouTube動画IDパターンの場合
    if (/^[a-zA-Z0-9_-]{11}$/.test(t)) {
      return `[YouTube] 動画 ${t} (タイトル未取得)`;
    }
    return t;
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#07080e' }} className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-pink-500" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #07080e 0%, #0f111a 60%, #07080e 100%)' }}
        className="flex items-center justify-center p-4 font-sans text-white"
      >
        <div className="text-center max-w-sm rounded-3xl border border-gray-800 bg-[#0f111a] p-8">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2">認証が必要です</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            この管理機能は管理者専用です。Discordアカウントでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login?next=/admin/knowledge"
            className="inline-block w-full rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-600"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080e] font-sans text-gray-200 antialiased selection:bg-pink-500/30 pb-20">
      {/* 共通のCSSインポート */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&display=swap');
        * { font-family: 'Outfit', 'Noto Sans JP', sans-serif; }
      `}</style>

      {/* フィードバックメッセージ */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 pt-10">
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-gray-900 pb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Brain className="text-pink-500" />
              Sovereign Knowledge
            </h1>
            <p className="text-xs text-gray-500">
              インテリジェンスとLoL戦術を蓄積する自律型要約ナレッジベース
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="text-xs font-semibold px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl border border-gray-800 transition-all flex items-center gap-1 shrink-0"
          >
            Leaderboardに戻る
          </Link>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-2 border-b border-gray-900 pb-4 mb-8 overflow-x-auto">
          {[
            { id: 'knowledge', label: '📖 ナレッジ一覧', icon: BookOpen },
            { id: 'video', label: '⏳ 動画解析キュー', icon: Video },
            { id: 'library', label: '🗂️ 攻略ライブラリ', icon: Layers },
            { id: 'maintenance', label: '🛠️ データ整備', icon: Layers },
            { id: 'review', label: '🔄 鮮度レビュー', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* --- タブ別コンテンツ --- */}
        {activeTab === 'video' && <YoutubeQueueManager />}
        {activeTab === 'library' && <LibraryTabContent />}
        {/* データ整備: 一括処理を推奨実行順に並べる */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <div className="bg-pink-500/5 border border-pink-500/20 rounded-2xl p-5">
              <h2 className="text-base font-black text-white mb-2">🛠️ データ整備の進め方</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                知識を「チャンピオン辞典 / レーン別ガイド」へ整理する一括処理です。
                <strong className="text-pink-300">①→③の順に実行</strong>すると、翻訳済みのデータをもとに統合できるため品質が上がります。
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                ※ ②「チャンピオン辞典へ一括同期」は
                <button onClick={() => setActiveTab('library' as any)} className="text-pink-400 hover:underline font-bold mx-1">🗂️ 攻略ライブラリ</button>
                タブの「全チャンプ辞典に一括同期」ボタンから実行します。
              </p>
            </div>
            <DictInsightsPanel mode="maintenance" />
            <RevisionsPanel />
          </div>
        )}

        {/* 鮮度レビュー: 古い辞典の判定と、個別の点検ツール */}
        {activeTab === 'review' && (
          <div className="space-y-6">
            <DictReviewPanel />
            <DictInsightsPanel mode="inspect" />
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="space-y-8 animate-in">
            {/* 登録セクション */}
            <div className="bg-[#0f111a] border border-gray-800/60 rounded-3xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-1.5">
                <Plus size={18} className="text-pink-400" />
                新しい戦術・ノウハウを追加する
              </h2>

              <div className="flex gap-1 mb-5 bg-[#07080e] p-1 rounded-xl w-fit">
                <button
                  onClick={() => setInputType('url')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    inputType === 'url' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  🌐 URLから追加 (自動要約)
                </button>
                <button
                  onClick={() => setInputType('memo')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    inputType === 'memo' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  📝 メモから追加 (AI分類)
                </button>
              </div>

              <form onSubmit={handleAddKnowledge} className="space-y-4">
                {inputType === 'url' ? (
                  <div className="space-y-1">
                    <input
                      type="url"
                      placeholder="https://example.com/article  または  YouTube動画URL..."
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-xs text-gray-200 placeholder-gray-600"
                    />
                    <p className="text-[10px] text-gray-500 pl-1">
                      ※ YouTubeリンクを入力すると自動的に動画解析キューに追加されます
                    </p>
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    placeholder="戦術メモ、分析の気付き、アフィリエイトの学びなどを記入..."
                    value={inputMemo}
                    onChange={(e) => setInputMemo(e.target.value)}
                    className="w-full px-4 py-3 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-xs text-gray-200 placeholder-gray-600 resize-none leading-relaxed"
                  />
                )}

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-all shadow-lg hover:shadow-pink-500/20 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {inputType === 'url' ? '要約・解析を実行' : 'AIによる分類・保存'}
                </button>
              </form>
            </div>

            {/* フィルター＆検索ヘッダー */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0f111a] border border-gray-800/60 rounded-3xl p-4">
              {/* ジャンルタブ */}
              <div className="flex flex-wrap gap-1">
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
                    <div
                      key={item.id}
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
                          <h2 className="text-lg font-bold text-gray-100 line-clamp-1">{formatTitle(item)}</h2>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKnowledge(item.id, formatTitle(item));
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

                      {/* 展開時詳細コンテンツ */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-gray-900 space-y-4">
                              {/* 要約テキスト */}
                              <div className="bg-[#07080e] p-5 rounded-2xl border border-gray-900 leading-relaxed text-sm text-gray-300 whitespace-pre-wrap">
                                {item.content}
                              </div>

                              {/* 生テキスト（メタデータ）の表示がある場合 */}
                              {item.raw_content && (
                                <details className="group">
                                  <summary className="text-xs text-gray-500 hover:text-gray-400 cursor-pointer list-none flex items-center gap-1 outline-none">
                                    <FileText size={12} />
                                    <span>生データ（インテリジェンス）を表示</span>
                                  </summary>
                                  <div className="mt-2 p-4 bg-[#07080e]/50 border border-gray-900 rounded-2xl text-[10px] text-gray-500 max-h-48 overflow-y-auto whitespace-pre-wrap leading-normal font-mono select-all">
                                    {item.raw_content}
                                  </div>
                                </details>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
