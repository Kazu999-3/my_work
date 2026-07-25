"use client";

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Chrome PWA インストール対応コンポーネント (beforeinstallprompt サポート)
export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Service Worker 登録
    if ('serviceWorker' in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('SW登録に失敗:', err);
        });
      };
      if (document.readyState === 'complete') {
        onLoad();
      } else {
        window.addEventListener('load', onLoad);
      }
    }

    // Chrome PWA インストールイベントのキャッチ
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // ブラウザデフォルトの急なプロンプトを一旦保留
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // インストール完了時のイベント
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log('✅ KTMポータルがPWAとしてインストールされました。');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  if (!showInstallBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] bg-[#161922] border border-[#c89b3c]/40 text-white p-4 rounded-2xl shadow-[0_0_25px_rgba(200,155,60,0.3)] flex items-center gap-4 max-w-sm animate-bounce-short">
      <div className="w-10 h-10 rounded-xl bg-[#c89b3c]/20 border border-[#c89b3c]/50 flex items-center justify-center shrink-0">
        <Download className="text-[#c89b3c]" size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-black text-[#c89b3c]">KTM ポータル PWA</h4>
        <p className="text-[11px] text-gray-300 font-bold leading-snug">アプリとして画面にインストール</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-xl bg-[#c89b3c] text-black text-xs font-black hover:bg-yellow-400 transition-all shadow cursor-pointer whitespace-nowrap"
        >
          インストール
        </button>
        <button
          onClick={() => setShowInstallBanner(false)}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="閉じる"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
