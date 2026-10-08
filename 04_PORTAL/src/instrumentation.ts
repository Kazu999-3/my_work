import type { Instrumentation } from 'next';

// サーバー側で捕まえられなかったエラー（画面の描画・APIルート・Server Action）を #エラーログ へ送る（2026-10-08）。
// 各APIルートの try/catch で握って 500 を返しているものはここには来ない（それは各ルートの責任）。
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  try {
    const { notifyPortalError } = await import('./lib/discordNotify');
    const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as any).digest) : undefined;
    await notifyPortalError({
      error: err,
      app: '04',
      source: context.routeType === 'action' ? 'SERVER_ACTION' : 'API',
      path: request.path.split('?')[0],
      method: request.method,
      context: { routePath: context.routePath, routeType: context.routeType, digest },
    });
  } catch (e) {
    console.error('[instrumentation] エラーログへの送信に失敗:', e);
  }
};
