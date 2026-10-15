import { NextRequest, NextResponse, after } from 'next/server';
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
 * Next.js App Router API Route 用のグローバルエラーハンドラー
 * 
 * ハンドラー内でキャッチされなかった例外（500エラー）を自動補足し、
 * Discord #エラーログ チャンネル (1550118540038774865) へ集約通知する。
 */
export function withApiErrorLogging<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse | Response>,
  routeName: string
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse | Response> => {
    try {
      return await handler(req, ...args);
    } catch (error: any) {
      console.error(`[API Error] ${routeName}:`, error);

      // レスポンス返却後にDiscord通知（レスポンスはブロックしない）
      runAfterResponse(() => notifyPortalError({
        error,
        app: '04',
        source: 'API',
        path: req.nextUrl?.pathname || routeName,
        method: req.method,
        statusCode: 500,
        context: {
          routeName,
          query: req.nextUrl ? Object.fromEntries(req.nextUrl.searchParams.entries()) : {},
        },
      }).catch((notifyErr) => {
        console.warn(`[withApiErrorLogging] Discord通知送信エラー (${routeName}):`, notifyErr);
      }));

      return NextResponse.json(
        // 内部エラーの文面は利用者に返さない（詳細は #エラーログ 側で確認する）
        { error: 'サーバー内部でエラーが発生しました。' },
        { status: 500 }
      );
    }
  };
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
