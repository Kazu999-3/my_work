'use client';

import { useState, useEffect } from 'react';

export default function OverlayLauncherButton() {
  const [running, setRunning] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [isCloud, setIsCloud] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/overlay');
      const data = await res.json();
      setRunning(!!data.running);
      setAutostart(!!data.autostartEnabled);
      setIsCloud(!!data.isCloud);
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

  const launchSovereignProtocol = () => {
    try {
      const a = document.createElement('a');
      a.href = 'sovereign://launch-overlay';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          if (document.body.contains(a)) document.body.removeChild(a);
        } catch {}
      }, 1500);
    } catch {
      window.location.href = 'sovereign://launch-overlay';
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    setFeedback(null);

    // 1. 直ちにカスタムプロトコル (sovereign://) を直接発火（User Gestureを維持してブラウザのブロックを回避）
    launchSovereignProtocol();
    setFeedback('🚀 Sovereign HUD 起動シグナル送信完了！（画面上部に👑バッジが出現）');
    setTimeout(() => setFeedback(null), 7000);

    try {
      // 2. ローカルサーバーが存在する場合はAPI経由でも状態確認・プロセス管理を実行
      if (!isCloud) {
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
      }
    } catch (e) {
      console.warn('API overlay fallback:', e);
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
      } else if (data.error) {
        setFeedback('⚠️ 自動常駐はPC内の install_overlay_autostart.bat を実行してください');
        setTimeout(() => setFeedback(null), 6000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ⚠️ 2026-09-23: オーバーレイは spawn('powershell.exe', ...) でローカルPCのプロセスを
  // 起動する機能のため、Vercel 上では原理的に動かない（/api/overlay も isCloud: true と
  // 返して何もしない）。それでもボタンが表示されていたため「押しても無反応」に見えていた。
  // クラウドでは丸ごと隠し、ローカルPCで開いたときだけ表示する。
  if (isCloud) return null;

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

      {/* フィードバックトースト */}
      {feedback && (
        <div className="absolute top-full right-0 mt-2 z-50 whitespace-nowrap bg-stone-900 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-amber-500/60 shadow-lg animate-in fade-in">
          {feedback}
        </div>
      )}
    </div>
  );
}
