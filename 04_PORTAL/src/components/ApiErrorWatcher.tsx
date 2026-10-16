"use client";

import { useEffect } from 'react';

// 画面から呼んだ自サイトの API が 404 / 5xx を返したら #エラーログ へ自動で送る（2026-10-17）。
// それまで #エラーログ に届くのは「画面が壊れた時（error.tsx）」と「サーバー側で拾った例外」だけで、
// 画面は動いたまま API が 404（HTML）を返し「エラー: Unexpected token '<'…」と出る失敗は誰にも届かなかった
// （闇のスクラッチくじの API が .gitignore で本番に出ておらず404のままだった件）。
// 400/401/403 などは「コイン不足」「ログインが必要」など利用者の操作による通常の失敗なので送らない。
// 同じ API・同じ状態は 5 分に 1 回まで。送信先 /api/logs/error 自体の失敗は送らない（無限ループ防止）。

const DEDUPE_MS = 5 * 60 * 1000;

export default function ApiErrorWatcher() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.__ktmApiErrorWatcher) return; // 二重に差し替えない
    w.__ktmApiErrorWatcher = true;

    const originalFetch = window.fetch.bind(window);
    const lastSent = new Map<string, number>();

    const report = (method: string, path: string, status: number, contentType: string) => {
      const key = `${method} ${path} ${status}`;
      const now = Date.now();
      if (now - (lastSent.get(key) || 0) < DEDUPE_MS) return;
      lastSent.set(key, now);
      originalFetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `画面から呼んだ API が失敗: ${method} ${path} → ${status}${contentType.includes('text/html') ? '（HTMLが返った＝API自体が存在しない/落ちている可能性）' : ''}`,
          path: window.location.pathname,
          userAgent: navigator.userAgent,
          source: 'CLIENT',
        }),
      }).catch(() => {});
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      try {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
        const isOwnApi = url.origin === window.location.origin && url.pathname.startsWith('/api/') && url.pathname !== '/api/logs/error';
        if (isOwnApi && (res.status === 404 || res.status >= 500)) {
          const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase();
          report(method, url.pathname, res.status, res.headers.get('content-type') || '');
        }
      } catch {
        // 監視の失敗で本来の処理を止めない
      }
      return res;
    };
  }, []);

  return null;
}
