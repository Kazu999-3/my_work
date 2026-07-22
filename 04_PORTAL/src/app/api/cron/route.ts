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
    // 1. レンダリングサーバーへの発火
    fetch(`${API_SERVER_URL}/api/monetize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Antigravity-Key': process.env.ANTIGRAVITY_API_KEY || 'local-dev-key'
      }
    }).catch(e => console.warn('Monetize trigger warning:', e));

    // 2. ナレッジ自動整備（未整理記事をチャンピオン辞典へマージ）
    const origin = new URL(request.url).origin;
    fetch(`${origin}/api/admin/knowledge/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto: true })
    }).catch(e => console.warn('Knowledge sync trigger warning:', e));

    // 3. レーンガイド自動マージ
    fetch(`${origin}/api/admin/lane-guides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto: true })
    }).catch(e => console.warn('Lane guide trigger warning:', e));

    return NextResponse.json({ success: true, message: '全自動バックグラウンドメンテナンス（データ整備・鮮度レビュー・マネタイズ）を正常発火しました' });
  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
