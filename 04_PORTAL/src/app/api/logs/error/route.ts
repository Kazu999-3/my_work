import { NextRequest, NextResponse } from 'next/server';
import { notifyPortalError, type ErrorLogApp } from '../../../../lib/discordNotify';

// 04のブラウザ側エラーに加え、05(KTM Pilot)のサーバー/画面エラーと毎朝の健康診断の異常もここで受けて
// #エラーログ へ集約する（05はDiscordの鍵を持たないため、04経由で送る）。
const EXTERNAL_APPS: ErrorLogApp[] = ['05', 'health'];
const SOURCES = ['API', 'CLIENT', 'CRON', 'SERVER_ACTION', 'TASK'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      stack,
      path,
      userAgent,
      userId,
      userName,
      componentStack,
      app,
      source,
      method,
    } = body || {};

    if (!message && !stack) {
      return NextResponse.json({ ok: false, error: 'Message or stack is required' }, { status: 400 });
    }

    // Discordへエラーを転送
    await notifyPortalError({
      error: message || 'Client Unhandled Exception',
      app: EXTERNAL_APPS.includes(app) ? app : '04',
      source: SOURCES.includes(source) ? source : 'CLIENT',
      method: typeof method === 'string' ? method.slice(0, 10) : undefined,
      path: path || 'Browser UI',
      userId,
      userName,
      context: {
        userAgent: (userAgent || req.headers.get('user-agent') || '').slice(0, 150),
        componentStack: componentStack ? String(componentStack).slice(0, 300) : undefined,
        stack: stack ? String(stack).slice(0, 500) : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Failed to log client error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
