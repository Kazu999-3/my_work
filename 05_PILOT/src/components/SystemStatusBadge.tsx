'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { Gamepad2, Video, RefreshCw } from 'lucide-react';

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
  const [openModal, setOpenModal] = useState<'hud' | 'worker' | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 初回取得 ＆ 画面表示中30秒おきポーリング（完全無料・負荷ゼロ）
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  useVisiblePolling(fetchStatus, 30_000);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenModal(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hudActive = status?.hud?.active ?? false;
  const workerActive = status?.worker?.active ?? false;

  return (
    <div className="flex items-center gap-1.5 shrink-0" ref={containerRef}>
      {/* 🎮 1. HUDオーバーレイ 独立バッジ */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenModal(openModal === 'hud' ? null : 'hud')}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer shadow-sm ${
            hudActive
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
          title="Overwolf HUDオーバーレイの接続状況"
        >
          {/* ランプ */}
          <span className="relative flex h-2 w-2">
            {hudActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
            )}
          </span>

          <Gamepad2 size={13} className={hudActive ? 'text-emerald-400' : 'text-zinc-500'} />
          <span className="hidden sm:inline">HUD</span>
        </button>

        {/* HUD 詳細ポップオーバー */}
        {openModal === 'hud' && (
          <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900/95 border border-zinc-800 p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-extrabold text-[11px] text-zinc-300 flex items-center gap-1.5">
                <Gamepad2 size={14} className="text-emerald-400" />
                <span>Overwolf HUD</span>
              </span>
              <button
                onClick={() => fetchStatus()}
                disabled={loading}
                className="text-zinc-400 hover:text-white transition p-1 cursor-pointer disabled:opacity-50"
                title="更新"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin text-amber-400' : ''} />
              </button>
            </div>

            <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-850 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">稼働ステータス:</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hudActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {hudActive ? '🟢 稼働中' : '⚪ 未起動'}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500">
                最終通信: {formatSec(status?.hud?.lastSeenSec ?? null)}
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 text-center leading-tight">
              {hudActive ? 'ゲーム画面上にキルライン等のHUDが表示されます' : 'OverwolfデスクトップアプリからHUDを起動してください'}
            </p>
          </div>
        )}
      </div>

      {/* 🎥 2. 動画解析ワーカー 独立バッジ */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenModal(openModal === 'worker' ? null : 'worker')}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer shadow-sm ${
            workerActive
              ? 'bg-purple-950/40 border-purple-500/50 text-purple-300 hover:bg-purple-900/50'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
          title="YouTube動画解析エッジワーカーの稼働状況"
        >
          {/* ランプ */}
          <span className="relative flex h-2 w-2">
            {workerActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
            )}
          </span>

          <Video size={13} className={workerActive ? 'text-purple-400' : 'text-zinc-500'} />
          <span className="hidden sm:inline">解析</span>
        </button>

        {/* 動画解析 詳細ポップオーバー */}
        {openModal === 'worker' && (
          <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900/95 border border-zinc-800 p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-extrabold text-[11px] text-zinc-300 flex items-center gap-1.5">
                <Video size={14} className="text-purple-400" />
                <span>動画解析ワーカー</span>
              </span>
              <button
                onClick={() => fetchStatus()}
                disabled={loading}
                className="text-zinc-400 hover:text-white transition p-1 cursor-pointer disabled:opacity-50"
                title="更新"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin text-amber-400' : ''} />
              </button>
            </div>

            <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-850 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">稼働ステータス:</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  workerActive ? 'bg-purple-950 text-purple-300 border border-purple-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {workerActive ? '🟢 稼働中' : '⚪ 停止中'}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500">
                最終通信: {formatSec(status?.worker?.lastSeenSec ?? null)}
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 text-center leading-tight">
              PC上のエッジワーカーが新着動画の要約と知見生成を自動実行します
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
