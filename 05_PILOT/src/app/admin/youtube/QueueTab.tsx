'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Plus, RefreshCw, RotateCcw, ExternalLink, CheckCircle2, AlertTriangle,
  Play, Sparkles, Pause, XCircle, ListVideo,
} from 'lucide-react';

interface QueueItem {
  id: string;
  title: string;
  channel_name?: string;
  url: string;
  status: string;
  priority?: 'high' | 'medium' | 'low';
  retry_count: number;
  /** UNIX秒（DBはbigint） */
  date_added: number | null;
  published_at?: string | null;
}

const PAGE_SIZE = 50;

// ワーカーの失敗理由はタイトル末尾に「[エラー: ...]」として追記されている。
// 過去の二重処理で複数積み重なっている行があるため、全部剥がして最後のものを理由として使う。
function parseTitleAndError(fullTitle: string): { title: string; errorMessage: string | null } {
  let title = fullTitle || '';
  let lastError: string | null = null;
  while (true) {
    const m = title.match(/^(.*?)\s*\[エラー:([^\]]*)\]\s*$/);
    if (!m) break;
    title = m[1];
    lastError = m[2].trim();
  }
  return { title, errorMessage: lastError };
}

const STATUS_META: Record<string, { label: string; cls: string; hint?: string }> = {
  pending: { label: '⏳ 解析待ち', cls: 'bg-amber-950/40 text-amber-300 border-amber-800/60', hint: 'PCのエッジワーカーが順番に解析します（PCが起動していないと進みません）。' },
  processing: { label: '⚡ 解析中', cls: 'bg-teal-950/40 text-teal-300 border-teal-800/60' },
  completed: { label: '✅ 解析完了', cls: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' },
  on_hold: { label: '⏸️ 保留中', cls: 'bg-slate-800 text-slate-300 border-slate-600', hint: '自動解析の対象外です。解除すると次回巡回で解析されます。' },
  error_generation: { label: '⚠️ AI要約の制限', cls: 'bg-amber-950/40 text-amber-300 border-amber-800/60', hint: 'Gemini APIの利用上限による一時的な失敗です。時間をおいて再試行してください。' },
  error_no_transcript: { label: '🎙️ 字幕・音声なし', cls: 'bg-rose-950/30 text-rose-400 border-rose-800/60', hint: '字幕が無く、Whisperによる文字起こしも失敗しました。自動では解析できないためクローズを検討してください。' },
  failed: { label: '❌ 解析不可', cls: 'bg-rose-950/30 text-rose-400 border-rose-800/60', hint: '動画の削除・非公開・地域制限の可能性があります。クローズを推奨します。' },
  manually_closed: { label: '🔒 クローズ済み', cls: 'bg-slate-900 text-slate-500 border-slate-700', hint: '対応不可と判断した記録です。監視で再検出されてもキューに戻りません。' },
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '全件' },
  { key: 'pending', label: '解析待ち' },
  { key: 'errors', label: 'エラー' },
  { key: 'on_hold', label: '保留' },
  { key: 'completed', label: '完了' },
  { key: 'manually_closed', label: 'クローズ済み' },
];

const PRIORITY_NEXT: Record<string, 'high' | 'medium' | 'low'> = { high: 'medium', medium: 'low', low: 'high' };
const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  high: { label: '優先: 高', cls: 'text-amber-300 border-amber-700/60 bg-amber-950/40' },
  medium: { label: '優先: 中', cls: 'text-slate-300 border-slate-700 bg-slate-900' },
  low: { label: '優先: 低', cls: 'text-slate-500 border-slate-800 bg-slate-950' },
};

const isErrorStatus = (s: string) => s === 'error_generation' || s === 'error_no_transcript' || s === 'failed';

