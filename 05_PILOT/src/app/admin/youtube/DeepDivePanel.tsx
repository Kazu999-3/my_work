'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Microscope, Send, Loader2 } from 'lucide-react';

// 動画深掘りモード（旧ポータル /admin/knowledge の VideoDeepDiveRequestPanel の移植）。2026-10-04
// 通常の解析キューとは別に、1本の動画を対面・マクロ・ビルドの3観点で解析して戦術バイブルへ追記する。

interface DeepDiveTask {
  id: string;
  status: string;
  payload: { video_url?: string; champion?: string };
  error_message?: string | null;
  created_at: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '待機中', cls: 'bg-slate-900 text-slate-400 border-slate-700' },
  running: { label: '解析中', cls: 'bg-amber-950/30 text-amber-400 border-amber-800/60' },
  completed: { label: '完了', cls: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' },
  failed: { label: '失敗', cls: 'bg-rose-950/30 text-rose-400 border-rose-800/60' },
};

export default function DeepDivePanel() {
  const [videoUrl, setVideoUrl] = useState('');
  const [champion, setChampion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [tasks, setTasks] = useState<DeepDiveTask[]>([]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/video-analysis/deep-dive');
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch {
      // 次のポーリングで復旧するため黙って待つ
    }
  }, []);

  const hasActive = tasks.some((t) => t.status === 'pending' || t.status === 'running');

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 待機中・解析中がある時だけ10秒おきに完了を確認する
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(fetchTasks, 10000);
    return () => clearInterval(timer);
  }, [hasActive, fetchTasks]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/video-analysis/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoUrl.trim(), champion: champion.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'リクエストに失敗しました');
      setMessage({ text: data.message, ok: true });
      setVideoUrl('');
      setChampion('');
      fetchTasks();
    } catch (err: any) {
      setMessage({ text: err.message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
      <div>
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          <Microscope className="w-4 h-4 text-amber-400" /> 動画深掘りモード
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5">
          1本の動画を「対面相性」「マクロ判断」「ビルド」の3観点で解析し、対象チャンピオンの戦術バイブルへ追記します（PCのエッジワーカーで実行）。
        </p>
      </div>

      {message && (
        <div className={`p-2.5 rounded-xl text-xs font-bold border ${message.ok ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' : 'bg-rose-950/30 text-rose-400 border-rose-800/60'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="YouTube URL または動画ID"
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
        />
        <input
          type="text"
          value={champion}
          onChange={(e) => setChampion(e.target.value)}
          placeholder="対象チャンピオン（省略時は自動判定）"
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
        />
        <button
          type="submit"
          disabled={submitting || !videoUrl.trim()}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" /> {submitting ? '送信中...' : '深掘り解析'}
        </button>
      </form>

      {tasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400">直近のリクエスト</div>
          {tasks.slice(0, 5).map((t) => {
            const s = STATUS[t.status] || STATUS.pending;
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {t.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />}
                  <span className="text-slate-300 truncate">{t.payload?.champion || '（自動判定）'} — {t.payload?.video_url}</span>
                </div>
                <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${s.cls}`} title={t.error_message || ''}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
