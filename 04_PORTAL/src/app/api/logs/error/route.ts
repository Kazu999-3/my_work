import { NextRequest, NextResponse } from 'next/server';
import { notifyPortalError, type ErrorLogApp } from '../../../../lib/discordNotify';

// 04のブラウザ側エラーに加え、05(KTM Pilot)のサーバー/画面エラーと毎朝の健康診断の異常もここで受けて
// #エラーログ へ集約する（05はDiscordの鍵を持たないため、04経由で送る）。
const EXTERNAL_APPS: ErrorLogApp[] = ['05', 'health'];
const SOURCES = ['API', 'CLIENT', 'CRON', 'SERVER_ACTION', 'TASK'] as const;

// 2026-10-08: 認証が無く、誰でも #エラーログ へ任意の文面を投稿できたため制限を追加。
// ブラウザ(04の画面・05の画面)からの送信には鍵を持たせられないので、次の組み合わせで守る:
//  - Origin がある送信は 04/05 のものだけ受ける（他サイトの画面からの悪用を防ぐ）
//  - Origin が無い送信（サーバー/スクリプト）は x-bot-secret を必須にする
//  - 本文の大きさと、1インスタンスあたりの送信回数に上限を設ける
//  - Discord側では allowed_mentions で @everyone 等を無効化している（discordNotify.ts）
// curl で Origin を偽装すれば通るため完全な認証ではない。被害を「エラーログへの投稿」だけに抑える目的。
const ALLOWED_ORIGINS = new Set(['https://my-work-8jbd.vercel.app', 'https://ktm-pilot.vercel.app']);
const MAX_BODY_BYTES = 16_000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
let rateWindowStart = 0;
let rateCount = 0;

function isAllowedCaller(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (origin) {
    return ALLOWED_ORIGINS.has(origin) || origin === req.nextUrl.origin;
  }
  const secret = (process.env.PORTAL_BOT_SECRET || '').trim();
  return !!secret && (req.headers.get('x-bot-secret') || '').trim() === secret;
}

function underRateLimit(): boolean {
  const now = Date.now();
  if (now - rateWindowStart > RATE_WINDOW_MS) {
    rateWindowStart = now;
    rateCount = 0;
  }
  rateCount++;
  return rateCount <= RATE_MAX;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedCaller(req)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
    }
    if (!underRateLimit()) {
      return NextResponse.json({ ok: false, error: 'Too many reports' }, { status: 429 });
    }
    const body = JSON.parse(raw);
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
