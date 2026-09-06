'use client';

import { useState, useEffect } from 'react';

export default function OverlayLauncherButton() {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/overlay');
      const data = await res.json();
      setRunning(!!data.running);
    } catch {
      setRunning(false);
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

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`px-3.5 py-2 font-black text-xs rounded-xl shadow-xs transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer border ${
        running
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 ring-2 ring-emerald-400/40'
          : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
      }`}
      title={running ? 'Sovereign HUD 実行中 (クリックで停止)' : '実戦オーバーレイ (Sovereign HUD) を起動'}
    >
      <span className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-300 animate-pulse' : 'bg-stone-500'}`} />
      <span>{loading ? '処理中...' : running ? '🎮 オーバーレイ起動中' : '🎮 オーバーレイ起動'}</span>
    </button>
  );
}