export default function QueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filter, setFilter] = useState('pending');
  const [channel, setChannel] = useState('');
  const [sort, setSort] = useState<'date_added' | 'published_at'>('date_added');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [newUrl, setNewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error'; link?: { url: string; label: string } } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error', link?: { url: string; label: string }) => {
    setMessage({ text, type, link });
    setTimeout(() => setMessage(null), 8000);
  };

  const buildQuery = useCallback((offset: number, meta: boolean) => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), status: filter, sort });
    if (channel) qs.set('channel', channel);
    if (search) qs.set('q', search);
    if (meta) qs.set('meta', '1');
    return `/api/youtube/queue?${qs.toString()}`;
  }, [filter, channel, sort, search]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(buildQuery(0, true));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'キューの取得に失敗しました');
      setItems(json.items || []);
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts);
      if (json.channels) setChannels(json.channels);
      setSelected(new Set());
    } catch (e: any) {
      showMessage(e.message || '通信エラーが発生しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(buildQuery(items.length, false));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setItems((prev) => [...prev, ...(json.items || [])]);
    } catch (e: any) {
      showMessage(e.message, 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const callApi = async (key: string, init: RequestInit & { body?: string }, url = '/api/youtube/queue') => {
    setBusy(key);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '処理に失敗しました');
      return json;
    } catch (e: any) {
      showMessage(e.message || '通信エラーが発生しました', 'error');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setSubmitting(true);
    const json = await callApi('add', { method: 'POST', body: JSON.stringify({ url: newUrl.trim() }) });
    setSubmitting(false);
    if (json) {
      showMessage(json.message || '動画をキューに登録しました', 'success');
      setNewUrl('');
      load(true);
    }
  };

  const setStatus = async (id: string, status: string, okText: string) => {
    const json = await callApi(`st_${id}`, { method: 'PATCH', body: JSON.stringify({ id, status, resetRetries: status === 'pending' }) });
    if (json) { showMessage(okText, 'success'); load(true); }
  };

  const cyclePriority = async (item: QueueItem) => {
    const next = PRIORITY_NEXT[item.priority || 'medium'];
    const json = await callApi(`pr_${item.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'set_priority', id: item.id, priority: next }) });
    if (json) setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, priority: next } : x)));
  };

  const retryAllErrors = async () => {
    const n = (counts.error_generation || 0) + (counts.error_no_transcript || 0) + (counts.failed || 0);
    if (!confirm(`エラー状態の動画（最大${n}件）を解析待ちに戻しますか？\n字幕も音声も取得できず諦めた動画は対象外です（個別の再試行ボタンで戻せます）。`)) return;
    const json = await callApi('retry_all', { method: 'PATCH', body: JSON.stringify({ action: 'retry_all_errors' }) });
    if (json) { showMessage(json.message, 'success'); load(true); }
  };

  const closeSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`選択した${selected.size}件をクローズしますか？（記録は残り、監視で再登録されなくなります）`)) return;
    const json = await callApi('close', { method: 'PATCH', body: JSON.stringify({ action: 'close', ids: Array.from(selected) }) });
    if (json) { showMessage(json.message, 'success'); load(true); }
  };

  const closeToPlaylist = async (ids: string[]) => {
    if (ids.length === 0) return;
    const isMultiple = ids.length > 1;
    const confirmMsg = isMultiple
      ? `選択した${ids.length}件の動画をYouTubeプレイリストへ追加し、キューからクローズしますか？`
      : 'この動画をYouTubeプレイリストへ追加し、キューからクローズしますか？';
    if (!confirm(confirmMsg)) return;

    const json = await callApi('close_to_playlist', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'close_to_playlist', ids }),
    });

    if (json) {
      if (json.urls && Array.isArray(json.urls) && json.urls.length > 0) {
        try {
          await navigator.clipboard.writeText(json.urls.join('\n'));
        } catch (_) {}
      }
      const playlistLink = json.playlistId
        ? { url: `https://www.youtube.com/playlist?list=${json.playlistId}`, label: 'YouTubeプレイリストを開く ↗' }
        : undefined;
      showMessage(json.message, 'success', playlistLink);
      if (isMultiple) setSelected(new Set());
      load(true);
    }
  };

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const errorCount = (counts.error_generation || 0) + (counts.error_no_transcript || 0) + (counts.failed || 0);
  const countFor = (key: string) =>
    key === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : key === 'errors' ? errorCount : counts[key] || 0;

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
          message.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-rose-950/30 border-rose-800/60 text-rose-400'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="break-words">{message.text}</span>
          </div>
          {message.link && (
            <a
              href={message.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1 transition"
            >
              {message.link.label}
            </a>
          )}
        </div>
      )}

      {/* 追加フォーム */}
      <form onSubmit={handleAdd} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="YouTube URL（通常・Shorts・ライブ・youtu.be に対応）"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={submitting || !newUrl.trim()}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          キューに追加
        </button>
      </form>

      {/* ステータス絞り込み */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              filter === f.key ? 'bg-amber-500/10 border-amber-500/60 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f.label} <span className="font-mono text-slate-400">{countFor(f.key)}</span>
          </button>
        ))}
      </div>

      {/* 検索・絞り込み・一括操作 */}
      <div className="flex flex-col lg:flex-row gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="タイトル・チャンネル・動画IDで検索（Enter）"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="px-2 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200 max-w-[12rem]"
          >
            <option value="">全チャンネル</option>
            {channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-2 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200"
          >
            <option value="date_added">追加が新しい順</option>
            <option value="published_at">投稿が新しい順</option>
          </select>
          <button
            onClick={() => load()}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 更新
          </button>
          {errorCount > 0 && (
            <button
              onClick={retryAllErrors}
              disabled={busy !== null}
              className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs font-bold text-amber-300 hover:bg-amber-950/70 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> エラー{errorCount}件を一括再試行
            </button>
          )}
          {selected.size > 0 && (
            <>
              <button
                onClick={() => closeToPlaylist(Array.from(selected))}
                disabled={busy !== null}
                className="px-3 py-2 rounded-lg bg-indigo-950/60 border border-indigo-700/60 text-xs font-bold text-indigo-300 hover:bg-indigo-900/60 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="選択した動画をYouTube手動確認用プレイリストへ追加してクローズします"
              >
                <ListVideo className="w-3.5 h-3.5" /> 選択した{selected.size}件をプレイリストへ送る
              </button>
              <button
                onClick={closeSelected}
                disabled={busy !== null}
                className="px-3 py-2 rounded-lg bg-rose-950/30 border border-rose-800/60 text-xs font-bold text-rose-400 hover:bg-rose-950/60 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> 選択した{selected.size}件をクローズ
              </button>
            </>
          )}
        </div>
      </div>

      {/* 一覧 */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs">キューを取得中...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-xl">対象の動画はありません</div>
        ) : (
          items.map((item) => {
            const { title, errorMessage } = parseTitleAndError(item.title);
            const meta = STATUS_META[item.status] || { label: item.status, cls: 'bg-slate-900 text-slate-400 border-slate-700' };
            const pr = PRIORITY_LABEL[item.priority || 'medium'];
            const retryLimit = item.status === 'error_no_transcript' ? 3 : 5;
            const closable = item.status !== 'manually_closed' && item.status !== 'completed';
            return (
              <div key={item.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-start gap-3">
                  {closable ? (
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 accent-amber-500 shrink-0"
                      aria-label="選択"
                    />
                  ) : <span className="w-[13px] shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-1">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold text-xs text-slate-200 hover:text-amber-400 flex items-start gap-1.5">
                      <span className="break-words">{title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-60" />
                    </a>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
                      <span className={`px-2 py-0.5 rounded-md border font-bold ${meta.cls}`} title={meta.hint}>{meta.label}</span>
                      <button onClick={() => cyclePriority(item)} disabled={busy !== null} className={`px-2 py-0.5 rounded-md border font-bold cursor-pointer ${pr.cls}`} title="クリックで優先度を変更">
                        {pr.label}
                      </button>
                      {item.channel_name && <span className="text-slate-400">{item.channel_name}</span>}
                      {item.retry_count > 0 && item.status !== 'completed' && (
                        <span className="text-amber-400">再試行 {item.retry_count}/{retryLimit}</span>
                      )}
                      <span>追加 {item.date_added ? new Date(Number(item.date_added) * 1000).toLocaleDateString('ja-JP') : '-'}</span>
                      {item.published_at && <span>投稿 {item.published_at}</span>}
                    </div>
                  </div>
                </div>

                {(isErrorStatus(item.status) || errorMessage) && item.status !== 'completed' && (
                  <div className="ml-6 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-0.5">
                    {meta.hint && <p className="text-slate-300">💡 {meta.hint}</p>}
                    {errorMessage && <p className="text-slate-500 break-all">最後のエラー: {errorMessage}</p>}
                  </div>
                )}

                <div className="ml-6 flex flex-wrap gap-1.5">
                  {item.status === 'completed' && (
                    <Link
                      href={`/library?src=${encodeURIComponent(item.url)}`}
                      className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> 記事を見る
                    </Link>
                  )}
                  {(isErrorStatus(item.status) || item.status === 'manually_closed') && (
                    <button
                      onClick={() => setStatus(item.id, 'pending', '解析待ちに戻しました')}
                      disabled={busy !== null}
                      className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" /> 再試行
                    </button>
                  )}
                  {(item.status === 'pending' || isErrorStatus(item.status)) && (
                    <button
                      onClick={() => setStatus(item.id, 'on_hold', '保留にしました（自動解析の対象外）')}
                      disabled={busy !== null}
                      className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Pause className="w-3 h-3" /> 保留
                    </button>
                  )}
                  {item.status === 'on_hold' && (
                    <button
                      onClick={() => setStatus(item.id, 'pending', '保留を解除しました')}
                      disabled={busy !== null}
                      className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-teal-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" /> 保留を解除
                    </button>
                  )}
                  {closable && (
                    <>
                      <button
                        onClick={() => closeToPlaylist([item.id])}
                        disabled={busy !== null}
                        className="px-2.5 py-1 rounded-md bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 hover:bg-indigo-900/50"
                        title="YouTubeの確認用プレイリストへ追加してクローズ"
                      >
                        <ListVideo className="w-3 h-3" /> プレイリストへ送る
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('この動画をクローズしますか？（記録は残り、監視で再登録されなくなります）')) return;
                          const json = await callApi(`cl_${item.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'close', ids: [item.id] }) });
                          if (json) { showMessage('クローズしました', 'success'); load(true); }
                        }}
                        disabled={busy !== null}
                        className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-rose-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> クローズ
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && items.length < total && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
        >
          {loadingMore ? '読み込み中...' : `さらに表示（${items.length} / ${total}件）`}
        </button>
      )}
    </div>
  );
}
