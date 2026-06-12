'use client';

import React, { useState, useEffect } from 'react';

interface QueueItem {
  id: string;
  title: string;
  channel_name?: string;
  url: string;
  status: string;
  retry_count: number;
  priority?: 'high' | 'medium' | 'low';
  published_at?: string;
}

export default function YoutubeQueueManager() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 特定のIDの処理中フラグ
  const [newUrl, setNewUrl] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_added' | 'published_at'>('date_added');

  // 1. キューデータの取得
  const fetchQueue = async (silent = false, currentSort = sortBy) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/admin/youtube?sort=${currentSort}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      } else {
        showFeedback('データの取得に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('エラーが発生しました。', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(false, sortBy);
  }, []);

  const handleSortChange = (newSort: 'date_added' | 'published_at') => {
    setSortBy(newSort);
    fetchQueue(true, newSort);
  };

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // 2. 新規動画の追加
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setActionLoading('add');
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(result.message || '動画を追加しました。', 'success');
        setNewUrl('');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || '動画の追加に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 3. 動画ステータスの更新 (再試行)
  const handleRetryVideo = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'pending' }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('ステータスを pending にリセットしました。SREデーモンが再解析します。', 'success');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || '再試行に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 4. 動画の削除
  const handleDeleteVideo = async (id: string) => {
    if (!confirm('この動画をキューから削除しますか？')) return;

    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('動画をキューから削除しました。', 'success');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || '削除に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 5. 優先度のトグル変更
  const handleTogglePriority = async (id: string, currentPriority?: string) => {
    const p = currentPriority || 'medium';
    const nextPriority = p === 'high' ? 'medium' : p === 'medium' ? 'low' : 'high';
    
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priority: nextPriority }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(`優先度を「${nextPriority === 'high' ? '高' : nextPriority === 'low' ? '低' : '中'}」に変更しました。`, 'success');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || '優先度の変更に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 6. 保留/再開の切り替え
  const handleToggleHold = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'on_hold' ? 'pending' : 'on_hold';
    
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(nextStatus === 'on_hold' ? '動画を保留にしました。SREの自動解析から除外されます。' : '保留を解除しました。次回サイクルで解析されます。', 'success');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || 'ステータスの更新に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 優先度バッジのスタイル定義
  const getPriorityBadge = (priority?: string) => {
    const p = priority || 'medium';
    let classes = 'px-3 py-1 text-xs font-semibold rounded-full border ';
    let label = '優先度: 中';
    if (p === 'high') {
      classes += 'bg-red-950/40 text-red-400 border-red-800/60';
      label = '優先度: 高';
    } else if (p === 'low') {
      classes += 'bg-gray-950/40 text-gray-500 border-gray-800/60';
      label = '優先度: 低';
    } else {
      classes += 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      label = '優先度: 中';
    }
    return <span className={classes}>{label}</span>;
  };

  // ステータスバッジのスタイル定義
  const getStatusBadge = (status: string) => {
    let classes = 'px-3 py-1 text-xs font-semibold rounded-full border ';
    if (status === 'completed') {
      classes += 'bg-green-950/40 text-green-400 border-green-800/60';
    } else if (status === 'on_hold') {
      classes += 'bg-yellow-950/40 text-yellow-400 border-yellow-800/60';
    } else if (status === 'pending') {
      classes += 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60 animate-pulse';
    } else if (status === 'failed') {
      classes += 'bg-red-950/40 text-red-400 border-red-800/60';
    } else if (status.startsWith('error')) {
      classes += 'bg-orange-950/40 text-orange-400 border-orange-800/60';
    } else {
      classes += 'bg-gray-950/40 text-gray-400 border-gray-800/60';
    }
    return <span className={classes}>{status === 'on_hold' ? 'on hold (保留)' : status}</span>;
  };

  // 統計の計算
  const stats = {
    total: queue.length,
    pending: queue.filter((i) => i.status === 'pending').length,
    completed: queue.filter((i) => i.status === 'completed').length,
    error: queue.filter((i) => i.status.startsWith('error') || i.status === 'failed').length,
  };

  const filteredQueue = queue.filter((item) => {
    // 1. ステータスでの絞り込み
    if (filterStatus === 'pending' && item.status !== 'pending') return false;
    if (filterStatus === 'completed' && item.status !== 'completed') return false;
    if (filterStatus === 'error' && !(item.status.startsWith('error') || item.status === 'failed')) return false;

    // 2. 検索キーワードでの絞り込み (タイトル or チャンネル名 or ID)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(query);
      const channelMatch = item.channel_name?.toLowerCase().includes(query) || false;
      const idMatch = item.id.toLowerCase().includes(query);
      return titleMatch || channelMatch || idMatch;
    }

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-cyan-400">
            📺 YouTube Absorber コマンドセンター
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            攻略動画の字幕テキストを自動抽出・AI解析し、戦略バイブルへとライブラリ化します。
          </p>
        </div>
      </div>

      {/* フィードバックメッセージ */}
      {message && (
        <div
          className={`p-4 rounded-lg border text-sm transition-all duration-300 ${
            message.type === 'success'
              ? 'bg-green-950/30 text-green-400 border-green-800/60 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
              : 'bg-red-950/30 text-red-400 border-red-800/60 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 統計パネル */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0f111a] border border-gray-800/80 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">総登録本数</span>
          <span className="text-2xl font-bold mt-1 text-gray-200">{stats.total} 本</span>
        </div>
        <div className="bg-[#0f111a] border border-cyan-900/40 rounded-xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(6,182,212,0.02)]">
          <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">解析待ち</span>
          <span className="text-2xl font-bold mt-1 text-cyan-300">{stats.pending} 本</span>
        </div>
        <div className="bg-[#0f111a] border border-green-900/40 rounded-xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(34,197,94,0.02)]">
          <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">完了済み</span>
          <span className="text-2xl font-bold mt-1 text-green-300">{stats.completed} 本</span>
        </div>
        <div className="bg-[#0f111a] border border-red-900/40 rounded-xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(239,68,68,0.02)]">
          <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">エラー/リトライ超過</span>
          <span className="text-2xl font-bold mt-1 text-red-300">{stats.error} 本</span>
        </div>
      </div>

      {/* 動画追加フォーム */}
      <div className="bg-[#0f111a] border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-500" />
        <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span>➕ 攻略動画の自動解析指示</span>
        </h2>
        <form onSubmit={handleAddVideo} className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            disabled={actionLoading === 'add'}
            className="flex-1 px-4 py-3 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-gray-200 placeholder-gray-600 transition-all"
          />
          <button
            type="submit"
            disabled={actionLoading === 'add' || !newUrl.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center min-w-[140px]"
          >
            {actionLoading === 'add' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-gray-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                登録中...
              </span>
            ) : (
              'キューに追加'
            )}
          </button>
        </form>
      </div>

      {/* 検索 ＆ フィルターバー */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#0f111a] border border-gray-800/80 rounded-2xl p-4 shadow-md">
        {/* ステータスタブ */}
        <div className="flex flex-wrap gap-1 bg-[#07080e] p-1 rounded-xl border border-gray-800/60 w-full md:w-auto">
          {[
            { id: 'all', label: 'すべて', count: stats.total },
            { id: 'pending', label: '解析待ち', count: stats.pending, color: 'text-cyan-400' },
            { id: 'completed', label: '完了', count: stats.completed, color: 'text-green-400' },
            { id: 'error', label: 'エラー/失敗', count: stats.error, color: 'text-red-400' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === tab.id
                  ? 'bg-amber-500 text-gray-950 shadow-md'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <span className={filterStatus === tab.id ? 'text-gray-950' : tab.color}>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filterStatus === tab.id ? 'bg-gray-950/20 text-gray-950' : 'bg-gray-900 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 検索 ＆ ソート */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* ソート順選択 */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as any)}
              className="px-3 py-2 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 text-xs text-gray-300 w-full sm:w-auto appearance-none pr-8 cursor-pointer font-bold"
            >
              <option value="date_added">登録日順</option>
              <option value="published_at">投稿日順</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>

          {/* 検索窓 */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="タイトル、チャンネルで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs text-gray-200"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* キュー一覧リスト */}
      <div className="bg-[#0f111a] border border-gray-800/80 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-gray-800/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-200">📋 登録動画キュー一覧</h2>
          <button
            onClick={() => fetchQueue(false)}
            disabled={loading}
            className="p-2 hover:bg-gray-800/60 rounded-lg text-gray-400 hover:text-gray-200 transition-all"
            title="リフレッシュ"
          >
            <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <svg className="animate-spin h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-400">キュー情報を読み込み中...</span>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-20 text-center text-gray-500 text-sm">
            該当する動画がありません。
          </div>
        ) : (
          <>
            {/* モバイル用カードレイアウト (md未満で表示) */}
            <div className="block md:hidden divide-y divide-gray-800/40">
              {filteredQueue.map((item) => (
                <div key={item.id} className="p-4 space-y-3 hover:bg-[#0c0d15]/40 transition-all flex flex-col">
                  <div className="flex gap-3 items-start">
                    <img 
                      src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`} 
                      className="w-20 h-12 object-cover rounded border border-gray-800 shrink-0 shadow-sm" 
                      alt="thumbnail" 
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-gray-200 text-sm line-clamp-2 leading-snug" title={item.title}>
                        {item.title}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.channel_name && (
                        <span className="text-gray-400 bg-gray-900/60 px-1.5 py-0.5 rounded border border-gray-800/80">
                          {item.channel_name}
                        </span>
                      )}
                      {item.published_at && (
                        <span className="text-gray-500 bg-gray-900/40 px-1.5 py-0.5 rounded border border-gray-800/40 font-medium">
                          投稿: {item.published_at}
                        </span>
                      )}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <span>{item.id}</span>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-[#07080e] p-2 rounded-lg border border-gray-800/40 text-[10px] font-bold">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.status)}
                      {item.retry_count > 0 && item.status !== 'completed' && (
                        <span className="text-gray-500">({item.retry_count}/5)</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleTogglePriority(item.id, item.priority)}
                      disabled={actionLoading !== null}
                      type="button"
                      className="hover:brightness-125 transition-all"
                    >
                      {getPriorityBadge(item.priority)}
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {item.status !== 'completed' && (
                      <button
                        onClick={() => handleToggleHold(item.id, item.status)}
                        disabled={actionLoading !== null}
                        type="button"
                        className={`flex-1 py-2 border text-xs font-semibold rounded-lg disabled:opacity-40 transition-all text-center ${
                          item.status === 'on_hold'
                            ? 'bg-yellow-950/20 hover:bg-yellow-950/50 border-yellow-900/40 text-yellow-400'
                            : 'bg-gray-950/20 hover:bg-gray-950/50 border-gray-800/40 text-gray-400'
                        }`}
                      >
                        {item.status === 'on_hold' ? '保留解除' : '保留にする'}
                      </button>
                    )}
                    {(item.status.startsWith('error') || item.status === 'failed') && (
                      <button
                        onClick={() => handleRetryVideo(item.id)}
                        disabled={actionLoading !== null}
                        type="button"
                        className="flex-1 py-2 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-400 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all text-center"
                      >
                        {actionLoading === item.id ? '処理中...' : '再試行'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteVideo(item.id)}
                      disabled={actionLoading !== null}
                      type="button"
                      className="flex-1 py-2 bg-red-950/20 hover:bg-red-950/50 border border-red-900/40 text-red-400 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all text-center"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* PC用テーブルレイアウト (md以上で表示) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800/60 text-xs text-gray-400 uppercase bg-[#08090f]">
                    <th className="px-6 py-4 font-semibold">動画情報</th>
                    <th className="px-6 py-4 font-semibold">ステータス / 優先度</th>
                    <th className="px-6 py-4 font-semibold text-right">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 text-sm text-gray-300">
                  {filteredQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-[#0c0d15]/60 transition-all duration-150">
                      <td className="px-6 py-4 max-w-lg">
                        <div className="flex gap-3 items-center">
                          <img 
                            src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`} 
                            className="w-16 h-10 object-cover rounded border border-gray-800 shrink-0 shadow-sm" 
                            alt="thumbnail" 
                          />
                          <div className="flex flex-col space-y-1 min-w-0">
                            <span className="font-bold text-gray-200 truncate block" title={item.title}>
                              {item.title}
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              {item.channel_name && (
                                <span className="text-gray-400 bg-gray-900/60 px-1.5 py-0.5 rounded border border-gray-800/80">
                                  {item.channel_name}
                                </span>
                              )}
                              {item.published_at && (
                                <span className="text-gray-500 bg-gray-900/40 px-1.5 py-0.5 rounded border border-gray-800/40 font-medium">
                                  投稿: {item.published_at}
                                </span>
                              )}
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline flex items-center gap-1 w-fit"
                              >
                                <span>{item.id}</span>
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {getStatusBadge(item.status)}
                          <button
                            onClick={() => handleTogglePriority(item.id, item.priority)}
                            disabled={actionLoading !== null}
                            type="button"
                            className="hover:brightness-125 transition-all"
                            title="クリックして優先度をトグル変更"
                          >
                            {getPriorityBadge(item.priority)}
                          </button>
                          {item.retry_count > 0 && item.status !== 'completed' && (
                            <span className="text-xs text-gray-500 font-medium">リトライ: ({item.retry_count}/5)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {item.status !== 'completed' && (
                            <button
                              onClick={() => handleToggleHold(item.id, item.status)}
                              disabled={actionLoading !== null}
                              type="button"
                              className={`px-3 py-1.5 border text-xs font-semibold rounded-lg disabled:opacity-40 transition-all ${
                                item.status === 'on_hold'
                                  ? 'bg-yellow-950/20 hover:bg-yellow-950/50 border-yellow-900/40 text-yellow-400'
                                  : 'bg-gray-950/20 hover:bg-gray-950/50 border-gray-800/40 text-gray-400'
                              }`}
                            >
                              {item.status === 'on_hold' ? '保留解除' : '保留'}
                            </button>
                          )}
                          {(item.status.startsWith('error') || item.status === 'failed') && (
                            <button
                              onClick={() => handleRetryVideo(item.id)}
                              disabled={actionLoading !== null}
                              type="button"
                              className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 hover:border-cyan-700/60 text-cyan-400 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                            >
                              {actionLoading === item.id ? '処理中...' : '再試行'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteVideo(item.id)}
                            disabled={actionLoading !== null}
                            type="button"
                            className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/50 border border-red-900/40 hover:border-red-800/60 text-red-400 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
