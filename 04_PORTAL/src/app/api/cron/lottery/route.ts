import { NextRequest, NextResponse } from 'next/server';
import { executeLotteryDraw } from '../../../../lib/lotteryEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelCron = userAgent.includes('vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  const bearerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  // 認証チェック（Vercel Cron または CRON_SECRET Bearer、または開発環境/手動トリガー）
  const isDev = process.env.NODE_ENV === 'development';
  if (!bearerOk && !isVercelCron && !isDev) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (!key || key !== (process.env.ADMIN_SECRET_KEY || 'ktm_admin_secret')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await executeLotteryDraw();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[cron/lottery] Error:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
