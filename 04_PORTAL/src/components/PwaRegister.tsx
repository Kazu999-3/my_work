"use client";

import { useEffect } from 'react';

// Service Worker を登録するだけの小さなクライアントコンポーネント（課題#48）
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // 本番のみ登録（開発中のSWキャッシュ事故を避ける）
    if (window.location.hostname === 'localhost') return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW登録に失敗:', err);
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
