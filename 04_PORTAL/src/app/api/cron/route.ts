import { NextResponse } from 'next/server';

export const maxDuration = 30; // 30秒でタイムアウト

export async function GET(request: Request) {
  // RenderにデプロイしたAntigravity APIのURL
  // （本番環境では環境変数 process.env.API_SERVER_URL にする）
  const API_SERVER_URL = process.env.API_SERVER_URL || 'https://antigravity-api-nzo3.onrender.com';
  
  // 認証キー（Cronからのリクエストであることを証明する）
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Render上の /api/pulse (メタ検知) と /api/monetize (記事生成) を発火させる
    // 非同期で実行されるため、レスポンスを待たずにすぐに終了する
    const triggerMonetize = await fetch(`${API_SERVER_URL}/api/monetize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Antigravity-Key': process.env.ANTIGRAVITY_API_KEY || 'local-dev-key'
      }
    });

    if (!triggerMonetize.ok) {
      throw new Error(`Failed to trigger API: ${triggerMonetize.statusText}`);
    }

    return NextResponse.json({ success: true, message: 'Monetization loop triggered successfully' });
  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
