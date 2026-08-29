'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import YoutubeQueueManager from '../youtube/YoutubeQueueManager';
import DiscordImportPanel from './DiscordImportPanel';
import KnowledgePreviewModal, { type KnowledgePreview } from './KnowledgePreviewModal';

function KnowledgeBaseContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // 入力フォームの状態
  const [ingestMode, setIngestMode] = useState<'url' | 'memo' | 'discord' | 'queue'>('url');
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
    const payload = ingestMode === 'url' ? { type: 'url', url: inputUrl } : { type: 'memo', memo: inputMemo };
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
    <div className="w-full space-y-4">
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

      {/* モード切り替えバー */}
      <div className="flex gap-1.5 bg-stone-100 p-1 rounded-xl w-fit flex-wrap border border-stone-200/60">
        <button
          onClick={() => setIngestMode('url')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            ingestMode === 'url' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          🌐 Web / X / YouTube 要約
        </button>
        <button
          onClick={() => setIngestMode('memo')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            ingestMode === 'memo' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          📝 テキストメモ保存
        </button>
        <button
          onClick={() => setIngestMode('discord')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            ingestMode === 'discord' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          💬 Discord ログ解析
        </button>
        <button
          onClick={() => setIngestMode('queue')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            ingestMode === 'queue' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          ⏳ 動画解析キュー
        </button>
      </div>

      {ingestMode === 'discord' && <DiscordImportPanel />}
      {ingestMode === 'queue' && <YoutubeQueueManager />}

      {(ingestMode === 'url' || ingestMode === 'memo') && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <Plus size={16} className="text-pink-500" />
            {ingestMode === 'url' ? 'Web記事・X投稿・YouTube動画を取り込む' : '戦術メモ・気付きを登録する'}
          </h2>

          <form onSubmit={handleAddKnowledge} className="space-y-4">
            {ingestMode === 'url' ? (
              <div className="space-y-1">
                <input
                  type="url"
                  placeholder="https://x.com/username/status/12345... または Web記事 / YouTube URL..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-pink-500 focus:bg-white text-xs text-stone-900 placeholder-stone-400 font-mono"
                />
                <p className="text-[10px] text-stone-500 pl-1">
                  ※ X(Twitter)画像・動画やWeb記事をAIが自動要約。YouTube動画は自動的に解析キューへ送信されます。
                </p>
              </div>
            ) : (
              <textarea
                rows={5}
                placeholder="戦術メモ、マッチアップの気付き、立ち回りノウハウを記入..."
                value={inputMemo}
                onChange={(e) => setInputMemo(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-pink-500 focus:bg-white text-xs text-stone-900 placeholder-stone-400 resize-none leading-relaxed"
              />
            )}

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition-all shadow-md shadow-pink-600/20 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {ingestMode === 'url' ? '要約・解析を実行' : 'AIによる分類・保存'}
            </button>
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
