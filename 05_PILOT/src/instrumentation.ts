import type { Instrumentation } from 'next';

// サーバー側で捕まえられなかったエラーを、04のエラー受付API経由で #エラーログ へ送る（2026-10-08）。
// 05はDiscordの鍵を持たないため直接は送らない。各APIルートの try/catch で握った失敗はここには来ない。
const PORTAL_ORIGIN = 'https://my-work-8jbd.vercel.app';

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    await fetch(`${PORTAL_ORIGIN}/api/logs/error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: '05',
        source: context.routeType === 'action' ? 'SERVER_ACTION' : 'API',
        message: e.message,
        stack: e.stack,
        path: request.path.split('?')[0],
        method: request.method,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error('[instrumentation] エラーログへの送信に失敗:', e);
  }
};
