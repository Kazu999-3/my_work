'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Microscope, Send, RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface DeepDiveTask {
  id: string;
  status: string;
  payload: { video_url?: string; champion?: string };
  result?: { success?: boolean; stdout?: string; stderr?: string } | null;
  error_message?: string | null;
  updated_at: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: '待機中', className: 'bg-stone-100 text-stone-700 border-stone-200' },
  running: { label: '解析中', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  completed: { label: '完了', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  failed: { label: '失敗', className: 'bg-rose-50 text-rose-800 border-rose-300' },
};

export default function VideoDeepDiveRequestPanel() {
  const [videoUrl, setVideoUrl] = useState('');
  const [champion, setChampion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [tasks, setTasks] = useState<DeepDiveTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/video-analysis/deep-dive', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch {
      // ポーリング失敗は静かに無視（次回リトライで復旧するため）
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    // 実行中タスクが1件でもあれば10秒おきにポーリングして完了を検知する
    const timer = setInterval(fetchTasks, 10000);
    return () => clearInterval(timer);
  }, [fetchTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/video-analysis/deep-dive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoUrl.trim(), champion: champion.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message, type: 'success' });
        setVideoUrl('');
        setChampion('');
        fetchTasks();
      } else {
        setMessage({ text: data.error || 'リクエストに失敗しました。', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || '通信エラーが発生しました。', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-4">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60">
            <Microscope className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900">
              🔬 動画深掘りモード（個別YouTube解析リクエスト）
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">
              1本の動画を「対面相性」「マクロ判断」「ビルド」の3観点でAI解析し、対象チャンピオンの戦術バイブルへ追記します。
            </p>
          </div>
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

      <form onSubmit={handleSubmit} className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-4 space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube URL または動画ID"
            required
            className="md:col-span-2 px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          <input
            type="text"
            value={champion}
            onChange={(e) => setChampion(e.target.value)}
            placeholder="対象チャンピオン（省略時は自動判定）"
            className="px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={submitting || !videoUrl.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'リクエスト送信中...' : '深掘り解析をリクエスト'}</span>
          </button>
        </div>
      </form>

      {!loadingTasks && tasks.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <h4 className="text-[11px] font-black text-stone-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            直近のリクエスト履歴
          </h4>
          <div className="space-y-1.5">
            {tasks.slice(0, 5).map((task) => {
              const statusInfo = STATUS_LABELS[task.status] || STATUS_LABELS.pending;
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {task.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />}
                    <span className="text-stone-800 font-medium truncate">
                      {task.payload?.champion || '(自動判定)'} — {task.payload?.video_url}
                    </span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
