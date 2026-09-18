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
      {/* ヘッダー情報 */}
      <div className="bg-gradient-to-r from-amber-500/10 via-stone-900 to-stone-900 border border-amber-500/20 rounded-2xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-stone-100">
              📮 ナレッジ誤り訂正インボックス (FEEDBACK_INBOX)
            </h3>
          </div>
          <button
            type="button"
            onClick={fetchItems}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-bold transition border border-stone-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>更新</span>
          </button>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          実戦や読書で発見した「情報の誤り・古いパッチ表記・違和感」を即座に投函する単一ポストです。
          ここに投函された指摘は、次回の Antigravity / AI 開発セッションで優先的に自動修正＆スモークテストされます。
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* 新規投函フォーム */}
      <form onSubmit={handleSubmit} className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-black text-stone-200 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-amber-400" />
          <span>新しい誤り・違和感を投函する</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="対象ファイル（例: JarvanIV辞典, RUNBOOK.md）"
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 outline-none focus:border-amber-500"
          />
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="指摘内容（例: Wのシールド計算が旧パッチのままです）"
            required
            className="md:col-span-2 px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newContent.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black text-xs rounded-xl transition cursor-pointer"
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
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black text-stone-200">
              未対応の指摘 ({pendingItems.length} 件)
            </h4>
          </div>
          {pendingItems.length === 0 && (
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              ALL CLEAR
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-stone-500 animate-pulse font-bold">
            インボックスを読み込み中...
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="p-8 text-center bg-stone-900/40 border border-stone-800/80 rounded-2xl text-xs text-stone-500 font-bold space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500/60 mx-auto mb-2" />
            <p>未処理の指摘・違和感はありません。</p>
            <p className="text-[10px] text-stone-600">ナレッジベースはクリーンで健全な状態です。</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-stone-900/90 border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-3.5 flex items-start justify-between gap-3 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {item.date}
                    </span>
                    <span className="text-[11px] font-black text-stone-300 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-stone-400" />
                      {item.source}
                    </span>
                  </div>
                  <p className="text-xs text-stone-200 font-medium leading-relaxed">
                    {item.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 text-stone-400 border border-stone-700 transition cursor-pointer"
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
            <CheckCircle2 className="w-4 h-4 text-stone-500" />
            <h4 className="text-xs font-bold text-stone-400">
              対応完了・修正済み ({completedItems.length} 件)
            </h4>
          </div>
          <div className="space-y-2 opacity-60">
            {completedItems.map((item) => (
              <div
                key={item.id}
                className="bg-stone-900/40 border border-stone-800/80 rounded-xl p-3 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-800 text-stone-400">
                      {item.date}
                    </span>
                    <span className="text-[11px] font-bold text-stone-400 line-through">
                      {item.source}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 line-through">
                    {item.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-stone-800 text-stone-500 hover:text-stone-300 transition cursor-pointer"
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
