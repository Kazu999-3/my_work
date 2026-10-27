'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useVisiblePolling } from '../../../lib/useVisiblePolling';
import { RefreshCw, Cpu, Activity, Gamepad2, MapPin, Terminal, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

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

  // 画面が表に出ている間だけ30秒おき
  useVisiblePolling(load, 30_000);

  const active = data?.worker.active;

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 transition shadow-lg ${
      !data ? 'bg-zinc-900/80 border-zinc-800' : active ? 'bg-zinc-900/90 border-emerald-800/60 shadow-emerald-950/20' : 'bg-rose-950/20 border-rose-800/60'
    }`}>
      {/* ヘッダー部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              裏方デーモン ＆ 自動化パイプライン稼働状況
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              PCローカルデーモン・動画解析・リプレイ監視のリアルタイム状態
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>最新化</span>
        </button>
      </div>

      {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/60">{error}</p>}

      {data && (
        <>
          {/* 🚦 各デーモンの状態バッジグリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1. Edge Worker */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
              active ? 'bg-emerald-950/25 border-emerald-800/50' : 'bg-rose-950/20 border-rose-800/50'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <div className="min-w-0">
                  <div className="text-xs font-black text-zinc-100 truncate">動画解析 (Edge Worker)</div>
                  <div className={`text-[10px] font-bold ${active ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {active ? `稼働中 (${ago(data.worker.lastHeartbeat)})` : '停止中'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. リプレイ道筋ワーカー */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-black text-zinc-100 truncate">リプレイ道筋 (Replay)</div>
                  <div className="text-[10px] text-zinc-400">常駐 / 単発取り込み対応</div>
                </div>
              </div>
              <MapPin className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
            </div>

            {/* 3. 実戦HUDオーバーレイ */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-black text-zinc-100 truncate">試合中HUD (Overlay)</div>
                  <div className="text-[10px] text-zinc-400">Web / ローカル連動</div>
                </div>
              </div>
              <Gamepad2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            </div>
          </div>

          {/* 実測数値カード */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
              <div className="text-zinc-500 font-bold">解析待ちの動画</div>
              <div className="text-sm font-black text-amber-300 font-mono mt-0.5">{data.videos.pending} 件</div>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
              <div className="text-zinc-500 font-bold">直近24時間の完了</div>
              <div className="text-sm font-black text-white font-mono mt-0.5">{data.videos.completed24h} 件</div>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
              <div className="text-zinc-500 font-bold">最後の解析完了</div>
              <div className="text-xs font-black text-white mt-0.5">{ago(data.videos.lastCompletedAt)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
              <div className="text-zinc-500 font-bold">直近24時間の失敗</div>
              <div className={`text-sm font-black font-mono mt-0.5 ${data.tasks.failed24h > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {data.tasks.failed24h} 件
              </div>
            </div>
          </div>

          {data.tasks.waiting.length > 0 && (
            <p className="text-[11px] text-zinc-400 bg-zinc-950/40 p-2 rounded-lg border border-zinc-800/60">
              待機中のタスク {data.tasks.waiting.length}件: {Array.from(new Set(data.tasks.waiting.map((t) => t.task_type))).join(' / ')}
            </p>
          )}

          {data.tasks.latestFailure && (
            <p className="text-[11px] text-zinc-500 break-all bg-rose-950/20 p-2 rounded-lg border border-rose-900/40">
              最新の失敗（{ago(data.tasks.latestFailure.updated_at)}・{data.tasks.latestFailure.task_type}）: 
              {data.tasks.latestFailure.error_message.split('\n').filter((l) => l.trim()).slice(-1)[0]}
            </p>
          )}

          {/* 💡 操作ガイド（統合ランチャーへの誘導） */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Terminal className="w-4 h-4 shrink-0" />
              <span>デスクトップの「👑 Sovereign 統合ランチャー.bat」で全デーモンを一括管理</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              [1] 全起動 / [2] 全停止 / [3] 道筋取り込み
            </span>
          </div>
        </>
      )}
    </div>
  );
}
