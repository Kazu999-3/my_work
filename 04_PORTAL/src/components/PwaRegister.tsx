"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { Download, X, HelpCircle } from 'lucide-react';

// Chrome PWA インストール対応コンポーネント
// - beforeinstallprompt を useRef で保持（staleクロージャ防止）
// - prompt が呼べない場合は手動インストールガイドを表示
export default function PwaRegister() {
  const promptRef = useRef<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 既にスタンドアロンで動作中ならバナー不要
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

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
        window.addEventListener('load', onLoad, { once: true });
      }
    }

    // Chrome PWA インストールイベントのキャッチ
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e; // useRef で保持（staleクロージャ回避）
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // インストール完了
    const handleInstalled = () => {
      promptRef.current = null;
      setIsInstalled(true);
      setShowInstallBanner(false);
    };
    window.addEventListener('appinstalled', handleInstalled);

    // バナーを初期表示（prompt未取得でも手動ガイドへ誘導可能）
    setShowInstallBanner(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    const prompt = promptRef.current;
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          promptRef.current = null;
          setShowInstallBanner(false);
          return;
        }
        // ユーザーがキャンセルした場合 → ガイドは出さずそのまま
        return;
      } catch (err) {
        console.error('PWA prompt error:', err);
      }
    }
    // beforeinstallprompt が取得できない場合 → 手動ガイドを表示
    setShowGuideModal(true);
  }, []);

  // 既にインストール済み or バナー非表示
  if (isInstalled || !showInstallBanner) return null;

  return (
    <>
      {/* 📲 PWA インストール誘導バナー */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] bg-[#161922] border border-[#c89b3c]/50 text-white p-4 rounded-2xl shadow-[0_0_25px_rgba(200,155,60,0.4)] flex items-center gap-4 max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-[#c89b3c]/20 border border-[#c89b3c]/60 flex items-center justify-center shrink-0">
          <Download className="text-[#c89b3c]" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black text-[#c89b3c]">KTM ポータル</h4>
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
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 📖 手動インストール手順モーダルガイド */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="bg-[#12141d] border border-[#c89b3c]/50 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 text-[#c89b3c]">
              <HelpCircle size={24} />
              <h3 className="text-base font-black text-white">アプリのインストール方法</h3>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <span className="text-base">🌐</span> Chrome / Edge (PC・スマホ)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-300 leading-relaxed">
                  <li>アドレスバー右端の <span className="inline-flex items-center bg-white/10 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[10px]">⊕</span> アイコン、または右上の <span className="font-mono text-amber-300">⋮</span> メニューを開く</li>
                  <li>「<span className="text-white font-bold">アプリをインストール</span>」をクリック</li>
                </ol>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <span className="text-base">📱</span> Safari (iOS / iPhone)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-300 leading-relaxed">
                  <li>画面下部の共有アイコン <span className="font-mono text-amber-300">⬆</span> をタップ</li>
                  <li>「<span className="text-white font-bold">ホーム画面に追加</span>」を選択</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-[#c89b3c] text-black font-black text-xs hover:bg-yellow-400 transition cursor-pointer"
            >
              了解しました
            </button>
          </div>
        </div>
      )}
    </>
  );
}
