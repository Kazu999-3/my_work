'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

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
      // タイトルをクリップボードへ入れてから遷移する。
      // 自動検索で当たらなくても、その場で貼り直して探せるようにするため。
      const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        try { await navigator.clipboard.writeText(title); } catch { /* コピー不可でも遷移は続行 */ }
        window.location.href = `/admin/knowledge?q=${encodeURIComponent(title.slice(0, 40))}`;
      };
      return (
        <button
          type="button"
          onClick={handleClick}
          title={`タイトルをコピーしてライブラリを検索します:\n${title}`}
          className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded hover:bg-amber-200 transition-colors"
        >
          🔍 タイトルをコピーして探す
        </button>
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
              ? 'text-gray-500 bg-gray-100 border-gray-200 hover:text-gray-900'
              : 'text-emerald-700 bg-emerald-100 border-emerald-200 hover:bg-emerald-200'
          }`}
        >
          📄 {a.archived ? '統合済: ' : ''}{a.title}
        </a>
      ))}
    </>
  );
}

function parseTitleAndError(fullTitle: string): { title: string; errorMessage: string | null } {
  // 過去の二重処理(クラウド/ローカルの競合)で複数の[エラー: ...]タグが積み重なった
  // タイトルが残っている場合、末尾から1つだけ剥がすと残りが本文に混ざって表示が崩れる。
  // 末尾のタグが無くなるまでループで全て剥がし、最後に見つかったものだけを表示用に使う。
  let title = fullTitle || '';
  let lastError: string | null = null;
  while (true) {
    const match = title.match(/^(.*?)\s*\[エラー:([^\]]*)\]\s*$/);
    if (!match) break;
    title = match[1];
    lastError = match[2].trim();
  }
  return { title, errorMessage: lastError };
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [closingToDiscord, setClosingToDiscord] = useState(false);
  const [closingSelected, setClosingSelected] = useState(false);

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

  // チェックボックスの選択トグル
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const allSelected = filteredQueue.length > 0 && filteredQueue.every((i) => prev.has(i.id));
      if (allSelected) return new Set();
      return new Set(filteredQueue.map((i) => i.id));
    });
  };

  // 選択した動画（主に字幕/Whisper解析不可の手動対応要動画）をまとめてYouTubeプレイリストへ追加しクローズする
  const handleCloseSelectedToPlaylist = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した${selectedIds.size}件の動画をYouTubeプレイリストへ追加し、キューからクローズします。よろしいですか？`)) return;

    setClosingToDiscord(true);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_to_playlist', ids: Array.from(selectedIds) }),
      });
      const result = await res.json();
      if (res.ok) {
        showFeedback(result.message || 'プレイリストへ追加しクローズしました。', 'success');
        setSelectedIds(new Set());
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || 'クローズ処理に失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setClosingToDiscord(false);
    }
  };

  // 4. 動画のクローズ（実削除はせず manually_closed にする）
  const handleCloseVideo = async (id: string) => {
    if (!confirm('この動画をキューからクローズしますか？')) return;

    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (res.ok) {
        showFeedback('動画をキューからクローズしました。', 'success');
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || 'クローズに失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 選択した動画をまとめてクローズする（Discordへは送らない）
  const handleCloseSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した${selectedIds.size}件の動画をキューからクローズします。よろしいですか？`)) return;

    setClosingSelected(true);
    try {
      const res = await fetch('/api/admin/youtube', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await res.json();
      if (res.ok) {
        showFeedback(result.message || '選択した動画をクローズしました。', 'success');
        setSelectedIds(new Set());
        fetchQueue(true, sortBy);
      } else {
        showFeedback(result.error || 'クローズに失敗しました。', 'error');
      }
    } catch (err) {
      showFeedback('リクエストに失敗しました。', 'error');
    } finally {
      setClosingSelected(false);
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
      classes += 'bg-red-100 text-red-700 border-red-200';
      label = '優先度: 高';
    } else if (p === 'low') {
      classes += 'bg-gray-100 text-gray-500 border-gray-200';
      label = '優先度: 低';
    } else {
      classes += 'bg-blue-100 text-blue-700 border-blue-200';
      label = '優先度: 中';
    }
    return <span className={classes}>{label}</span>;
  };

  // ステータスバッジのスタイル＆分かりやすい日本語理由定義
  const getStatusBadge = (status: string) => {
    let classes = 'px-2.5 py-1 text-[11px] font-bold rounded-md border inline-flex items-center gap-1 cursor-help ';
    let label = status;
    let hint = '';

    if (status === 'completed') {
      classes += 'bg-emerald-100 text-emerald-700 border-emerald-200';
      label = '✅ 解析完了';
      hint = '文字起こし・Gemini要約が正常に完了し、ライブラリへ保存されました。';
    } else if (status === 'on_hold') {
      classes += 'bg-yellow-100 text-yellow-700 border-yellow-200';
      label = '⏸️ 保留中';
      hint = '処理が一時停止されています。解除すると次回巡回時に解析されます。';
    } else if (status === 'pending') {
      classes += 'bg-cyan-100 text-cyan-700 border-cyan-200 animate-pulse';
      label = '⏳ 解析待ち';
      hint = 'ローカルPC / SREデーモンが順次巡回して要約・文字起こしを行います。';
    } else if (status === 'error_generation') {
      classes += 'bg-amber-100 text-amber-700 border-amber-200';
      label = '⚠️ AI要約制限 (再試行可)';
      hint = 'Gemini APIのレート制限（無料枠制限等）で一時失敗しました。「再試行」ボタンで復旧可能です。';
    } else if (status === 'error_no_transcript') {
      classes += 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse';
      label = '🎙️ 手動対応要（字幕/音声不可）';
      hint = '公式字幕がなくWhisper文字起こしも失敗しました。自動処理では解析できないため、手動でテキストを入力するか、チェックボックスで選択してDiscordへ送信・クローズしてください。';
    } else if (status === 'failed') {
      classes += 'bg-red-100 text-red-700 border-red-200';
      label = '❌ 解析不可 (削除/非公開)';
      hint = '動画が削除・非公開・地域制限の可能性があります。キューからのクローズを推奨します。';
    } else if (status === 'manually_closed') {
      classes += 'bg-gray-100 text-gray-500 border-gray-200';
      label = '🔒 手動クローズ済み';
      hint = '対応不可と判断してクローズした動画です。チャンネル/プレイリスト監視が再検出しても、この記録が残っているため再度キューには積まれません。';
    } else {
      classes += 'bg-gray-100 text-gray-500 border-gray-200';
    }

    return <span className={classes} title={hint}>{label}</span>;
  };

  // 統計の計算。手動クローズ済みは「もう対応しない」と決めた記録なので、
  // アクティブな作業量を表す総登録本数には含めない（別枠でclosedとして数える）。
  const closedCount = queue.filter((i) => i.status === 'manually_closed').length;
  const stats = {
    total: queue.length - closedCount,
    pending: queue.filter((i) => i.status === 'pending').length,
    completed: queue.filter((i) => i.status === 'completed').length,
    error: queue.filter((i) => i.status.startsWith('error') || i.status === 'failed').length,
    closed: closedCount,
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
    if (filterStatus === 'closed' && item.status !== 'manually_closed') return false;
    // 「すべて」は総登録本数(stats.total)と揃え、手動クローズ済みは専用タブでのみ表示する
    if (filterStatus === 'all' && item.status === 'manually_closed') return false;

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-600 to-cyan-700">
            📺 YouTube Absorber コマンドセンター
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            攻略動画の字幕テキストを自動抽出・AI解析し、戦略バイブルへとライブラリ化します。
          </p>
        </div>

        {/* タブ切り替えボタン */}
        <div className="flex glass-panel p-1 rounded-xl items-center self-start md:self-auto border border-gray-200 bg-gray-100">
          <button 
            type="button"
            onClick={() => setActiveTab('queue')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'queue' ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            動画キュー管理
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('channels'); fetchChannels(); }} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'channels' ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            監視チャンネル設定
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('playlists'); fetchPlaylists(); }} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'playlists' ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            監視プレイリスト設定
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'queue' && selectedIds.size > 0 && (
            <button
              onClick={handleCloseSelectedToPlaylist}
              disabled={closingToDiscord || closingSelected}
              className="px-4 py-2.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 hover:border-indigo-300 text-indigo-700 text-xs font-bold shadow-[0_0_15px_rgba(99,102,241,0.1)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center gap-1.5 shrink-0"
            >
              📺 選択{selectedIds.size}件をプレイリストへ追加してクローズ
            </button>
          )}
          {activeTab === 'queue' && selectedIds.size > 0 && (
            <button
              onClick={handleCloseSelected}
              disabled={closingToDiscord || closingSelected}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-bold shadow-[0_0_15px_rgba(107,114,128,0.1)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center gap-1.5 shrink-0"
            >
              🔒 選択{selectedIds.size}件をクローズ
            </button>
          )}
          {activeTab === 'queue' && stats.error > 0 && (
            <button
              onClick={handleRetryAllErrors}
              disabled={actionLoading !== null}
              className="px-4 py-2.5 rounded-xl bg-cyan-100 hover:bg-cyan-200 border border-cyan-200 hover:border-cyan-300 text-cyan-700 text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center gap-1.5 shrink-0"
            >
              🔄 エラー動画を一括再試行 ({stats.error}件)
            </button>
          )}
          
          <button
            onClick={handleTriggerDictSynthesizer}
            disabled={actionLoading !== null}
            className="px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-200 hover:border-amber-300 text-amber-700 text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center gap-1.5 shrink-0"
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
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
              : 'bg-red-100 text-red-700 border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.08)]'
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
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-center">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">総登録本数</span>
              <span className="text-2xl font-bold mt-1 text-gray-900">{stats.total} 本</span>
            </div>
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(6,182,212,0.02)]">
              <span className="text-xs text-cyan-600 font-semibold uppercase tracking-wider">解析待ち</span>
              <span className="text-2xl font-bold mt-1 text-cyan-700">{stats.pending} 本</span>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(34,197,94,0.02)]">
              <span className="text-xs text-green-600 font-semibold uppercase tracking-wider">完了済み</span>
              <span className="text-2xl font-bold mt-1 text-green-700">{stats.completed} 本</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(239,68,68,0.02)]">
              <span className="text-xs text-red-600 font-semibold uppercase tracking-wider">エラー/リトライ超過</span>
              <span className="text-2xl font-bold mt-1 text-red-700">{stats.error} 本</span>
            </div>
          </div>

          {/* 動画追加フォーム */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-500" />
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>➕ 攻略動画の自動解析指示</span>
            </h2>
            <form onSubmit={handleAddVideo} className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                disabled={actionLoading === 'add'}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-gray-900 placeholder-gray-400 transition-all"
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
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 shadow-md">
            {/* ステータスタブ */}
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 w-full md:w-auto">
              {[
                { id: 'all', label: 'すべて', count: stats.total },
                { id: 'pending', label: '解析待ち', count: stats.pending, color: 'text-cyan-600' },
                { id: 'completed', label: '完了', count: stats.completed, color: 'text-green-600' },
                { id: 'error', label: 'エラー/失敗', count: stats.error, color: 'text-red-600' },
                { id: 'closed', label: '手動クローズ済み', count: stats.closed, color: 'text-gray-400' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterStatus === tab.id
                      ? 'bg-amber-500 text-gray-950 shadow-md'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <span className={filterStatus === tab.id ? 'text-gray-950' : tab.color}>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filterStatus === tab.id ? 'bg-gray-950/20 text-gray-950' : 'bg-gray-200 text-gray-600'
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
                  className="px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-cyan-500 text-xs text-gray-700 w-full sm:w-auto sm:max-w-[220px] appearance-none pr-8 cursor-pointer font-bold"
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
                  className="px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-cyan-500 text-xs text-gray-700 w-full sm:w-auto appearance-none pr-8 cursor-pointer font-bold"
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
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs text-gray-900"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* キュー一覧リスト */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">📋 登録動画キュー一覧</h2>
              <button
                onClick={() => fetchQueue(false)}
                disabled={loading}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-800 transition-all"
                title="リフレッシュ"
              >
                <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <svg className="animate-spin h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
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
                    className="text-xs font-bold text-cyan-600 hover:underline">
                    チャンネル絞り込みを解除する
                  </button>
                )}
              </div>
            ) : (
              <>
                {filterChannel !== 'all' && (
                  <div className="px-4 py-2 bg-cyan-500/5 border-b border-cyan-500/20 flex items-center justify-between gap-3 text-xs">
                    <span className="text-cyan-700 font-bold truncate">
                      「{filterChannel === '__none__' ? 'チャンネル不明' : filterChannel}」で絞り込み中 — {filteredQueue.length}件
                    </span>
                    <button type="button" onClick={() => setFilterChannel('all')}
                      className="text-gray-400 hover:text-gray-900 font-bold shrink-0">
                      解除 ✕
                    </button>
                  </div>
                )}
                <div className="block md:hidden divide-y divide-gray-200">
                  {filteredQueue.map((item) => (
                    <div key={item.id} className="p-4 space-y-3 hover:bg-black/5 transition-all flex flex-col">
                      <div className="flex gap-3 items-start">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-4 h-4 mt-1 accent-amber-500 cursor-pointer shrink-0"
                        />
                        <Image
                          src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`}
                          width={80}
                          height={48}
                          className="w-20 h-12 object-cover rounded border border-gray-200 shrink-0 shadow-sm"
                          alt="thumbnail"
                        />
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const { title, errorMessage } = parseTitleAndError(item.title);
                            return (
                              <>
                                <span className="font-bold text-gray-800 text-sm line-clamp-2 leading-snug" title={title}>
                                  {title}
                                </span>
                                {errorMessage && (
                                  <span className="mt-1 block text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded w-fit animate-pulse">
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
                            <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              {item.channel_name}
                            </span>
                          )}
                          {item.published_at && (
                            <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                              投稿: {item.published_at}
                            </span>
                          )}
                          <ArticleLinks item={item} />
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline flex items-center gap-1">
                            <span>{item.id}</span>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 text-[10px] font-bold">
                        <div className="flex items-center gap-2 flex-wrap">
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

                      {/* 解析失敗時の理由 ＆ 解決アクションヒント */}
                      {item.status === 'error_generation' && (
                        <div className="text-[11px] p-2 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 space-y-1">
                          <p className="font-bold flex items-center gap-1">💡 理由: AI API制限中</p>
                          <p className="text-amber-700 text-[10px]">Geminiの無料枠リクエスト数上限による一時失敗です。時間をおいて下の「再試行」を押してください。</p>
                        </div>
                      )}
                      {item.status === 'error_no_transcript' && (
                        <div className="text-[11px] p-2 rounded-lg bg-rose-100 border border-rose-200 text-rose-800 space-y-1">
                          <p className="font-bold flex items-center gap-1">🎙️ 理由: 字幕・音声未検出（手動対応要）</p>
                          <p className="text-rose-700 text-[10px]">字幕がなくWhisper文字起こしも失敗しました。ナレッジ画面から直接テキストを入力するか、チェックボックスで選択して上部の「プレイリストへ追加してクローズ」からまとめて処理してください。</p>
                        </div>
                      )}
                      {item.status === 'failed' && (
                        <div className="text-[11px] p-2 rounded-lg bg-red-100 border border-red-200 text-red-800 space-y-1">
                          <p className="font-bold flex items-center gap-1">❌ 理由: 動画閲覧不能</p>
                          <p className="text-red-700 text-[10px]">YouTube上で削除・非公開になっている可能性があります。キューからのクローズをおすすめします。</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        {item.status !== 'completed' && (
                          <button
                            onClick={() => handleToggleHold(item.id, item.status)}
                            disabled={actionLoading !== null}
                            type="button"
                            className={`flex-1 py-2 border text-xs font-semibold rounded-lg disabled:opacity-40 transition-all text-center ${
                              item.status === 'on_hold'
                                ? 'bg-yellow-100 hover:bg-yellow-200 border-yellow-200 text-yellow-700'
                                : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-500'
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
                            className="flex-1 py-2 bg-cyan-100 hover:bg-cyan-200 border border-cyan-200 text-cyan-700 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all text-center"
                          >
                            {actionLoading === item.id ? '処理中...' : '再試行'}
                          </button>
                        )}
                        <button
                          onClick={() => handleCloseVideo(item.id)}
                          disabled={actionLoading !== null}
                          type="button"
                          className="flex-1 py-2 bg-red-100 hover:bg-red-200 border border-red-200 text-red-700 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all text-center"
                        >
                          🔒 クローズ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase bg-gray-50">
                        <th className="px-4 py-4 font-semibold w-8">
                          <input
                            type="checkbox"
                            checked={filteredQueue.length > 0 && filteredQueue.every((i) => selectedIds.has(i.id))}
                            onChange={toggleSelectAllVisible}
                            className="w-4 h-4 accent-amber-500 cursor-pointer"
                            title="表示中の全てを選択/解除"
                          />
                        </th>
                        <th className="px-6 py-4 font-semibold">動画情報</th>
                        <th className="px-6 py-4 font-semibold">ステータス / 優先度</th>
                        <th className="px-6 py-4 font-semibold text-right">アクション</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                      {filteredQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-black/8 transition-all duration-150">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="w-4 h-4 accent-amber-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 max-w-lg">
                            <div className="flex gap-3 items-center">
                              <Image
                                src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`}
                                width={64}
                                height={40}
                                className="w-16 h-10 object-cover rounded border border-gray-200 shrink-0 shadow-sm"
                                alt="thumbnail" 
                              />
                              <div className="flex flex-col space-y-1 min-w-0">
                                {(() => {
                                  const { title, errorMessage } = parseTitleAndError(item.title);
                                  return (
                                    <>
                                      <span className="font-bold text-gray-800 truncate block" title={title}>
                                        {title}
                                      </span>
                                      {errorMessage && (
                                        <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded w-fit mt-0.5 animate-pulse">
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
                                      className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 hover:text-gray-900 hover:border-gray-400 transition-colors"
                                    >
                                      {item.channel_name}
                                    </button>
                                  )}
                                  {item.published_at && (
                                    <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                                      投稿: {item.published_at}
                                    </span>
                                  )}
                                  <ArticleLinks item={item} />
                                  <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline flex items-center gap-1 w-fit">
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
                                      ? 'bg-yellow-100 hover:bg-yellow-200 border-yellow-200 text-yellow-700'
                                      : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-500'
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
                                  className="px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 border border-cyan-200 hover:border-cyan-300 text-cyan-700 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                                >
                                  {actionLoading === item.id ? '処理中...' : '再試行'}
                                </button>
                              )}
                              <button
                                onClick={() => handleCloseVideo(item.id)}
                                disabled={actionLoading !== null}
                                type="button"
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-200 hover:border-red-300 text-red-700 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                              >
                                🔒 クローズ
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-500" />
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-gray-900 placeholder-gray-400 transition-all"
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
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">📋 登録済み監視チャンネルリスト</h2>
              <button
                onClick={() => fetchChannels(false)}
                disabled={channelsLoading}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-800 transition-all"
                title="リフレッシュ"
              >
                <svg className={`h-5 w-5 ${channelsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3" />
                </svg>
              </button>
            </div>

            {channelsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <svg className="animate-spin h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
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
                    <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase bg-gray-50">
                      <th className="px-6 py-4 font-semibold">チャンネル</th>
                      <th className="px-6 py-4 font-semibold">最終巡回日時</th>
                      <th className="px-6 py-4 font-semibold">自動監視状況</th>
                      <th className="px-6 py-4 font-semibold text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                    {channels.map((ch) => (
                      <tr key={ch.id} className="hover:bg-black/8 transition-all duration-150">
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-bold text-gray-800">{ch.name}</span>
                            <div className="flex items-center gap-2 text-xs">
                              {ch.handle && <span className="text-gray-500 font-medium">{ch.handle}</span>}
                              <a 
                                href={`https://www.youtube.com/channel/${ch.id}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-cyan-600 hover:underline flex items-center gap-1"
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
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : 'bg-gray-100 text-gray-500 border-gray-200'
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
                                  ? 'bg-yellow-100 hover:bg-yellow-200 border-yellow-200 text-yellow-700'
                                  : 'bg-green-100 hover:bg-green-200 border-green-200 text-green-700'
                              }`}
                            >
                              {ch.active ? '監視を停止' : '監視を再開'}
                            </button>
                            <button
                              onClick={() => handleDeleteChannel(ch.id, ch.name)}
                              disabled={actionLoading !== null}
                              type="button"
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-200 hover:border-red-300 text-red-700 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-500" />
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-gray-900 placeholder-gray-400 transition-all"
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
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">📋 登録済み監視プレイリストリスト</h2>
              <button
                onClick={() => fetchPlaylists(false)}
                disabled={playlistsLoading}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-800 transition-all"
                title="リフレッシュ"
              >
                <svg className={`h-5 w-5 ${playlistsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3" />
                </svg>
              </button>
            </div>

            {playlistsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <svg className="animate-spin h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
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
                    <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase bg-gray-50">
                      <th className="px-6 py-4 font-semibold">プレイリスト</th>
                      <th className="px-6 py-4 font-semibold">最終巡回日時</th>
                      <th className="px-6 py-4 font-semibold">自動監視状況</th>
                      <th className="px-6 py-4 font-semibold text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                    {playlists.map((pl) => (
                      <tr key={pl.id} className="hover:bg-black/8 transition-all duration-150">
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-bold text-gray-800">{pl.name}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <a 
                                href={pl.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-cyan-600 hover:underline flex items-center gap-1"
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
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : 'bg-gray-100 text-gray-500 border-gray-200'
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
                                  ? 'bg-yellow-100 hover:bg-yellow-200 border-yellow-200 text-yellow-700'
                                  : 'bg-green-100 hover:bg-green-200 border-green-200 text-green-700'
                              }`}
                            >
                              {pl.active ? '監視を停止' : '監視を再開'}
                            </button>
                            <button
                              onClick={() => handleDeletePlaylist(pl.id, pl.name)}
                              disabled={actionLoading !== null}
                              type="button"
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-200 hover:border-red-300 text-red-700 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
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
