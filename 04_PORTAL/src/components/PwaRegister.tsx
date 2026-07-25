"use client";

import { useEffect, useState, useCallback } from 'react';
import { Download, X, HelpCircle } from 'lucide-react';

// TypeScript 用: グローバル window に __pwaPrompt を定義
declare global {
  interface Window {
    __pwaPrompt: any;
  }
}

/**
 * PWA インストール誘導コンポーネント
 * 
 * 3段構えの戦略:
 * 1. layout.tsx の beforeInteractive スクリプトで早期キャッチした window.__pwaPrompt を使用
 * 2. useEffect 内のリスナーで後発の beforeinstallprompt をキャッチ
 * 3. prompt が使えない場合（キャンセル済み等）は手動インストールガイドモーダルを表示
 */
export default function PwaRegister() {
  const [showBanner, setShowBanner] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // ✕ で閉じた場合、7日間バナーを非表示にする
  const DISMISS_KEY = 'ktm_pwa_dismissed_at';
  const DISMISS_DAYS = 7;

  const dismissBanner = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShowBanner(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 既にスタンドアロンで動作中ならバナー不要
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // 過去7日以内に ✕ で閉じた場合は表示しない
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const elapsed = Date.now() - Number(dismissed);
        if (elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      }
    } catch {}

    // Service Worker 登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // 後発の beforeinstallprompt をキャッチ（早期キャッチ分は layout.tsx 側で処理済み）
    const handler = (e: Event) => {
      e.preventDefault();
      window.__pwaPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      try { localStorage.setItem(DISMISS_KEY, 'installed'); } catch {}
      setShowBanner(false);
    });

    // バナーを表示
    setShowBanner(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // インストールボタンのクリックハンドラ
  const onInstall = useCallback(async () => {
    const prompt = window.__pwaPrompt;

    if (prompt) {
      try {
        // Chrome の native インストールダイアログを表示
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          window.__pwaPrompt = null;
          setShowBanner(false);
          return;
        }
        // キャンセルされた → 使い切りなのでクリア
        window.__pwaPrompt = null;
        // ガイドは出さず、バナーを残す
        return;
      } catch {
        // 使い切りプロンプトの再利用エラー等 → ガイドへフォールバック
        window.__pwaPrompt = null;
      }
    }

    // prompt が無い or エラー → 手動ガイドモーダルを表示
    setShowGuide(true);
  }, []);

  if (!showBanner) return null;

  return (
    <>
      {/* 📲 PWA インストール誘導バナー */}
      <div
        style={{ position: 'fixed', bottom: '5rem', right: '1rem', zIndex: 99999 }}
        className="bg-[#161922] border border-[#c89b3c]/50 text-white p-4 rounded-2xl shadow-[0_0_25px_rgba(200,155,60,0.4)] flex items-center gap-4 max-w-sm md:bottom-6"
      >
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
            onClick={onInstall}
            style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100000 }}
            className="px-3 py-1.5 rounded-xl bg-[#c89b3c] text-black text-xs font-black hover:bg-yellow-400 active:scale-95 transition-all shadow cursor-pointer whitespace-nowrap"
          >
            インストール
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            style={{ pointerEvents: 'auto' }}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="7日間非表示"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 📖 手動インストール手順モーダルガイド */}
      {showGuide && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100001 }}
          className="bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-[#12141d] border border-[#c89b3c]/50 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGuide(false)}
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
                  <li>アドレスバー右端の <span className="inline-flex items-center bg-white/10 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[10px]">⊕</span> アイコンをクリック</li>
                  <li>または右上の <span className="font-mono text-amber-300">⋮</span> → 「<span className="text-white font-bold">アプリをインストール</span>」</li>
                </ol>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <span className="text-base">📱</span> Safari (iOS)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-300 leading-relaxed">
                  <li>画面下部の共有アイコン <span className="font-mono text-amber-300">⬆</span> をタップ</li>
                  <li>「<span className="text-white font-bold">ホーム画面に追加</span>」を選択</li>
                </ol>
              </div>

              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <p className="text-amber-300 text-[11px] font-bold">
                  💡 Chrome で以前インストール画面を「キャンセル」した場合、しばらくの間ブラウザが自動プロンプトを表示しません。
                  上記の手動手順でインストールできます。
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
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
