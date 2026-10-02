'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, Power, Trash2, Radar, Inbox } from 'lucide-react';

interface WatchItem {
  id: string;
  name: string | null;
  handle?: string | null;
  url?: string | null;
  active: boolean;
  last_fetched_at: string | null;
}

interface ResolveTask {
  id: string;
  status: string;
  payload: { url?: string } | null;
  error_message: string | null;
  created_at: string;
}

const LABEL = { channel: 'チャンネル', playlist: 'プレイリスト' } as const;
const PLACEHOLDER = {
  channel: 'https://www.youtube.com/@ChannelName',
  playlist: 'https://www.youtube.com/playlist?list=...',
} as const;
const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '依頼済み（PC待ち）', cls: 'text-amber-300' },
  running: { label: '処理中', cls: 'text-teal-300' },
  completed: { label: '登録完了', cls: 'text-emerald-400' },
  failed: { label: '失敗', cls: 'text-rose-400' },
};

export default function WatchTab({ kind }: { kind: 'channel' | 'playlist' }) {
  const label = LABEL[kind];
  const [items, setItems] = useState<WatchItem[]>([]);
  const [tasks, setTasks] = useState<ResolveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube/watch?kind=${kind}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setItems(json.items || []);
      setTasks(json.recentTasks || []);
    } catch (e: any) {
      showMessage(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  const call = async (key: string, init: RequestInit, qs = '') => {
    setBusy(key);
    try {
      const res = await fetch(`/api/youtube/watch?kind=${kind}${qs}`, { headers: { 'Content-Type': 'application/json' }, ...init });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '処理に失敗しました');
      showMessage(json.message || '完了しました', 'success');
      load();
    } catch (e: any) {
      showMessage(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const linkOf = (it: WatchItem) =>
    kind === 'channel' ? `https://www.youtube.com/channel/${it.id}` : it.url || `https://www.youtube.com/playlist?list=${it.id}`;

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-rose-950/30 border-rose-800/60 text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {kind === 'playlist' && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-1.5">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Inbox className="w-4 h-4" /> 受け箱プレイリストの使い方
          </div>
          <ol className="text-[11px] text-slate-300 space-y-0.5 list-decimal pl-4">
            <li>YouTubeで解析用のプレイリストを作ります。公開範囲は<b>「公開」か「限定公開」</b>にしてください（非公開は読み取れません）。</li>
            <li>そのプレイリストのURLを下に登録します（登録済みなら不要）。</li>
            <li>あとはPCでもスマホでも、YouTubeの「保存」でそのプレイリストに入れるだけです。3時間おきの巡回でキューに追加されます。すぐ入れたいときは「今すぐ巡回」を押してください。</li>
          </ol>
          <p className="text-[10px] text-slate-500">巡回と解析はPCのエッジワーカーが行います。キューに入った動画はプレイリストから外しても問題ありません（解析済みの記録が残るため二重に登録されません）。</p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (url.trim()) call('add', { method: 'POST', body: JSON.stringify({ url: url.trim() }) }).then(() => setUrl('')); }}
        className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
      >
        <div className="text-xs font-bold text-slate-200">監視する{label}を追加</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={PLACEHOLDER[kind]}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={busy !== null || !url.trim()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> 登録を依頼
          </button>
        </div>
        <p className="text-[10px] text-slate-500">URLからIDへの変換はPCのエッジワーカーが行います。登録結果は下の「最近の登録依頼」に表示されます。</p>
      </form>

      {tasks.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-300">最近の登録依頼</div>
          {tasks.map((t) => {
            const st = TASK_STATUS[t.status] || { label: t.status, cls: 'text-slate-400' };
            return (
              <div key={t.id} className="text-[11px] flex flex-wrap gap-x-2">
                <span className="text-slate-500">{new Date(t.created_at).toLocaleString('ja-JP')}</span>
                <span className={`font-bold ${st.cls}`}>{st.label}</span>
                <span className="text-slate-400 break-all">{t.payload?.url}</span>
                {t.status === 'failed' && t.error_message && (
                  <span className="w-full text-slate-500 break-all">{t.error_message.split('\n').slice(-1)[0].slice(0, 200)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">登録済みの{label}（{items.length}件）</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => call('scan', { method: 'POST', body: JSON.stringify({ action: 'scan' }) })}
            disabled={busy !== null}
            className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="チャンネルとプレイリストの新着を今すぐキューへ追加します（通常は3時間おき）"
          >
            <Radar className="w-3.5 h-3.5" /> 今すぐ巡回
          </button>
          <button onClick={load} disabled={loading} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 更新
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {!loading && items.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">登録された{label}はありません</div>
        )}
        {items.map((it) => (
          <div key={it.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="min-w-0 space-y-0.5">
              <a href={linkOf(it)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-200 hover:text-amber-400 flex items-center gap-1.5">
                <span className="truncate">{it.name || it.id}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
              </a>
              <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
                {it.handle && <span>{it.handle}</span>}
                <span className="font-mono">{it.id}</span>
                <span>最終巡回: {it.last_fetched_at ? new Date(it.last_fetched_at).toLocaleString('ja-JP') : '未巡回'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                it.active ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' : 'bg-slate-900 text-slate-500 border-slate-700'
              }`}>
                {it.active ? '監視ON' : '監視OFF'}
              </span>
              <button
                onClick={() => call(`tg_${it.id}`, { method: 'PATCH', body: JSON.stringify({ id: it.id, active: !it.active }) })}
                disabled={busy !== null}
                className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Power className="w-3 h-3" /> {it.active ? '停止' : '再開'}
              </button>
              <button
                onClick={() => {
                  if (!confirm(`「${it.name || it.id}」の監視登録を解除しますか？（キュー済みの動画や記事は消えません）`)) return;
                  call(`rm_${it.id}`, { method: 'DELETE' }, `&id=${encodeURIComponent(it.id)}`);
                }}
                disabled={busy !== null}
                className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-rose-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" /> 解除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
