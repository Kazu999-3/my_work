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
  // PCのChromeでは常時ボックス表示だと画面右下に居座って邪魔になるという指摘を受け、
  // 既定は小さいアイコンのみにし、クリックしたときだけインストール/✕を含むカードを開く。
  const [minimized, setMinimized] = useState(true);

  // ✕ で閉じた場合、7日間バナーを非表示にする
  const DISMISS_KEY = 'ktm_pwa_dismissed_at';
  const DISMISS_DAYS = 7;

  const dismissBanner = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShowBanner(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 既にスタンドアロンで動作中ならバナー不要。
    // iOS Safariの「ホーム画面に追加」はbeforeinstallprompt/appinstalledが一切発火せず、
    // display-modeのmatchMediaも機種・iOSバージョンによって拾えないことがあるため、
    // レガシーな navigator.standalone も合わせて見る（iOSでインストール後もバナーが
    // 消えなかった問題の対策）。
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) {
      try { localStorage.setItem(DISMISS_KEY, 'installed'); } catch {}
      return;
    }

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
      {minimized ? (
        /* 📲 最小化アイコン: デスクトップで表示（モバイルでは画面を広く清潔に保つ） */
        <button
          type="button"
          onClick={() => setMinimized(false)}
          title="ホーム画面にアプリ化"
          className="hidden md:flex fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-white/90 border border-[#c89b3c]/40 text-[#c89b3c] items-center justify-center shadow-md hover:bg-white transition-colors cursor-pointer"
        >
          <Download size={16} />
        </button>
      ) : (
        /* 📲 PWA インストール誘導カード（クリックで展開時のみ） */
        <div
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 bg-white border border-[#c89b3c]/30 text-stone-900 p-3 rounded-xl shadow-xl flex items-center gap-3 max-w-xs"
        >
          <div className="w-8 h-8 rounded-lg bg-[#c89b3c]/15 border border-[#c89b3c]/40 flex items-center justify-center shrink-0">
            <Download className="text-[#c89b3c]" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-700 font-bold leading-snug">ホーム画面にアプリ化</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onInstall}
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100000 }}
              className="px-2.5 py-1 rounded-lg bg-[#c89b3c] text-black text-[11px] font-black hover:bg-yellow-400 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              インストール
            </button>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              style={{ pointerEvents: 'auto' }}
              className="p-1 rounded-lg text-gray-400 hover:text-stone-900 hover:bg-black/5 transition-colors cursor-pointer"
              title="小さくする"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              style={{ pointerEvents: 'auto' }}
              className="text-[9px] text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
              title="7日間表示しない"
            >
              7日間非表示
            </button>
          </div>
        </div>
      )}

      {/* 📖 手動インストール手順モーダルガイド */}
      {showGuide && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100001 }}
          className="bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => { setShowGuide(false); dismissBanner(); }}
        >
          <div
            className="bg-white border border-[#c89b3c]/50 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowGuide(false); dismissBanner(); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-stone-900 p-1 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 text-[#c89b3c]">
              <HelpCircle size={24} />
              <h3 className="text-base font-black text-stone-900">アプリのインストール方法</h3>
            </div>

            <div className="space-y-4 text-xs text-gray-700">
              <div className="bg-black/3 p-3 rounded-xl border border-black/10">
                <div className="font-bold text-stone-900 mb-1.5 flex items-center gap-2">
                  <span className="text-base">🌐</span> Chrome / Edge (PC・スマホ)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 leading-relaxed">
                  <li>アドレスバー右端の <span className="inline-flex items-center bg-black/5 px-1.5 py-0.5 rounded text-amber-700 font-mono text-[10px]">⊕</span> アイコンをクリック</li>
                  <li>または右上の <span className="font-mono text-amber-700">⋮</span> → 「<span className="text-stone-900 font-bold">アプリをインストール</span>」</li>
                </ol>
              </div>

              <div className="bg-black/3 p-3 rounded-xl border border-black/10">
                <div className="font-bold text-stone-900 mb-1.5 flex items-center gap-2">
                  <span className="text-base">📱</span> Safari (iOS)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 leading-relaxed">
                  <li>画面下部の共有アイコン <span className="font-mono text-amber-700">⬆</span> をタップ</li>
                  <li>「<span className="text-stone-900 font-bold">ホーム画面に追加</span>」を選択</li>
                </ol>
              </div>

              <div className="bg-amber-100 p-3 rounded-xl border border-amber-200">
                <p className="text-amber-700 text-[11px] font-bold">
                  💡 Chrome で以前インストール画面を「キャンセル」した場合、しばらくの間ブラウザが自動プロンプトを表示しません。
                  上記の手動手順でインストールできます。
                </p>
              </div>
            </div>

            <button
              onClick={() => { setShowGuide(false); dismissBanner(); }}
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
