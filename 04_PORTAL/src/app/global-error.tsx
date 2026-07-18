"use client";

import { useEffect } from 'react';

// ルートレイアウト自体が落ちた場合の最終防衛線（#64）。
// global-error は独自の <html>/<body> を持つ必要がある。
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[portal global error]', error);
  }, [error]);

  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#06070a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fda4af' }}>重大なエラーが発生しました</p>
          <p style={{ fontSize: 12, color: '#9ca3af', maxWidth: 420, lineHeight: 1.7 }}>
            アプリの読み込みに失敗しました。ページを再読み込みしてください。
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(200,155,60,0.3)', background: 'rgba(200,155,60,0.1)', color: '#c89b3c', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
