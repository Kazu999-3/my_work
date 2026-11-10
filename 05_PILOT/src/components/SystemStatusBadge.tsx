'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { Gamepad2, Video, RefreshCw, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface SystemStatus {
  hud: { active: boolean; lastSeenSec: number | null; status: string };
  worker: { active: boolean; lastSeenSec: number | null; status: string };
}

function formatSec(sec: number | null): string {
  if (sec === null) return '未検出';
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  return `${Math.floor(sec / 3600)}時間前`;
}

export default function SystemStatusBadge() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatus(data);
        }
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  // 初回取得 ＆ 画面表示中30秒おきポーリング（完全無料・負荷最小）
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  useVisiblePolling(fetchStatus, 30_000);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hudActive = status?.hud?.active ?? false;
  const workerActive = status?.worker?.active ?? false;

  // バッジ全体の状態判定
  const isAllGood = hudActive && workerActive;
  const isPartial = hudActive || workerActive;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-bold transition cursor-pointer shadow-sm"
        title="HUDオーバーレイ ＆ 動画解析ワーカーの稼働状況"
      >
        {/* ステータスランプ */}
        <span className="relative flex h-2 w-2">
          {isAllGood ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : isPartial ? (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
          )}
        </span>

        <span className="hidden sm:inline text-[11px] text-zinc-300">
          {isAllGood ? '全システム正常' : isPartial ? (hudActive ? 'HUD稼働中' : '解析稼働中') : '待機中'}
        </span>
      </button>

      {/* ポップアップドロップダウン */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-zinc-900/95 border border-zinc-800 p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-extrabold text-[11px] text-zinc-400 uppercase tracking-wider">
              システム稼働モニター
            </span>
            <button
              onClick={() => fetchStatus()}
              disabled={loading}
              className="text-zinc-400 hover:text-white transition p-1 cursor-pointer disabled:opacity-50"
              title="更新"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-amber-400' : ''} />
            </button>
          </div>

          <div className="space-y-2">
            {/* 🎮 Overwolf HUD */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/70 border border-zinc-850">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${hudActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Gamepad2 size={15} />
                </div>
                <div>
                  <div className="font-bold text-zinc-200 text-[11px]">Overwolf HUD</div>
                  <div className="text-[10px] text-zinc-500">
                    最終通信: {formatSec(status?.hud?.lastSeenSec ?? null)}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hudActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {hudActive ? '稼働中' : '未起動'}
              </span>
            </div>

            {/* 🎥 YouTube動画解析 */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/70 border border-zinc-850">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${workerActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Video size={15} />
                </div>
                <div>
                  <div className="font-bold text-zinc-200 text-[11px]">動画解析ワーカー</div>
                  <div className="text-[10px] text-zinc-500">
                    最終通信: {formatSec(status?.worker?.lastSeenSec ?? null)}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                workerActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {workerActive ? '稼働中' : '停止中'}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 text-center leading-tight">
            PC上のOverwolfおよび動画解析ワーカーと自動同期（完全無料）
          </p>
        </div>
      )}
    </div>
  );
}
