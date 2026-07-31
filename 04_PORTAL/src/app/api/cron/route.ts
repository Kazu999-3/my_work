import { NextResponse } from 'next/server';

export const maxDuration = 30; // 30秒でタイムアウト

export async function GET(request: Request) {
  // RenderにデプロイしたAntigravity APIのURL
  // （本番環境では環境変数 process.env.API_SERVER_URL にする）
  const API_SERVER_URL = process.env.API_SERVER_URL || 'https://antigravity-api-nzo3.onrender.com';
  
  // 認証キー（Cronからのリクエストであることを証明する）
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelCron = userAgent.includes('vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET 設定時は Bearer または Vercel Cron ヘッダーを検証。
  // 以前は ?test=true を付けるだけでこのチェック自体を丸ごとスキップできてしまっていた
  // （!isTest && ... という条件式のため、isTestがtrueだと式全体がfalseになり401を返さなかった）。
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
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

    // 以下、ナレッジ整備系のfire-and-forget呼び出し。
    // 2026-07-31発覚: これまでAuthorizationヘッダーを一切付けずに叩いていたため、
    // 呼び出し先が要求するCRON_SECRET/管理者セッション認証に全て401で弾かれ、
    // 「自動発火した」と表示されつつ実際には10日以上何も実行されていなかった。
    // 各ルート側もCRON_SECRET Bearerを受け付けるよう修正した上で、ここで正しく付与する。
    const origin = new URL(request.url).origin;
    const cronHeaders = {
      'Content-Type': 'application/json',
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    };

    // 2. ナレッジ自動整備（未整理記事をチャンピオン辞典へマージ）
    fetch(`${origin}/api/admin/knowledge/sync`, {
      method: 'POST',
      headers: cronHeaders,
      body: JSON.stringify({ auto: true })
    }).catch(e => console.warn('Knowledge sync trigger warning:', e));

    // 3. レーンガイド自動マージ
    fetch(`${origin}/api/admin/lane-guides`, {
      method: 'POST',
      headers: cronHeaders,
      body: JSON.stringify({ auto: true })
    }).catch(e => console.warn('Lane guide trigger warning:', e));

    // 4. 既存データの英語→日本語 自動変換（辞典本体・攻略ライブラリ・対面メモ/ノート）。
    // 以前は/admin/knowledgeの「データ整備」タブを開いてボタンを押さない限り動かなかった。
    for (const target of ['facts', 'articles', 'memos']) {
      fetch(`${origin}/api/admin/translate-jp`, {
        method: 'POST',
        headers: cronHeaders,
        body: JSON.stringify({ target })
      }).catch(e => console.warn(`Translate-jp(${target}) trigger warning:`, e));
    }

    return NextResponse.json({ success: true, message: '全自動バックグラウンドメンテナンス（データ整備・日本語化・マネタイズ）を正常発火しました' });
  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
