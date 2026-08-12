"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, RefreshCw, Cpu, Activity, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';

interface TaskStatusDrawerProps {
  collapsed?: boolean;
  align?: 'left' | 'right';
}

export default function TaskStatusDrawer({ collapsed = false, align = 'left' }: TaskStatusDrawerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const [systemData, setSystemData] = useState<{
    worker: { active: boolean; status: string; last_active: string | null };
    queue: any[];
    history: any[];
    needsAttention: { failedTasks: any[]; youtubeErrorCount: number; dictReviewCount: number };
  }>({
    worker: { active: false, status: 'unknown', last_active: null },
    queue: [],
    history: [],
    needsAttention: { failedTasks: [], youtubeErrorCount: 0, dictReviewCount: 0 },
  });

  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  // champion_trend以外で再実行可能なタスク種別（/api/admin/tasks/retryが対応）
  const RETRYABLE_TASK_TYPES = new Set([
    'resolve_youtube_channel', 'resolve_youtube_playlist',
    'youtube_channel_monitor', 'reddit_scout', 'lol_trend_collect', 'dict_synthesizer',
  ]);

  const fetchTaskStatus = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-stats', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setSystemData({
        worker: data.worker || { active: false, status: 'unknown', last_active: null },
        queue: data.queue || [],
        history: data.history || [],
        needsAttention: data.needsAttention || { failedTasks: [], youtubeErrorCount: 0, dictReviewCount: 0 },
      });
    } catch (err) {
      console.warn('Failed to fetch task status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskStatus();
    const interval = setInterval(fetchTaskStatus, 15000); // 15秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        drawerRef.current && !drawerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => calculateCoords();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open]);

  const calculateCoords = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const drawerWidth = Math.min(384, window.innerWidth - 32);
    
    let left: number | undefined;
    let right: number | undefined;

    if (align === 'right') {
      const calculatedRight = window.innerWidth - rect.right;
      right = Math.max(16, Math.min(calculatedRight, window.innerWidth - drawerWidth - 16));
    } else {
      const calculatedLeft = rect.left;
      if (calculatedLeft + drawerWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - drawerWidth - 16);
      } else {
        left = Math.max(16, calculatedLeft);
      }
    }

    let top = rect.bottom + 8;
    if (top + 450 > window.innerHeight && rect.top > 450) {
      top = Math.max(16, rect.top - 460);
    }

    setCoords({ top, left, right });
  };

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setTimeout(calculateCoords, 0);
      }
      return next;
    });
  };

  const handleRetryTask = async (task: any) => {
    const isRetryable = task.task_type === 'champion_trend' || RETRYABLE_TASK_TYPES.has(task.task_type);
    if (!isRetryable) return;
    setRetryingTaskId(task.id);
    try {
      const res = task.task_type === 'champion_trend'
        ? await fetch('/api/admin/champions/trend', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ champion: task.payload?.champion, role: task.payload?.role || 'Jungle' }),
          })
        : await fetch('/api/admin/tasks/retry', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_type: task.task_type, payload: task.payload }),
          });
      const data = await res.json();
      if (data.success) {
        await fetchTaskStatus();
      } else {
        alert(data.error || '再実行の登録に失敗しました。');
      }
    } catch {
      alert('再実行中に通信エラーが発生しました。');
    } finally {
      setRetryingTaskId(null);
    }
  };

  const runningTasks = systemData.queue.filter((t) => t.status === 'running');
  const pendingTasks = systemData.queue.filter((t) => t.status === 'pending');
  const failedTasks = systemData.needsAttention.failedTasks;
  const isWorkerActive = systemData.worker.active;

  const badgeCount = runningTasks.length + failedTasks.length;
  const badgeColor = failedTasks.length > 0 ? 'bg-rose-500 text-white' : runningTasks.length > 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-stone-200 text-stone-700';

  const TASK_LABELS: Record<string, string> = {
    champion_trend: 'チャンピオントレンド更新',
    resolve_youtube_channel: 'YouTubeチャンネル登録',
    resolve_youtube_playlist: 'YouTubeプレイリスト登録',
    youtube_channel_monitor: 'YouTubeチャンネル監視',
    reddit_scout: 'Redditスカウト',
    lol_trend_collect: 'LoLトレンド収集',
    dict_synthesizer: '辞典シンセサイザー',
    champion_db_bulk_update: 'チャンピオン辞典一括更新',
    youtube_absorb: 'YouTube動画解析',
  };

  return (
    <div ref={containerRef} className={`relative ${collapsed ? '' : 'w-full'}`}>
      <button
        onClick={toggleOpen}
        title="タスクキュー状況"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all hover:bg-black/5 hover:text-stone-900 text-stone-700 relative ${
          collapsed ? 'justify-center' : 'w-full'
        }`}
      >
        <span className="relative flex items-center gap-1">
          <Zap size={16} className={runningTasks.length > 0 ? 'text-amber-500 animate-pulse' : 'text-stone-600'} />
          {badgeCount > 0 && (
            <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-black ${badgeColor}`}>
              {failedTasks.length > 0 ? `⚠️${failedTasks.length}` : runningTasks.length}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="truncate">
            タスク {runningTasks.length > 0 ? `(実行中${runningTasks.length})` : failedTasks.length > 0 ? `(要対応${failedTasks.length})` : ''}
          </span>
        )}
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={drawerRef}
          style={{ top: coords.top, left: coords.left, right: coords.right }}
          className="fixed z-50 w-96 max-w-[92vw] max-h-[85vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl space-y-4 p-4 text-xs font-sans animate-fade-in"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-600" />
              <span className="font-extrabold text-sm text-stone-900">リアルタイム・タスクキュー</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchTaskStatus()} className="p-1 rounded hover:bg-black/5 text-stone-500" title="最新状態に更新">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-black/5 text-stone-500">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 1. ワーカー稼働状況 */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2">
              <Cpu size={16} className={isWorkerActive ? 'text-emerald-600' : 'text-rose-500'} />
              <div>
                <span className="font-bold text-stone-900 block">エッジワーカー</span>
                <span className="text-[10px] text-stone-500">
                  {systemData.worker.last_active ? `最終動作: ${new Date(systemData.worker.last_active).toLocaleTimeString()}` : '未起動'}
                </span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${
              isWorkerActive ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-rose-100 border-rose-300 text-rose-700'
            }`}>
              {isWorkerActive ? '🟢 稼働中' : '🔴 未起動'}
            </span>
          </div>

          {/* 2. 要対応・失敗したタスク */}
          {failedTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                <AlertTriangle size={14} />
                <span>要対応・失敗タスク ({failedTasks.length}件)</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {failedTasks.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 space-y-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-stone-900 text-[11px] truncate">
                        {TASK_LABELS[t.task_type] || t.task_type}
                        {t.payload?.champion && <span className="text-stone-500 font-normal"> ({t.payload.champion})</span>}
                      </span>
                      {t.task_type === 'champion_db_bulk_update' ? (
                        <Link
                          href="/champions?tab=ai-update"
                          onClick={() => setOpen(false)}
                          className="shrink-0 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-md shadow flex items-center gap-1"
                        >
                          状況を見る
                        </Link>
                      ) : (t.task_type === 'champion_trend' || RETRYABLE_TASK_TYPES.has(t.task_type)) && (
                        <button
                          onClick={() => handleRetryTask(t)}
                          disabled={retryingTaskId === t.id}
                          className="shrink-0 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-md shadow disabled:opacity-50 flex items-center gap-1"
                        >
                          <RefreshCw size={10} className={retryingTaskId === t.id ? 'animate-spin' : ''} /> 再実行
                        </button>
                      )}
                    </div>
                    {t.error_message && (
                      <p className="text-[10px] text-rose-700 leading-tight truncate" title={t.error_message}>
                        {t.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 現在実行中のタスク */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-700 text-xs flex items-center gap-1">
                <Activity size={14} className="animate-pulse" /> 現在実行中 ({runningTasks.length}件)
              </span>
            </div>
            {runningTasks.length === 0 ? (
              <p className="text-[11px] text-stone-400 py-2 italic text-center bg-stone-50 rounded-xl border border-stone-100">現在実行中のタスクはありません</p>
            ) : (
              <div className="space-y-1.5">
                {runningTasks.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl border border-amber-300 bg-amber-50 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-bold text-stone-900 text-[11px] block">
                        {TASK_LABELS[t.task_type] || t.task_type}
                        {t.payload?.champion && <span className="text-stone-600"> ({t.payload.champion})</span>}
                      </span>
                      <span className="text-[9px] text-stone-500 font-mono">
                        開始: {new Date(t.updated_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 px-2 py-0.5 rounded bg-amber-200/80 animate-pulse shrink-0">
                      処理中...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. 待機中タスク */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-stone-700">
              <span>待機中キュー ({pendingTasks.length}件)</span>
            </div>
            {pendingTasks.length === 0 ? (
              <p className="text-[11px] text-stone-400 py-2 italic text-center bg-stone-50 rounded-xl border border-stone-100">順番待ちタスクはありません</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {pendingTasks.map((t, idx) => (
                  <div key={t.id} className="p-2 rounded-lg border border-stone-200 bg-white flex justify-between items-center text-[10px]">
                    <span className="font-bold text-stone-800">
                      #{idx + 1} {TASK_LABELS[t.task_type] || t.task_type}
                    </span>
                    <span className="text-stone-400 font-mono">{new Date(t.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. 直近実行履歴 */}
          {systemData.history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-200">
              <span className="font-bold text-stone-600 text-xs block">直近の実行履歴</span>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {systemData.history.slice(0, 5).map((h) => (
                  <div key={h.id} className="p-2 rounded-lg border border-stone-200 bg-stone-50 flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {h.status === 'completed' ? (
                        <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                      )}
                      <span className="font-bold text-stone-800 truncate">{TASK_LABELS[h.task_type] || h.task_type}</span>
                    </div>
                    <span className="text-stone-400 font-mono shrink-0">{new Date(h.updated_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
