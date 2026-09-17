import { NextRequest, NextResponse } from 'next/server';
import { notifyPortalError } from '@/lib/discordNotify';

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
    } = body || {};

    if (!message && !stack) {
      return NextResponse.json({ ok: false, error: 'Message or stack is required' }, { status: 400 });
    }

    // Discordへエラーを転送
    await notifyPortalError({
      error: message || 'Client Unhandled Exception',
      source: 'CLIENT',
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
