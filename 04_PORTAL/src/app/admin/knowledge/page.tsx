'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import YoutubeQueueManager from '../youtube/YoutubeQueueManager';
import DiscordImportPanel from './DiscordImportPanel';
import FeedbackInboxPanel from './FeedbackInboxPanel';
import PendingInsightsPanel from './PendingInsightsPanel';
import VideoDeepDiveRequestPanel from './VideoDeepDiveRequestPanel';
import KnowledgePreviewModal, { type KnowledgePreview } from './KnowledgePreviewModal';

function KnowledgeBaseContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // 入力フォームの状態
  const [ingestMode, setIngestMode] = useState<'url' | 'memo' | 'discord' | 'queue' | 'inbox' | 'pending'>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [inputMemo, setInputMemo] = useState('');

  // AI解析結果のプレビュー
  const [pendingPreview, setPendingPreview] = useState<KnowledgePreview | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const searchParams = useSearchParams();

  // URLパラメータ (?tab=...) の自動反映
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'video' || tabParam === 'queue') {
      setIngestMode('queue');
    } else if (tabParam === 'discord') {
      setIngestMode('discord');
    } else if (tabParam === 'memo') {
      setIngestMode('memo');
    } else if (tabParam === 'inbox') {
      setIngestMode('inbox');
    } else {
      setIngestMode('url');
    }
  }, [searchParams]);

  // 認証の確認
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const isYoutubeUrl = (url: string): boolean => {
    return /youtube\.com\/watch|youtu\.be\//i.test(url);
  };

  // ナレッジの追加（要約＆分類）
  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = ingestMode === 'url' ? { type: 'url', url: inputUrl } : { type: 'memo', memo: inputMemo, text: inputMemo };
    if (ingestMode === 'url' && !inputUrl) {
      showFeedback('URLを入力してください。', 'error');
      return;
    }
    if (ingestMode === 'memo' && !inputMemo) {
      showFeedback('メモ本文を入力してください。', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (ingestMode === 'url' && isYoutubeUrl(payload.url || '')) {
        const res = await fetch('/api/admin/youtube', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload.url })
        });
        if (res.ok) {
          showFeedback('YouTube動画を解析キューに追加しました！(SREデーモンが順次要約します)', 'success');
          setInputUrl('');
          setIngestMode('queue');
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
            if (ingestMode === 'url') setInputUrl('');
            else setInputMemo('');
          }
        } else {
          const err = await res.json().catch(() => ({}));
          showFeedback(err.error || 'ナレッジの解析・追加に失敗しました。', 'error');
        }
      }
    } catch (err) {
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
        if (ingestMode === 'url') setInputUrl('');
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
    return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-pink-500" size={24} /></div>;
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

      {/* モード切り替えセグメントコントロール */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setIngestMode('url')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            ingestMode === 'url' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <span>🌐 Web / X / YouTube 要約</span>
        </button>
        <button
          type="button"
          onClick={() => setIngestMode('memo')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            ingestMode === 'memo' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <span>📝 テキストメモ保存</span>
        </button>
        <button
          type="button"
          onClick={() => setIngestMode('discord')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            ingestMode === 'discord' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <span>💬 Discord ログ解析</span>
        </button>
        <button
          type="button"
          onClick={() => setIngestMode('queue')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            ingestMode === 'queue' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <span>⏳ 動画解析キュー</span>
        </button>
        <button
          type="button"
          onClick={() => setIngestMode('inbox')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            ingestMode === 'inbox' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <span>📮 指摘インボックス</span>
        </button>
        <button
          type="button"
          onClick={() => setIngestMode('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            ingestMode === 'pending' ? 'bg-white text-emerald-800 border border-emerald-300 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <span>✅ 承認待ちナレッジ</span>
        </button>
      </div>

      {ingestMode === 'discord' && <DiscordImportPanel />}
      {ingestMode === 'queue' && (
        <div className="space-y-6">
          <VideoDeepDiveRequestPanel />
          <YoutubeQueueManager />
        </div>
      )}
      {ingestMode === 'inbox' && <FeedbackInboxPanel />}
      {ingestMode === 'pending' && <PendingInsightsPanel />}

      {(ingestMode === 'url' || ingestMode === 'memo') && (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-200/60">
              <Plus size={15} />
            </span>
            <span>{ingestMode === 'url' ? 'Web記事・X投稿・YouTube動画の取り込み' : '戦術メモ・気付きの登録'}</span>
          </h2>

          <form onSubmit={handleAddKnowledge} className="space-y-4">
            {ingestMode === 'url' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-600">
                  対象URL (Xポスト / Web攻略記事 / YouTube動画)
                </label>
                <input
                  type="url"
                  placeholder="https://x.com/username/status/12345... または Web記事 / YouTube URL..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-xs text-stone-900 placeholder-stone-400 font-mono transition-all"
                />
                <p className="text-[10px] text-stone-500 pl-0.5">
                  ※ X(Twitter)画像・動画やWeb記事をAIが自動要約。YouTube動画は自動的に解析キューへ送信され、要約・実演シーン抽出が行われます。
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-600">
                  戦術メモ・立ち回りノウハウ
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

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{ingestMode === 'url' ? '要約・解析を実行' : 'AIによる分類・保存'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

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
