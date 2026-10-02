'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Cpu } from 'lucide-react';

interface Status {
  worker: { active: boolean; lastHeartbeat: string | null; diffSeconds: number | null; status: string | null };
  tasks: { waiting: { id: string; task_type: string; status: string; created_at: string }[]; failed24h: number; latestFailure: { task_type: string; error_message: string; updated_at: string } | null };
  videos: { pending: number; completed24h: number; lastCompletedAt: string | null };
}

function ago(iso: string | null): string {
  if (!iso) return '記録なし';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`;
  return `${Math.floor(sec / 86400)}日${Math.floor((sec % 86400) / 3600)}時間前`;
}

// 動画解析はPCのエッジワーカーだけが担当している（GitHub Actions側は2026-07-31に定期実行を停止）。
// PCが止まると解析も止まるが、画面に出していなかったため9/30〜10/2に約44時間気づけなかった。
export default function WorkerStatusPanel() {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube/worker-status');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setData(json);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const active = data?.worker.active;

  return (
    <div className={`p-4 rounded-xl border space-y-3 ${
      !data ? 'bg-slate-900/80 border-slate-800' : active ? 'bg-slate-900/80 border-emerald-800/60' : 'bg-rose-950/20 border-rose-800/60'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" /> PCエッジワーカーの稼働状況
        </h3>
        <button onClick={load} disabled={loading} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 更新
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {data && (
        <>
          <p className={`text-xs font-bold ${active ? 'text-emerald-400' : 'text-rose-400'}`}>
            {active
              ? `✅ 稼働中（最終応答 ${ago(data.worker.lastHeartbeat)}${data.worker.status && data.worker.status !== 'idle' ? `・${data.worker.status}` : ''}）`
              : `🛑 停止中（最終応答 ${ago(data.worker.lastHeartbeat)}）— PCでデーモンを起動するまで動画解析・チャンネル登録は進みません`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-500">解析待ちの動画</div>
              <div className="text-sm font-black text-amber-300 font-mono">{data.videos.pending}件</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-500">直近24時間の完了</div>
              <div className="text-sm font-black text-white font-mono">{data.videos.completed24h}件</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-500">最後の解析完了</div>
              <div className="text-sm font-black text-white">{ago(data.videos.lastCompletedAt)}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-500">直近24時間の失敗タスク</div>
              <div className={`text-sm font-black font-mono ${data.tasks.failed24h > 0 ? 'text-rose-400' : 'text-white'}`}>{data.tasks.failed24h}件</div>
            </div>
          </div>
          {data.tasks.waiting.length > 0 && (
            <p className="text-[11px] text-slate-400">
              待機中のタスク {data.tasks.waiting.length}件: {Array.from(new Set(data.tasks.waiting.map((t) => t.task_type))).join(' / ')}
            </p>
          )}
          {data.tasks.latestFailure && (
            <p className="text-[11px] text-slate-500 break-all">
              最新の失敗（{ago(data.tasks.latestFailure.updated_at)}・{data.tasks.latestFailure.task_type}）: {/* 1行目は「Exit code 1」等で原因が分からないため、最後の行（実際の例外）を出す */}
              {data.tasks.latestFailure.error_message.split('\n').filter((l) => l.trim()).slice(-1)[0]}
            </p>
          )}
          {!active && (
            <p className="text-[11px] text-slate-400">
              起動方法: PCで <code className="px-1 rounded bg-slate-950 text-amber-300">python 03_SYSTEMS/v2_CORE/edge_worker_daemon.py</code>（Claude Codeなら <code className="px-1 rounded bg-slate-950 text-amber-300">/dev-edge</code>）
            </p>
          )}
        </>
      )}
    </div>
  );
}
