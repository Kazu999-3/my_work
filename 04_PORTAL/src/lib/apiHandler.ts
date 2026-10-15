import { NextRequest, NextResponse } from 'next/server';
import { notifyPortalError } from './discordNotify';

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

      // 非同期でDiscord通知（レスポンスをブロックしない）
      notifyPortalError({
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
      });

      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: error?.message || 'サーバー内部でエラーが発生しました。',
        },
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

  notifyPortalError({
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
  });
}
