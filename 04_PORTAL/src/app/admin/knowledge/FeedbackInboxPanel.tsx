'use client';

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Clock, AlertCircle, Plus, Send, RefreshCw, FileText } from 'lucide-react';

interface FeedbackItem {
  id: number;
  raw: string;
  completed: boolean;
  date: string;
  source: string;
  content: string;
}

export default function FeedbackInboxPanel() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchItems = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/feedback-inbox');
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        setMessage({ text: data.error || 'データの取得に失敗しました', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleToggle = async (item: FeedbackItem) => {
    try {
      const res = await fetch('/api/admin/feedback-inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, targetRaw: item.raw }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
      } else {
        setMessage({ text: data.error || '更新に失敗しました', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/feedback-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: newSource.trim() || 'ポータル投函', content: newContent.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: '指摘を投函しました。次回のAIセッションで自動訂正されます。', type: 'success' });
        setNewSource('');
        setNewContent('');
        fetchItems();
      } else {
        setMessage({ text: data.error || '投函に失敗しました', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingItems = items.filter(i => !i.completed);
  const completedItems = items.filter(i => i.completed);

  return (
    <div className="space-y-6">
      {/* 💡 機能概要バナー */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">
                📮 ナレッジ誤り・パッチ訂正の目安箱 (FEEDBACK_INBOX)
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                攻略の古い数値・違和感を発見した際に投函するメモポストです。次回AIセッション時に自動修正されます。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchItems}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-stone-700 rounded-xl text-xs font-bold transition border border-stone-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>更新</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' 
            : 'bg-rose-50 border border-rose-300 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* 新規投函フォーム */}
      <form onSubmit={handleSubmit} className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3.5">
        <h4 className="text-xs font-black text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2.5">
          <Plus className="w-4 h-4 text-amber-500" />
          <span>新しい誤り・違和感を投函する</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="対象ファイル（例: JarvanIV辞典, RUNBOOK.md）"
            className="px-3.5 py-2.5 bg-stone-50/80 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="指摘内容（例: Wのシールド計算が旧パッチのままです）"
            required
            className="md:col-span-2 px-3.5 py-2.5 bg-stone-50/80 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={submitting || !newContent.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? '投函中...' : 'インボックスへ投函'}</span>
          </button>
        </div>
      </form>

      {/* 未対応リスト */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-black text-stone-900">
              未対応の指摘 ({pendingItems.length} 件)
            </h4>
          </div>
          {pendingItems.length === 0 && (
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
              ALL CLEAR
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-stone-500 animate-pulse font-bold">
            インボックスを読み込み中...
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-600 font-bold space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <p>未処理の指摘・違和感はありません。</p>
            <p className="text-[10px] text-stone-500">ナレッジベースはクリーンで健全な状態です。</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-stone-200 hover:border-amber-500/40 rounded-xl p-4 flex items-start justify-between gap-3 shadow-xs transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {item.date}
                    </span>
                    <span className="text-[11px] font-black text-stone-900 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-stone-400" />
                      {item.source}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 font-medium leading-relaxed">
                    {item.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-stone-700 border border-stone-200 transition cursor-pointer"
                >
                  完了済みにする
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 完了済みリスト */}
      {completedItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-stone-400" />
            <h4 className="text-xs font-bold text-stone-500">
              対応完了・修正済み ({completedItems.length} 件)
            </h4>
          </div>
          <div className="space-y-2 opacity-70">
            {completedItems.map((item) => (
              <div
                key={item.id}
                className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-600">
                      {item.date}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500 line-through">
                      {item.source}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 line-through">
                    {item.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded bg-stone-200 text-stone-600 hover:text-stone-900 transition cursor-pointer"
                >
                  未完了に戻す
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
