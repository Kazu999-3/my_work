'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineNotifier() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    // 初期チェック
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs border border-rose-400 animate-bounce">
      <WifiOff className="w-4 h-4 text-rose-200" />
      <span>⚠️ ネットワークがオフラインです。インターネット接続を確認してください。</span>
    </div>
  );
}
