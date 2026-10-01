"use client";

import React, { useState } from 'react';
import { Inbox, X, Send, Sparkles, CheckCircle2 } from 'lucide-react';

interface QuickInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickInboxModal({ isOpen, onClose }: QuickInboxModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/inbox/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, author: 'WebPortal' }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.message || 'インボックスへ投函されました！');
        setTitle('');
        setContent('');
        setTimeout(() => {
          setSuccessMsg(null);
          onClose();
        }, 1800);
      } else {
        setErrorMsg(data.error || '投函に失敗しました');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-border/80 bg-background/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-edge-strong/30 flex items-center justify-center text-primary-700">
              <Inbox size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground flex items-center gap-1.5">
                帝国インボックス（クイックメモ投函）
              </h3>
              <p className="text-xs text-muted-strong">
                未整理のメモを放り込むだけでAIがTOMO式3層に自動構造化
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-faint hover:text-foreground-subtle hover:bg-surface-hover/60 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-danger-50 border border-danger-edge-soft rounded-xl text-xs text-danger-700 font-bold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-foreground mb-1">
              タイトル / メモの主題
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="例: パッチ26.15のLv3トップガンク成功パターン..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-border focus:border-primary-edge-strong focus:bg-surface rounded-xl p-2.5 text-foreground font-bold outline-none text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-foreground mb-1">
              メモ本文・思考の断片
            </label>
            <textarea
              required
              rows={5}
              placeholder="走り書き、気づき、箇条書き、参考URLなどをそのまま貼り付けてください。AIが後ほど自動で構造化・原本退避します。"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full bg-background border border-border focus:border-primary-edge-strong focus:bg-surface rounded-xl p-2.5 text-foreground font-medium outline-none text-xs leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-faint flex items-center gap-1 font-bold">
              <Sparkles size={13} className="text-primary-600" /> 原本非破壊で自動アーカイブ
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-muted font-bold text-xs transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim() || !content.trim()}
                className="px-4 py-1.5 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-stone-950 font-black text-xs transition flex items-center gap-1.5 shadow-xs"
              >
                {loading ? '投函中...' : (
                  <>
                    <Send size={13} />
                    <span>インボックスへ投函</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
