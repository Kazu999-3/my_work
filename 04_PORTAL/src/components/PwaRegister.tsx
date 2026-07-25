"use client";

import { useEffect, useState } from 'react';
import { Download, X, HelpCircle } from 'lucide-react';

// Chrome PWA インストール対応コンポーネント (beforeinstallprompt サポート ＆ 手動ガイド対応)
export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

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

    // 常に手動で確認できるよう、インストール可能な場合またはスタンドアロン以外でバナーを表示
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) {
      setShowInstallBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('User accepted PWA install prompt');
          setDeferredPrompt(null);
          setShowInstallBanner(false);
          return;
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
    }
    // プロンプトが直接呼び出せないブラウザ（または標準ダイアログ遮断時）は分かりやすいガイドを表示
    setShowGuideModal(true);
  };

  if (!showInstallBanner) return null;

  return (
    <>
      {/* 📲 PWA インストール誘導バナー */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] bg-[#161922] border border-[#c89b3c]/50 text-white p-4 rounded-2xl shadow-[0_0_25px_rgba(200,155,60,0.4)] flex items-center gap-4 max-w-sm animate-bounce-short">
        <div className="w-10 h-10 rounded-xl bg-[#c89b3c]/20 border border-[#c89b3c]/60 flex items-center justify-center shrink-0">
          <Download className="text-[#c89b3c]" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black text-[#c89b3c]">KTM ポータル PWA</h4>
          <p className="text-[11px] text-gray-300 font-bold leading-snug">ホーム画面にアプリ化</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#c89b3c] text-black text-xs font-black hover:bg-yellow-400 active:scale-95 transition-all shadow cursor-pointer whitespace-nowrap"
          >
            インストール
          </button>
          <button
            type="button"
            onClick={() => setShowInstallBanner(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="閉じる"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 📖 手動インストール手順モーダルガイド */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowGuideModal(false)}>
          <div className="bg-[#12141d] border border-[#c89b3c]/50 rounded-3xl p-6 max-w-md w-full shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 text-[#c89b3c]">
              <HelpCircle size={24} />
              <h3 className="text-base font-black text-white">アプリの追加方法ガイド</h3>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-white mb-1 flex items-center gap-1">🌐 Chrome / Chromium (PC / スマホ)</div>
                <p>画面右上のメニューアイコン（<span className="font-mono text-amber-300">⋮</span> または <span className="font-mono text-amber-300">︙</span>）をタップ ➔ **「アプリをインストール」** または **「ホーム画面に追加」** をクリックします。</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-white mb-1 flex items-center gap-1">📱 Safari (iOS / iPhone)</div>
                <p>画面下部の共有アイコン（<span className="font-mono text-amber-300">↑</span>）をタップ ➔ **「ホーム画面に追加」** を選択します。</p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-[#c89b3c] text-black font-black text-xs hover:bg-yellow-400 transition"
            >
              了解しました
            </button>
          </div>
        </div>
      )}
    </>
  );
}
