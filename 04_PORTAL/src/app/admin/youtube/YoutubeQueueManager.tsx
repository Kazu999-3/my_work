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
  /** 解析完了時に生成されたナレッジ記事（source_url の動画IDで突き合わせ） */
  articles?: { id: number | string; title: string; archived: boolean }[];
}

/**
 * 解析完了時に生成されたナレッジ記事へのリンク。
 * 「この動画はどの記事になったのか」を一覧から辿れるようにする。
 */
function ArticleLinks({ item }: { item: QueueItem }) {
  const articles = item.articles || [];

  if (articles.length === 0) {
    // 完了しているのに紐づく記事が見つからない場合は、タイトル検索へ逃がす。
    // （記事側が動画IDを持っていない生成経路もあるため、断定はしない）
    if (item.status === 'completed') {
      const { title } = parseTitleAndError(item.title);
      return (
        <a
          href={`/admin/knowledge?q=${encodeURIComponent(title.slice(0, 40))}`}
          title="動画IDでの自動紐づけができませんでした。タイトルでライブラリを検索します。"
          className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded hover:bg-amber-500/20 transition-colors"
        >
          🔍 記事をタイトルで探す
        </a>
      );
    }
    return null;
  }

  return (
    <>
      {articles.map((a) => (
        <a
          key={a.id}
          href={`/admin/knowledge?article=${a.id}`}
          title={a.archived ? `${a.title}（辞典/ガイドへ統合済み）` : a.title}
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border max-w-[220px] truncate inline-block align-middle transition-colors ${
            a.archived
              ? 'text-gray-400 bg-gray-800/60 border-gray-700 hover:text-white'
              : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
          }`}
        >
          📄 {a.archived ? '統合済: ' : ''}{a.title}
        </a>
      ))}
    </>
  );
}

function parseTitleAndError(fullTitle: string): { title: string; errorMessage: string | null } {
  const match = fullTitle.match(/(.*)\s*\[エラー:\s*(.*?)\]\s*$/);
  if (match) {
    return {
      title: match[1].trim(),
      errorMessage: match[2].trim()
    };
  }
  return {
    title: fullTitle,
    errorMessage: null
  };
}

export default function YoutubeQueueManager() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 特定のIDの処理中フラグ
  const [newUrl, setNewUrl] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all'); // 'all' | チャンネル名 | '__none__'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_added' | 'published_at'>('date_added');

  // チャンネル監視用の状態
  const [activeTab, setActiveTab] = useState<'queue' | 'channels' | 'playlists'>('queue');
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [newChannelUrl, setNewChannelUrl] = useState('');

  // 1. キューデータの取得
  const fetchQueue = async (silent = false, currentSort = sortBy) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/admin/youtube?sort=${currentSort}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(Array.isArray(data) ? data : []);
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
        method: 'POST', credentials: 'include',
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
        method: 'PUT', credentials: 'include',
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

  // エラー動画を一括再試行
  const handleRetryAllErrors = async () => {
    if (!confirm(`全てのエラー動画（${stats.error}件）を再試行キュー（pending）に戻しますか？`)) return;

    setActionLoading('retry_all');
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_all_errors' }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(result.message || 'エラー動画を一括リセットしました。', 'success');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || '一括再試行に失敗しました。', 'error');
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
        method: 'DELETE', credentials: 'include',
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
        method: 'PUT', credentials: 'include',
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
        method: 'PUT', credentials: 'include',
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

  // プレイリスト監視用の状態
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');

  // プレイリスト整理タスクのキックハンドラー
  const handleTriggerDictSynthesizer = async () => {
    setActionLoading('trigger_dict');
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_task: 'dict_synthesizer' })
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('辞典の自動整理・要約タスクを起票しました。エッジワーカーが順次処理します。', 'success');
      } else {
        showFeedback(result.error || 'タスクの起票に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // プレイリスト一覧の取得
  const fetchPlaylists = async (silent = false) => {
    try {
      if (!silent) setPlaylistsLoading(true);
      const res = await fetch('/api/admin/youtube/playlists');
      if (res.ok) {
        const data = await res.json();
        setPlaylists(Array.isArray(data) ? data : []);
      } else {
        showFeedback('プレイリストの取得に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('プレイリスト取得エラーが発生しました。', 'error');
    } finally {
      if (!silent) setPlaylistsLoading(false);
    }
  };

  // プレイリストの登録要求
  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistUrl.trim()) return;

    setActionLoading('add_playlist');
    try {
      const res = await fetch('/api/admin/youtube/playlists', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newPlaylistUrl }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(result.message || 'プレイリスト登録解決要求を送信しました。', 'success');
        setNewPlaylistUrl('');
        // エッジワーカーで非同期登録されるため、数秒後に自動更新
        setTimeout(() => fetchPlaylists(true), 4000);
      } else {
        showFeedback(result.error || 'プレイリスト登録に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // プレイリスト自動監視の有効/無効トグル
  const handleTogglePlaylistActive = async (id: string, currentActive: boolean) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube/playlists', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !currentActive }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(`プレイリスト監視を${!currentActive ? '再開' : '一時停止'}しました。`, 'success');
        fetchPlaylists(true);
      } else {
        showFeedback(result.error || '設定の更新に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // プレイリストの削除
  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!confirm(`プレイリスト「${name}」の監視を解除しますか？`)) return;

    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube/playlists', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('プレイリストの監視を解除しました。', 'success');
        fetchPlaylists(true);
      } else {
        showFeedback(result.error || '削除に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 7. 監視チャンネル一覧の取得
  const fetchChannels = async (silent = false) => {
    try {
      if (!silent) setChannelsLoading(true);
      const res = await fetch('/api/admin/youtube/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(Array.isArray(data) ? data : []);
      } else {
        showFeedback('チャンネルリストの取得に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('チャンネル取得エラーが発生しました。', 'error');
    } finally {
      if (!silent) setChannelsLoading(false);
    }
  };

  // 8. 監視チャンネルの登録要求
  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelUrl.trim()) return;

    setActionLoading('add_channel');
    try {
      const res = await fetch('/api/admin/youtube/channels', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newChannelUrl }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(result.message || 'チャンネル登録解決要求を送信しました。', 'success');
        setNewChannelUrl('');
        // エッジワーカーで非同期登録されるため、数秒後に自動更新
        setTimeout(() => fetchChannels(true), 4000);
      } else {
        showFeedback(result.error || 'チャンネル登録に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 9. 自動監視の有効/無効トグル
  const handleToggleChannelActive = async (id: string, currentActive: boolean) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube/channels', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !currentActive }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback(`監視を${!currentActive ? '再開' : '一時停止'}しました。`, 'success');
        fetchChannels(true);
      } else {
        showFeedback(result.error || '監視のトグル変更に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 10. 監視チャンネルの削除
  const handleDeleteChannel = async (id: string, name: string) => {
    if (!confirm(`チャンネル「${name}」の自動監視を解除しますか？`)) return;

    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube/channels', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('チャンネルの監視を解除しました。', 'success');
        fetchChannels(true);
      } else {
        showFeedback(result.error || 'チャンネルの解除に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('通信エラーが発生しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 初期ロードでチャンネル一覧とプレイリスト一覧もフェッチしておく
  useEffect(() => {
    fetchChannels(true);
    fetchPlaylists(true);
  }, []);

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

  // チャンネル絞り込み用の選択肢（登録件数の多い順）
  const channelOptions = (() => {
    const counts = new Map<string, number>();
    for (const item of queue) {
      const name = (item.channel_name || '').trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  })();
  const unknownChannelCount = queue.filter((i) => !(i.channel_name || '').trim()).length;

  const filteredQueue = queue.filter((item) => {
    // 1. ステータスでの絞り込み
    if (filterStatus === 'pending' && item.status !== 'pending') return false;
    if (filterStatus === 'completed' && item.status !== 'completed') return false;
    if (filterStatus === 'error' && !(item.status.startsWith('error') || item.status === 'failed')) return false;

    // 2. チャンネルでの絞り込み
    if (filterChannel !== 'all') {
      const name = (item.channel_name || '').trim();
      if (filterChannel === '__none__') { if (name) return false; }
      else if (name !== filterChannel) return false;
    }

    // 3. 検索キーワードでの絞り込み (タイトル or チャンネル名 or ID)
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
        
        {/* タブ切り替えボタン */}
        <div className="flex glass-panel p-1 rounded-xl items-center self-start md:self-auto border border-gray-800/60 bg-[#07080e]">
          <button 
            type="button"
            onClick={() => setActiveTab('queue')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'queue' ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold' : 'text-gray-400 hover:text-white'
            }`}
          >
            動画キュー管理
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('channels'); fetchChannels(); }} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'channels' ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold' : 'text-gray-400 hover:text-white'
            }`}
          >
            監視チャンネル設定
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('playlists'); fetchPlaylists(); }} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'playlists' ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold' : 'text-gray-400 hover:text-white'
            }`}
          >
            監視プレイリスト設定
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'queue' && stats.error > 0 && (
            <button
              onClick={handleRetryAllErrors}
              disabled={actionLoading !== null}
              className="px-4 py-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 hover:border-cyan-700/60 text-cyan-400 text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center gap-1.5 shrink-0"
            >
              🔄 エラー動画を一括再試行 ({stats.error}件)
            </button>
          )}
          
          <button
            onClick={handleTriggerDictSynthesizer}
            disabled={actionLoading !== null}
            className="px-4 py-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 hover:border-amber-700/60 text-amber-400 text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center gap-1.5 shrink-0"
          >
            📚 辞典整理を手動実行
          </button>
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

      {/* === タブ 1: 動画キュー管理 === */}
      {activeTab === 'queue' && (
        <>
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
              {/* チャンネル絞り込み */}
              <div className="relative">
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  title="チャンネルで絞り込む"
                  className="px-3 py-2 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 text-xs text-gray-300 w-full sm:w-auto sm:max-w-[220px] appearance-none pr-8 cursor-pointer font-bold"
                >
                  <option value="all">すべてのチャンネル ({queue.length})</option>
                  {channelOptions.map(([name, count]) => (
                    <option key={name} value={name}>{name} ({count})</option>
                  ))}
                  {unknownChannelCount > 0 && (
                    <option value="__none__">チャンネル不明 ({unknownChannelCount})</option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </div>
              </div>
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
              <div className="py-20 text-center text-gray-500 text-sm space-y-3">
                <p>該当する動画がありません。</p>
                {filterChannel !== 'all' && (
                  <button type="button" onClick={() => setFilterChannel('all')}
                    className="text-xs font-bold text-cyan-400 hover:underline">
                    チャンネル絞り込みを解除する
                  </button>
                )}
              </div>
            ) : (
              <>
                {filterChannel !== 'all' && (
                  <div className="px-4 py-2 bg-cyan-500/5 border-b border-cyan-500/20 flex items-center justify-between gap-3 text-xs">
                    <span className="text-cyan-300 font-bold truncate">
                      「{filterChannel === '__none__' ? 'チャンネル不明' : filterChannel}」で絞り込み中 — {filteredQueue.length}件
                    </span>
                    <button type="button" onClick={() => setFilterChannel('all')}
                      className="text-gray-400 hover:text-white font-bold shrink-0">
                      解除 ✕
                    </button>
                  </div>
                )}
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
                          {(() => {
                            const { title, errorMessage } = parseTitleAndError(item.title);
                            return (
                              <>
                                <span className="font-bold text-gray-200 text-sm line-clamp-2 leading-snug" title={title}>
                                  {title}
                                </span>
                                {errorMessage && (
                                  <span className="mt-1 block text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded w-fit animate-pulse">
                                    ⚠️ {errorMessage}
                                  </span>
                                )}
                              </>
                            );
                          })()}
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
                          <ArticleLinks item={item} />
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
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
                                {(() => {
                                  const { title, errorMessage } = parseTitleAndError(item.title);
                                  return (
                                    <>
                                      <span className="font-bold text-gray-200 truncate block" title={title}>
                                        {title}
                                      </span>
                                      {errorMessage && (
                                        <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded w-fit mt-0.5 animate-pulse">
                                          ⚠️ {errorMessage}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                                <div className="flex items-center gap-2 text-xs flex-wrap">
                                  {item.channel_name && (
                                    <button
                                      type="button"
                                      onClick={() => setFilterChannel(item.channel_name || 'all')}
                                      title="このチャンネルで絞り込む"
                                      className="text-gray-400 bg-gray-900/60 px-1.5 py-0.5 rounded border border-gray-800/80 hover:text-white hover:border-gray-600 transition-colors"
                                    >
                                      {item.channel_name}
                                    </button>
                                  )}
                                  {item.published_at && (
                                    <span className="text-gray-500 bg-gray-900/40 px-1.5 py-0.5 rounded border border-gray-800/40 font-medium">
                                      投稿: {item.published_at}
                                    </span>
                                  )}
                                  <ArticleLinks item={item} />
                                  <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1 w-fit">
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
        </>
      )}

      {/* === タブ 2: 監視チャンネル設定 === */}
      {activeTab === 'channels' && (
        <>
          {/* チャンネル登録フォーム */}
          <div className="bg-[#0f111a] border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-500" />
            <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <span>➕ 自動巡回監視チャンネルの追加</span>
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              YouTubeチャンネルのURL（例: https://www.youtube.com/@KireiLoL ）を入力してください。ローカルPCのエッジワーカーがチャンネル名とチャンネルIDを自動解析して登録します。
            </p>
            <form onSubmit={handleAddChannel} className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="https://www.youtube.com/@ChannelName"
                value={newChannelUrl}
                onChange={(e) => setNewChannelUrl(e.target.value)}
                disabled={actionLoading === 'add_channel'}
                className="flex-1 px-4 py-3 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-gray-200 placeholder-gray-600 transition-all"
              />
              <button
                type="submit"
                disabled={actionLoading === 'add_channel' || !newChannelUrl.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center min-w-[140px]"
              >
                {actionLoading === 'add_channel' ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-gray-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    登録解決中...
                  </span>
                ) : (
                  '監視対象に追加'
                )}
              </button>
            </form>
          </div>

          {/* 監視チャンネル一覧リスト */}
          <div className="bg-[#0f111a] border border-gray-800/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/80 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-200">📋 登録済み監視チャンネルリスト</h2>
              <button
                onClick={() => fetchChannels(false)}
                disabled={channelsLoading}
                className="p-2 hover:bg-gray-800/60 rounded-lg text-gray-400 hover:text-gray-200 transition-all"
                title="リフレッシュ"
              >
                <svg className={`h-5 w-5 ${channelsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3" />
                </svg>
              </button>
            </div>

            {channelsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <svg className="animate-spin h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-gray-400">チャンネル情報を読み込み中...</span>
              </div>
            ) : channels.length === 0 ? (
              <div className="py-20 text-center text-gray-500 text-sm">
                登録されている監視チャンネルはありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800/60 text-xs text-gray-400 uppercase bg-[#08090f]">
                      <th className="px-6 py-4 font-semibold">チャンネル</th>
                      <th className="px-6 py-4 font-semibold">最終巡回日時</th>
                      <th className="px-6 py-4 font-semibold">自動監視状況</th>
                      <th className="px-6 py-4 font-semibold text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-sm text-gray-300">
                    {channels.map((ch) => (
                      <tr key={ch.id} className="hover:bg-[#0c0d15]/60 transition-all duration-150">
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-bold text-gray-200">{ch.name}</span>
                            <div className="flex items-center gap-2 text-xs">
                              {ch.handle && <span className="text-gray-500 font-medium">{ch.handle}</span>}
                              <a 
                                href={`https://www.youtube.com/channel/${ch.id}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-cyan-400 hover:underline flex items-center gap-1"
                              >
                                <span>{ch.id}</span>
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">
                          {ch.last_fetched_at ? new Date(ch.last_fetched_at).toLocaleString('ja-JP') : '未巡回'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded border ${
                              ch.active 
                                ? 'bg-green-950/40 text-green-400 border-green-800/60' 
                                : 'bg-gray-950/40 text-gray-500 border-gray-800/60'
                            }`}>
                              {ch.active ? '監視ON' : '監視OFF'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleToggleChannelActive(ch.id, ch.active)}
                              disabled={actionLoading !== null}
                              type="button"
                              className={`px-3 py-1.5 border text-xs font-semibold rounded-lg disabled:opacity-40 transition-all ${
                                ch.active
                                  ? 'bg-yellow-950/20 hover:bg-yellow-950/50 border-yellow-900/40 text-yellow-400'
                                  : 'bg-green-950/20 hover:bg-green-950/50 border-green-900/40 text-green-400'
                              }`}
                            >
                              {ch.active ? '監視を停止' : '監視を再開'}
                            </button>
                            <button
                              onClick={() => handleDeleteChannel(ch.id, ch.name)}
                              disabled={actionLoading !== null}
                              type="button"
                              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/50 border border-red-900/40 hover:border-red-800/60 text-red-400 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                            >
                              監視解除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </>
      )}

      {/* === タブ 3: 監視プレイリスト設定 === */}
      {activeTab === 'playlists' && (
        <>
          {/* プレイリスト登録フォーム */}
          <div className="bg-[#0f111a] border border-gray-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-500" />
            <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <span>➕ 自動巡回監視プレイリストの追加</span>
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              YouTubeプレイリストのURL（例: https://youtube.com/playlist?list=PL7aNfKUA-1lvPVfUoYHpD6jaK0p44HQGM ）を入力してください。ローカルPCのエッジワーカーがプレイリスト名を自動解析して登録します。
            </p>
            <form onSubmit={handleAddPlaylist} className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="https://youtube.com/playlist?list=PL..."
                value={newPlaylistUrl}
                onChange={(e) => setNewPlaylistUrl(e.target.value)}
                disabled={actionLoading === 'add_playlist'}
                className="flex-1 px-4 py-3 bg-[#07080e] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-gray-200 placeholder-gray-600 transition-all"
              />
              <button
                type="submit"
                disabled={actionLoading === 'add_playlist' || !newPlaylistUrl.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center min-w-[140px]"
              >
                {actionLoading === 'add_playlist' ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-gray-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    登録解決中...
                  </span>
                ) : (
                  '監視対象に追加'
                )}
              </button>
            </form>
          </div>

          {/* 監視プレイリスト一覧リスト */}
          <div className="bg-[#0f111a] border border-gray-800/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/80 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-200">📋 登録済み監視プレイリストリスト</h2>
              <button
                onClick={() => fetchPlaylists(false)}
                disabled={playlistsLoading}
                className="p-2 hover:bg-gray-800/60 rounded-lg text-gray-400 hover:text-gray-200 transition-all"
                title="リフレッシュ"
              >
                <svg className={`h-5 w-5 ${playlistsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3" />
                </svg>
              </button>
            </div>

            {playlistsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <svg className="animate-spin h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-gray-400">プレイリスト情報を読み込み中...</span>
              </div>
            ) : playlists.length === 0 ? (
              <div className="py-20 text-center text-gray-500 text-sm">
                登録されている監視プレイリストはありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800/60 text-xs text-gray-400 uppercase bg-[#08090f]">
                      <th className="px-6 py-4 font-semibold">プレイリスト</th>
                      <th className="px-6 py-4 font-semibold">最終巡回日時</th>
                      <th className="px-6 py-4 font-semibold">自動監視状況</th>
                      <th className="px-6 py-4 font-semibold text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-sm text-gray-300">
                    {playlists.map((pl) => (
                      <tr key={pl.id} className="hover:bg-[#0c0d15]/60 transition-all duration-150">
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-bold text-gray-200">{pl.name}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <a 
                                href={pl.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-cyan-400 hover:underline flex items-center gap-1"
                              >
                                <span>{pl.id}</span>
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">
                          {pl.last_fetched_at ? new Date(pl.last_fetched_at).toLocaleString('ja-JP') : '未巡回'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded border ${
                              pl.active 
                                ? 'bg-green-950/40 text-green-400 border-green-800/60' 
                                : 'bg-gray-950/40 text-gray-500 border-gray-800/60'
                            }`}>
                              {pl.active ? '監視ON' : '監視OFF'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleTogglePlaylistActive(pl.id, pl.active)}
                              disabled={actionLoading !== null}
                              type="button"
                              className={`px-3 py-1.5 border text-xs font-semibold rounded-lg disabled:opacity-40 transition-all ${
                                pl.active
                                  ? 'bg-yellow-950/20 hover:bg-yellow-950/50 border-yellow-900/40 text-yellow-400'
                                  : 'bg-green-950/20 hover:bg-green-950/50 border-green-900/40 text-green-400'
                              }`}
                            >
                              {pl.active ? '監視を停止' : '監視を再開'}
                            </button>
                            <button
                              onClick={() => handleDeletePlaylist(pl.id, pl.name)}
                              disabled={actionLoading !== null}
                              type="button"
                              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/50 border border-red-900/40 hover:border-red-800/60 text-red-400 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                            >
                              監視解除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ⚡ ローカルタスク実行キュー状況パネル */}
      </div>
  );
}
