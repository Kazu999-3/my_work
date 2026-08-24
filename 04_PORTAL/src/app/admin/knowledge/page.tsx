'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, Plus, Trash2, Calendar, Link as LinkIcon, RefreshCw, FileText, ChevronDown, ChevronUp, BookOpen, Layers, Sparkles, Video, MessageSquare, Activity } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import YoutubeQueueManager from '../youtube/YoutubeQueueManager';
import LibraryTabContent from './LibraryTabContent';
import DiscordImportPanel from './DiscordImportPanel';
import PendingInsightsPanel from './PendingInsightsPanel';
import KnowledgePreviewModal, { type KnowledgePreview } from './KnowledgePreviewModal';

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

function KnowledgeBaseContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // 入力フォームの状態
  const [inputType, setInputType] = useState<'url' | 'memo'>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [inputMemo, setInputMemo] = useState('');

  // AI解析結果のプレビュー(2026-08-15、保存前にチャンピオン辞典への反映内容を確認できるように)
  const [pendingPreview, setPendingPreview] = useState<KnowledgePreview | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  // 検索とフィルタ
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('all');

  // カード展開用
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ページ内タブ: ナレッジ一覧 or 動画キュー or 攻略ライブラリ or Discordインポート
  const [activeTab, setActiveTab] = useState<'knowledge' | 'video' | 'library' | 'discord' | 'pending'>('knowledge');
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);

  const searchParams = useSearchParams();

  // URLパラメータ (?tab=research等) の自動反映
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['knowledge', 'video', 'library', 'discord'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

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

// 1. ナレッジ一覧取得
  const fetchKnowledge = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/admin/knowledge?genre=${filterGenre}&query=${searchQuery}`, {
        credentials: 'include',
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
      // YouTube URLの場合は動画キューに送る
      if (inputType === 'url' && isYoutubeUrl(payload.url)) {
        const res = await fetch('/api/admin/youtube', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
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
        // 通常ナレッジ追加: まずAI解析のみ行い、結果をプレビューとして表示する
        const res = await fetch('/api/admin/knowledge/add', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const resData = await res.json().catch(() => ({}));
          if (resData?.preview) {
            setPendingPreview(resData.preview);
          } else {
            showFeedback('AI解析結果の取得に失敗しました。', 'error');
          }
        } else {
          const err = await res.json().catch(() => ({}));
          showFeedback(err.error || 'AI解析に失敗しました。', 'error');
        }
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // プレビュー確認後、実際にDBへ保存する
  const handleConfirmSave = async (edited: KnowledgePreview) => {
    setConfirmSaving(true);
    try {
      const res = await fetch('/api/admin/knowledge/confirm', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edited)
      });
      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        const related: { title: string }[] = resData?.relatedByAuthor || [];
        const relatedNote = related.length > 0
          ? `（同じ投稿者の既存記事が${related.length}件あります: ${related.slice(0, 3).map((r) => r.title).join('、')}${related.length > 3 ? '...' : ''}）`
          : '';
        const atomicCount: number = resData?.atomicInsightCount || 0;
        const laneGeneralPending: number = resData?.laneGeneralPendingCount || 0;
        const totalPending = atomicCount + laneGeneralPending;
        const atomicNote = totalPending > 0 ? `（独立した知見を${totalPending}件、原子的なメモとして分割しました。「未承認のナレッジ」で内容を確認・承認するまで辞典生成やレーンガイド統合には使われません）` : '';
        showFeedback(`新しいナレッジを登録しました！${atomicNote}${relatedNote}`, 'success');
        setInputUrl('');
        setInputMemo('');
        setPendingPreview(null);
        fetchKnowledge(true);
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || '保存に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('保存リクエストに失敗しました。', 'error');
    } finally {
      setConfirmSaving(false);
    }
  };

  // 3. ナレッジの削除
  const handleDeleteKnowledge = async (id: number, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;
    setDeleteLoading(id);
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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

  // 2.5. 既存ナレッジの画像込み再解析
  const [reAnalyzeLoading, setReAnalyzeLoading] = useState<number | null>(null);
  const handleReAnalyzeKnowledge = async (id: number, title: string) => {
    if (!confirm(`「${title}」のURLから画像を含めて再解析・要約更新しますか？`)) return;
    setReAnalyzeLoading(id);
    try {
      const res = await fetch('/api/admin/knowledge/re-analyze', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || '画像込みで再解析・更新しました！', 'success');
        fetchKnowledge(true);
      } else {
        showFeedback(data.error || '再解析に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setReAnalyzeLoading(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getGenreBadge = (genre: string) => {
    const defaultStyle = 'bg-gray-100 text-gray-500 border border-gray-200';
    const styles: Record<string, string> = {
      'LoL攻略': 'bg-blue-100 text-blue-700 border border-blue-200',
      'AIツール': 'bg-purple-100 text-purple-700 border border-purple-200',
      '副業ノウハウ': 'bg-green-100 text-green-700 border border-green-200',
      'その他': 'bg-gray-100 text-gray-500 border border-gray-200',
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
      <div style={{ minHeight: '100vh' }} className="flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-pink-500" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f1e6 0%, #fdfcf9 60%, #f5f1e6 100%)' }}
        className="flex items-center justify-center p-4 font-sans text-gray-900"
      >
        <div className="text-center max-w-sm rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2">認証が必要です</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            この管理機能は管理者専用です。Discordアカウントでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-600"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-gray-900 antialiased selection:bg-pink-500/30 pb-20">
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
              message.type === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
            }`}
          >
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1600px] w-full mx-auto px-4 md:px-8 pt-6 md:pt-10">
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-gray-200 pb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
              <Brain className="text-pink-500" />
              Sovereign Knowledge
            </h1>
            <p className="text-xs text-gray-500">
              インテリジェンスとLoL戦術を蓄積する自律型要約ナレッジベース
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/coach"
              className="text-xs font-bold px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 hover:opacity-90"
            >
              <Sparkles size={14} />
              コーチ・深掘りへ移動
            </Link>
          </div>
        </div>

        {/* 📊 辞典ヘルスダッシュボードへのショートカットバナー */}
        <Link
          href="/admin/dict-health"
          className="block bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/80 rounded-2xl p-4 mb-6 shadow-sm hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-amber-600" />
              <div>
                <div className="text-sm font-extrabold text-amber-900">📊 辞典 ＆ ナレッジ統合ヘルスダッシュボード</div>
                <div className="text-[11px] text-stone-500">ファクトチェック・データ棚卸し・変更履歴・鮮度レビューをワンストップで管理</div>
              </div>
            </div>
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-xl group-hover:bg-amber-200 transition">開く ➔</span>
          </div>
        </Link>

        {/* タブ切り替え */}
        <div className="flex gap-2 border-b border-gray-200 pb-4 mb-8 overflow-x-auto items-center">
          {[
            { id: 'knowledge', label: '📖 ナレッジ一覧', icon: BookOpen },
            { id: 'discord', label: '💬 Discord AIインポート', icon: MessageSquare },
            { id: 'video', label: '⏳ 動画解析キュー', icon: Video },
            { id: 'library', label: '🗂️ 攻略ライブラリ', icon: Layers },
            { id: 'pending', label: '🧩 未承認のナレッジ', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* --- タブ別コンテンツ --- */}
        {activeTab === 'discord' && <DiscordImportPanel />}
        {activeTab === 'video' && <YoutubeQueueManager />}
        {activeTab === 'library' && <LibraryTabContent />}
        {activeTab === 'pending' && <PendingInsightsPanel />}

        {activeTab === 'knowledge' && (
          <div className="space-y-8 animate-in">
            {/* 登録セクション */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-1.5">
                <Plus size={18} className="text-pink-400" />
                新しい戦術・ノウハウを追加する
              </h2>

              <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setInputType('url')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    inputType === 'url' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🌐 URLから追加 (自動要約)
                </button>
                <button
                  onClick={() => setInputType('memo')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    inputType === 'memo' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
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
                      placeholder="https://x.com/username/status/12345... または Web記事 / YouTube URL..."
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-xs text-gray-900 placeholder-gray-400 font-mono"
                    />
                    <p className="text-[10px] text-gray-400 pl-1 flex items-center gap-1.5 pt-0.5">
                      <span className="text-pink-600 font-bold">✨ X(Twitter)投稿対応:</span> 画像・動画・添付メディアをAIがマルチモーダル視覚解析して要約保存します。（※ YouTubeは動画キューへ送信）
                    </p>
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    placeholder="戦術メモ、分析の気付き、アフィリエイトの学びなどを記入..."
                    value={inputMemo}
                    onChange={(e) => setInputMemo(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-xs text-gray-900 placeholder-gray-400 resize-none leading-relaxed"
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-gray-200 rounded-3xl p-4">
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
                        isActive ? 'bg-pink-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
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
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-xs text-gray-900"
                />
                <button type="submit" className="absolute left-3 top-3 text-gray-500 hover:text-pink-600 transition-colors">
                  <Search size={14} />
                </button>
              </form>
            </div>

            {/* ナレッジ一覧リスト */}
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white border border-gray-200 rounded-3xl">
                  <RefreshCw className="animate-spin h-8 w-8 text-pink-600" />
                  <span className="text-sm text-gray-400">知識資産をロード中...</span>
                </div>
              ) : knowledgeList.length === 0 ? (
                <div className="py-20 text-center text-gray-500 text-sm bg-white border border-gray-200 rounded-3xl">
                  ナレッジが見つかりません。新しいURLやメモを登録してみましょう！
                </div>
              ) : (
                knowledgeList.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-200 rounded-3xl p-5 hover:border-gray-300 transition-all duration-300 relative overflow-hidden"
                    >
                      {/* カードヘッダー */}
                      <div className="flex justify-between items-start gap-4 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {getGenreBadge(item.genre)}
                            {(() => {
                              const days = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
                              if (days <= 30) {
                                return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 新鮮 ({days}日前)</span>;
                              } else if (days <= 60) {
                                return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">🟡 要確認 ({days}日前)</span>;
                              } else {
                                return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">🔴 過去メタ ({days}日前)</span>;
                              }
                            })()}
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
                                className="text-pink-600 hover:text-pink-700 text-[10px] flex items-center gap-0.5 shrink-0"
                              >
                                <LinkIcon size={10} /> URLリンク
                              </a>
                            )}
                          </div>
                          <h2 className="text-lg font-bold text-gray-900 line-clamp-1">{formatTitle(item)}</h2>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.source_url && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReAnalyzeKnowledge(item.id, formatTitle(item));
                              }}
                              disabled={reAnalyzeLoading === item.id}
                              className="px-2.5 py-1 hover:bg-purple-100 rounded-xl text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center gap-1"
                              title="画像込みで再解析・更新"
                            >
                              <RefreshCw size={12} className={reAnalyzeLoading === item.id ? "animate-spin" : ""} />
                              {reAnalyzeLoading === item.id ? "解析中..." : "画像再解析"}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKnowledge(item.id, formatTitle(item));
                            }}
                            disabled={deleteLoading === item.id}
                            className="p-2 hover:bg-red-100 rounded-xl text-gray-500 hover:text-red-600 transition-all"
                            title="ナレッジ削除"
                          >
                            {deleteLoading === item.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                          <button className="text-gray-500 hover:text-pink-600 p-2">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* 短縮要約（展開されていない時に少し見せる） */}
                      {!isExpanded && (
                        <p className="text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-200">
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
                            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                              {/* 要約テキスト */}
                              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 leading-relaxed text-sm text-gray-700 whitespace-pre-wrap">
                                {item.content}
                              </div>

                              {/* 生テキスト（メタデータ）の表示がある場合 */}
                              {item.raw_content && (
                                <details className="group">
                                  <summary className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer list-none flex items-center gap-1 outline-none">
                                    <FileText size={12} />
                                    <span>生データ（インテリジェンス）を表示</span>
                                  </summary>
                                  <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-[10px] text-gray-500 max-h-48 overflow-y-auto whitespace-pre-wrap leading-normal font-mono select-all">
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

      {pendingPreview && (
        <KnowledgePreviewModal
          preview={pendingPreview}
          saving={confirmSaving}
          onConfirm={handleConfirmSave}
          onCancel={() => setPendingPreview(null)}
        />
      )}
    </div>
  );
}

export default function KnowledgeBase() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} className="flex items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-pink-500" /></div>}>
      <KnowledgeBaseContent />
    </Suspense>
  );
}
