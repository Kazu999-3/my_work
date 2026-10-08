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
      // 04側は Origin のある送信を 04/05 のものだけ受け付ける（鍵の無いサーバー間送信のため名乗る）
      headers: { 'Content-Type': 'application/json', Origin: 'https://ktm-pilot.vercel.app' },
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
