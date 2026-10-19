import { NextRequest, after } from 'next/server';
import { notifyPortalError } from './discordNotify';

/**
 * Discord通知をレスポンス返却後も最後まで実行させる。
 * 単なる fire-and-forget だと、Vercel ではレスポンス返却時点で関数が止まり送信が消えることがある。
 * after() はリクエストのスコープ外（スクリプト・テスト等）では例外になるため、その場合は従来通り投げっぱなしにする。
 */
function runAfterResponse(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

/**
 * 既存の try/catch ブロック内で手動呼び出しするためのヘルパー
 */
export function reportApiError(params: {
  route: string;
  error: unknown;
  req?: NextRequest;
  userId?: string;
  userName?: string;
  statusCode?: number;
  context?: Record<string, any>;
}) {
  const { route, error, req, userId, userName, statusCode = 500, context } = params;

  runAfterResponse(() => notifyPortalError({
    error,
    app: '04',
    source: 'API',
    path: req?.nextUrl?.pathname || route,
    method: req?.method || 'POST',
    statusCode,
    userId,
    userName,
    context: {
      route,
      ...context,
    },
  }).catch((notifyErr) => {
    console.warn(`[reportApiError] Discord通知送信エラー (${route}):`, notifyErr);
  }));
}
