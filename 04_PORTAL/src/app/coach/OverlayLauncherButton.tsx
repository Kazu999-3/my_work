'use client';

import { useState, useEffect } from 'react';

export default function OverlayLauncherButton() {
  const [running, setRunning] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/overlay');
      const data = await res.json();
      setRunning(!!data.running);
      setAutostart(!!data.autostartEnabled);
    } catch {
      setRunning(false);
      setAutostart(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const action = running ? 'stop' : 'start';
      const res = await fetch('/api/overlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setRunning(!running);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutostart = async () => {
    setLoading(true);
    try {
      const action = autostart ? 'disable_autostart' : 'enable_autostart';
      const res = await fetch('/api/overlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setAutostart(!autostart);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {/* メイン起動ボタン */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`px-3 py-1.5 font-bold text-xs rounded-xl shadow-xs transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer border ${
          running
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 ring-2 ring-emerald-400/40'
            : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
        }`}
        title={running ? 'Sovereign HUD 実行中 (クリックで停止)' : '実戦オーバーレイ (Sovereign HUD) を起動'}
      >
        <span className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-300 animate-pulse' : 'bg-stone-500'}`} />
        <span>{loading ? '処理中...' : running ? '👑 オーバーレイ監視中' : '👑 オーバーレイ起動'}</span>
      </button>

      {/* 自動起動設定トグルボタン */}
      <button
        type="button"
        onClick={handleToggleAutostart}
        disabled={loading}
        className={`px-2.5 py-1.5 font-bold text-[11px] rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
          autostart
            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-stone-900/60 hover:bg-stone-800 text-stone-400 border-stone-800 hover:text-stone-300'
        }`}
        title={autostart ? 'LoL起動時自動表示: 有効 (Windows起動時に自動常駐)' : 'LoL起動時自動表示: 無効 (クリックで自動常駐を有効化)'}
      >
        <span>{autostart ? '⚡ 自動常駐: ON' : '💤 自動常駐: OFF'}</span>
      </button>
    </div>
  );
}
