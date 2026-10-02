'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { 
  Video, ArrowLeft, Search, Plus, RefreshCw, Trash2, RotateCcw, 
  ExternalLink, CheckCircle2, Clock, AlertTriangle, Play, Sparkles
} from 'lucide-react';

interface QueueItem {
  id: string;
  title: string;
  channel_name?: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: 'high' | 'medium' | 'low';
  retry_count: number;
  /** UNIX秒（DBはbigint） */
  date_added: number | null;
  published_at?: string;
}

function YoutubeQueueManagerContent() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchQueue = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/youtube/queue?limit=100');
      if (res.ok) {
        const json = await res.json();
        setQueue(json.items || []);
      } else {
        showMessage('キューの取得に失敗しました', 'error');
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/youtube/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, title: newTitle, priority: 'medium' }),
      });
      const json = await res.json();
      if (res.ok) {
        showMessage(json.message || '動画をキューに登録しました', 'success');
        setNewUrl('');
        setNewTitle('');
        fetchQueue(true);
      } else {
        showMessage(json.error || '登録に失敗しました', 'error');
      }
    } catch {
      showMessage('登録通信エラーが発生しました', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この動画をキューからクローズしますか？（記録は残り、監視で再登録されなくなります）')) return;
    setActionLoading('delete_' + id);
    try {
      const res = await fetch(`/api/youtube/queue?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('クローズしました', 'success');
        setQueue((prev) => prev.filter((item) => item.id !== id));
      } else {
        showMessage('クローズに失敗しました', 'error');
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (id: string) => {
    setActionLoading('retry_' + id);
    try {
      const res = await fetch('/api/youtube/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'pending', resetRetries: true }),
      });
      if (res.ok) {
        showMessage('ステータスを待機中(pending)にリセットしました', 'success');
        fetchQueue(true);
      } else {
        showMessage('リトライ処理に失敗しました', 'error');
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      const matchSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item.channel_name && item.channel_name.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [queue, search, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: queue.length,
      pending: queue.filter((q) => q.status === 'pending').length,
      processing: queue.filter((q) => q.status === 'processing').length,
      completed: queue.filter((q) => q.status === 'completed').length,
      failed: queue.filter((q) => q.status === 'failed').length,
    };
  }, [queue]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ページタイトル ＆ アクション */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Video className="w-6 h-6 md:w-7 md:h-7 text-rose-500" />
              📼 YouTube動画解析センター
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              YouTubeのプロ・チャレンジャー解説動画をキューイングし、自動解析して戦術ライブラリへ蓄積します。
            </p>
          </div>

          <button
            onClick={() => fetchQueue()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>

        {/* トースト通知 */}
        {message && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/80 border-rose-700/60 text-rose-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* 新規登録フォーム */}
        <form onSubmit={handleAdd} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-rose-400" /> 新規動画をキューに登録
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="YouTube URL (例: https://www.youtube.com/watch?v=... または youtu.be/...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
              className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <input
              type="text"
              placeholder="動画タイトル (任意)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:w-72 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={submitting || !newUrl}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-bold text-white transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              登録
            </button>
          </div>
        </form>

        {/* ステータスサマリー */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setFilterStatus('all')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'all'
                ? 'bg-slate-800 border-indigo-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-medium">全動画</div>
            <div className="text-lg font-black text-white mt-0.5">{stats.total}</div>
          </button>

          <button
            onClick={() => setFilterStatus('pending')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'pending'
                ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>⏳ 待機中</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-black text-amber-300 mt-0.5">{stats.pending}</div>
          </button>

          <button
            onClick={() => setFilterStatus('processing')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'processing'
                ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>⚡ 解析中</span>
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
            </div>
            <div className="text-lg font-black text-sky-300 mt-0.5">{stats.processing}</div>
          </button>

          <button
            onClick={() => setFilterStatus('completed')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'completed'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>✅ 完了</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">{stats.completed}</div>
          </button>

          <button
            onClick={() => setFilterStatus('failed')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'failed'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>❌ エラー</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-black text-rose-300 mt-0.5">{stats.failed}</div>
          </button>
        </div>

        {/* 検索バー */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="タイトルや動画IDで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* キュー一覧 */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">動画情報</th>
                  <th className="py-3 px-3">ステータス</th>
                  <th className="py-3 px-3">優先度</th>
                  <th className="py-3 px-3 hidden md:table-cell">追加日時</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <div className="inline-block animate-spin w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full mr-2 align-middle" />
                      キューを取得中...
                    </td>
                  </tr>
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      対象の動画はありません
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 max-w-md">
                        <div className="space-y-1">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-slate-200 hover:text-rose-400 transition-colors flex items-center gap-1.5"
                          >
                            <span className="truncate">{item.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          </a>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>ID: {item.id}</span>
                            {item.channel_name && <span className="text-slate-400">• {item.channel_name}</span>}
                            {item.retry_count > 0 && (
                              <span className="text-amber-400">• リトライ: {item.retry_count}回</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.status === 'completed'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                              : item.status === 'processing'
                              ? 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                              : item.status === 'failed'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                              : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                          }`}
                        >
                          {item.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                          {item.status === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {item.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                          {item.status === 'pending' && <Clock className="w-3 h-3" />}
                          {item.status === 'completed' && '完了'}
                          {item.status === 'processing' && '解析中'}
                          {item.status === 'failed' && 'エラー'}
                          {item.status === 'pending' && '待機中'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          {item.priority || 'medium'}
                        </span>
                      </td>

                      <td className="py-3 px-3 hidden md:table-cell text-[11px] text-slate-500">
                        {item.date_added ? new Date(Number(item.date_added) * 1000).toLocaleString('ja-JP') : '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'completed' && (
                            <Link
                              href={`/library?q=${encodeURIComponent(item.title.slice(0, 30))}`}
                              className="px-2.5 py-1 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-[10px] font-bold hover:bg-indigo-900 transition-colors flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              記事を見る
                            </Link>
                          )}

                          <button
                            onClick={() => handleRetry(item.id)}
                            disabled={actionLoading === 'retry_' + item.id}
                            title="再試行(待機中に戻す)"
                            className="p-1.5 rounded bg-slate-950 border border-slate-800 text-amber-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={actionLoading === 'delete_' + item.id}
                            title="キューからクローズ"
                            className="p-1.5 rounded bg-slate-950 border border-slate-800 text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function YoutubeQueuePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs">ロード中...</div>}>
      <YoutubeQueueManagerContent />
    </Suspense>
  );
}
