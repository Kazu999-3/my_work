'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, Sparkles, BookOpen, Film } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import YoutubeQueueManager from '../youtube/YoutubeQueueManager';
import DiscordImportPanel from './DiscordImportPanel';
import PendingInsightsPanel from './PendingInsightsPanel';
import VideoDeepDiveRequestPanel from './VideoDeepDiveRequestPanel';
import KnowledgePreviewModal, { type KnowledgePreview } from './KnowledgePreviewModal';

function KnowledgeBaseContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // メインタブの状態 ('input' | 'queue' | 'pending')
  const [activeTab, setActiveTab] = useState<'input' | 'queue' | 'pending'>('input');

  // 入力サブモード ('url' | 'memo' | 'discord')
  const [inputSubMode, setInputSubMode] = useState<'url' | 'memo' | 'discord'>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [inputMemo, setInputMemo] = useState('');

  // AI解析結果のプレビュー
  const [pendingPreview, setPendingPreview] = useState<KnowledgePreview | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const searchParams = useSearchParams();

  // URLパラメータ (?tab=...) の自動反映（後方互換対応）
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'video' || tabParam === 'queue' || tabParam === 'youtube' || tabParam === 'pipelines') {
      setActiveTab('queue');
    } else if (tabParam === 'discord') {
      setActiveTab('input');
      setInputSubMode('discord');
    } else if (tabParam === 'memo') {
      setActiveTab('input');
      setInputSubMode('memo');
    } else if (tabParam === 'url') {
      setActiveTab('input');
      setInputSubMode('url');
    } else if (tabParam === 'pending') {
      setActiveTab('pending');
    } else {
      setActiveTab('input');
    }
  }, [searchParams]);

  // 認証の確認（タイムアウト付き）
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAuthenticated(prev => (prev === null ? false : prev));
    }, 3000);

    fetch('/api/auth/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(res => res.json())
      .then(data => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false))
      .finally(() => clearTimeout(timer));

    return () => clearTimeout(timer);
  }, []);

  const [pendingCount, setPendingCount] = useState<number>(0);

  const fetchPendingCount = () => {
    fetch('/api/admin/knowledge/pending-review', { credentials: 'include' })
      .then(res => res.json())
      .then(d => {
        if (d.success && Array.isArray(d.items)) {
          setPendingCount(d.items.length);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingCount();
    }
  }, [isAuthenticated, activeTab]);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const isYoutubeUrl = (url: string): boolean => {
    return /youtube\.com\/watch|youtu\.be\//i.test(url);
  };

  // ナレッジの追加（要約＆分類）
  const handleAddKnowledge = async (e: React.FormEvent, forceQueue: boolean = false) => {
    e.preventDefault();
    const payload = inputSubMode === 'url' ? { type: 'url', url: inputUrl } : { type: 'memo', memo: inputMemo, text: inputMemo };
    if (inputSubMode === 'url' && !inputUrl) {
      showFeedback('URLを入力してください。', 'error');
      return;
    }
    if (inputSubMode === 'memo' && !inputMemo) {
      showFeedback('メモ本文を入力してください。', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (inputSubMode === 'url' && (forceQueue || isYoutubeUrl(payload.url || ''))) {
        const res = await fetch('/api/admin/youtube', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload.url })
        });
        if (res.ok) {
          showFeedback('YouTube動画を解析キューに追加しました！(SREワーカーが順次解析します)', 'success');
          setInputUrl('');
          setActiveTab('queue');
        } else {
          const err = await res.json().catch(() => ({}));
          showFeedback(err.error || 'キュー追加に失敗しました。', 'error');
        }
      } else {
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
            showFeedback('ナレッジのAI要約・解析が完了しました！', 'success');
            if (inputSubMode === 'url') setInputUrl('');
            else setInputMemo('');
          }
        } else {
          const err = await res.json().catch(() => ({}));
          showFeedback(err.error || 'ナレッジの解析・追加に失敗しました。', 'error');
        }
      }
    } catch {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSave = async (data: any) => {
    setConfirmSaving(true);
    try {
      const res = await fetch('/api/admin/knowledge/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        showFeedback('ナレッジを保存し、チャンピオン辞典へ反映しました！', 'success');
        setPendingPreview(null);
        if (inputSubMode === 'url') setInputUrl('');
        else setInputMemo('');
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || '保存に失敗しました。', 'error');
      }
    } catch {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setConfirmSaving(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="animate-spin text-pink-500" size={24} />
        <p className="text-xs font-bold text-stone-400">認証状態を確認中...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-4">
        <div className="text-center rounded-3xl border border-stone-200/80 bg-white p-8 shadow-sm">
          <div className="text-4xl mb-3">🔑</div>
          <h2 className="text-base font-black text-stone-900 mb-2">管理者認証が必要です</h2>
          <p className="text-xs text-stone-500 mb-6 leading-relaxed">
            戦術取り込み ＆ AI解析ハブは管理者専用です。Discord管理者アカウントでログインしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-3 text-xs font-black text-stone-950 transition shadow-xs"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 p-3 sm:p-5">
      {/* ページヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-white border border-stone-200/90 rounded-2xl shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 shrink-0 text-amber-600">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900">戦術取り込み ＆ AI解析ハブ</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold">
                管理者専用
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              Web記事・X投稿・YouTube動画・実戦メモから知見を抽出し、チャンピオン辞典へ反映
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Link
            href="/library"
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-700 border border-stone-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            title="確定知見の書庫（攻略ライブラリ）を開く"
          >
            <span>🗂️ 攻略ライブラリ</span>
          </Link>
          <Link
            href="/admin/guide"
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            title="LoLデータ収集＆辞典＆コーチ連携の全貌仕様ガイドを開く"
          >
            <BookOpen size={14} className="text-amber-700" />
            <span>📖 全貌ガイド</span>
          </Link>
        </div>
      </motion.header>

      {/* フィードバックメッセージ */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎯 3大メインタブ（知見追加 / 動画解析キュー / 承認待ちナレッジ） */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200">
        <button
          type="button"
          onClick={() => setActiveTab('input')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'input'
              ? 'bg-white text-stone-900 shadow-xs font-black'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <Plus size={15} className={activeTab === 'input' ? 'text-amber-600' : 'text-stone-400'} />
          <span>知見の追加</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-white text-stone-900 shadow-xs font-black'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <Film size={14} className={activeTab === 'queue' ? 'text-indigo-600' : 'text-stone-400'} />
          <span>動画解析キュー</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
            activeTab === 'pending'
              ? 'bg-white text-emerald-800 border border-emerald-300 shadow-xs font-black'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <Sparkles size={14} className={activeTab === 'pending' ? 'text-emerald-600' : 'text-stone-400'} />
          <span>承認待ちナレッジ</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow-xs">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 1. 📥 知見の追加タブ */}
      {activeTab === 'input' && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-200/60">
                  <Plus size={15} />
                </span>
                <span>新しい知見を取り込む</span>
              </h2>

              {/* URL / メモ / Discordチャット のサブ切り替えピル */}
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setInputSubMode('url')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputSubMode === 'url'
                      ? 'bg-white text-stone-900 shadow-xs font-black'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  🌐 Web / X / YouTube URL
                </button>
                <button
                  type="button"
                  onClick={() => setInputSubMode('memo')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputSubMode === 'memo'
                      ? 'bg-white text-stone-900 shadow-xs font-black'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  📝 テキスト自由メモ
                </button>
                <button
                  type="button"
                  onClick={() => setInputSubMode('discord')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputSubMode === 'discord'
                      ? 'bg-white text-indigo-900 shadow-xs font-black'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  💬 Discordチャットログ解析
                </button>
              </div>
            </div>

            {inputSubMode === 'discord' ? (
              <DiscordImportPanel />
            ) : (
              <form onSubmit={(e) => handleAddKnowledge(e, false)} className="space-y-4">
                {inputSubMode === 'url' ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-600">
                      対象URL (Xポスト / Web攻略記事 / YouTube動画)
                    </label>
                    <input
                      type="url"
                      placeholder="https://x.com/... または Web攻略記事 / YouTube URL を入力..."
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-xs text-stone-900 placeholder-stone-400 font-mono transition-all"
                    />

                    {/* YouTube検知バナー */}
                    {isYoutubeUrl(inputUrl) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎥</span>
                          <span>YouTube動画が検出されました。動画解析キューへ追加して非同期に処理できます。</span>
                        </div>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={(e) => handleAddKnowledge(e, true)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] transition shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          ⏳ キューに追加
                        </button>
                      </div>
                    )}

                    <p className="text-[10px] text-stone-500 pl-0.5">
                      ※ X(Twitter)画像・動画やWeb記事をAIが自動要約。YouTube動画は自動的に解析キューへ送信され、要約・実演シーン抽出が行われます。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-600">
                      戦術メモ・気付き・立ち回りノウハウ
                    </label>
                    <textarea
                      rows={6}
                      placeholder="マッチアップの気付き、ビルドの没理由、立ち回りノウハウを自由に入力..."
                      value={inputMemo}
                      onChange={(e) => setInputMemo(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-xs text-stone-900 placeholder-stone-400 resize-none leading-relaxed transition-all"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{inputSubMode === 'url' ? 'AI解析を実行' : 'AIによる分類・保存'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2. 🎥 動画解析キュータブ */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          <VideoDeepDiveRequestPanel />
          <YoutubeQueueManager />
        </div>
      )}

      {/* 3. 🧩 承認待ちナレッジタブ */}
      {activeTab === 'pending' && <PendingInsightsPanel />}

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
