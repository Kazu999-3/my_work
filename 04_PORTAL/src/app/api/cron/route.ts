import { NextResponse } from 'next/server';

export const maxDuration = 30; // 30秒でタイムアウト

export async function GET(request: Request) {
  // RenderにデプロイしたAntigravity APIのURL
  // （本番環境では環境変数 process.env.API_SERVER_URL にする）
  const API_SERVER_URL = process.env.API_SERVER_URL || 'https://antigravity-api-nzo3.onrender.com';
  
  // 認証キー（Cronからのリクエストであることを証明する）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 2026-08-05: `cronSecret &&` の短絡でCRON_SECRET未設定時にチェックが丸ごと
  // 無効化(fail-open)される問題を修正済み。
  // 2026-09-29: さらに User-Agent に `vercel-cron` が含まれるだけで通す経路を撤去した。
  // ヘッダは誰でも偽装できるため認証として機能しておらず、外部から連打されると
  // Gemini日次クォータを消費し尽くすリスクが残っていた。
  // Vercel は CRON_SECRET が設定されていれば Cron 実行時に自動で Bearer を付けるため、
  // `vercel.json` の定期実行はそのまま動く（CRON_SECRET は本番・previewに設定済み）。
  const bearerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!bearerOk) {
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

    // fire-and-forgetの各呼び出しは.catch()のみでレスポンスの.okを見ていなかったため、
    // 呼び出し先が401/500等のHTTPエラーを返しても(fetch自体は例外を投げない)一切気づけない
    // 構造が残っていた(2026-08-05発覚)。まさにこのファイルが原因で「10日以上何も実行
    // されていなかった」既往障害の根本原因(結果を検証しない設計)。.okを確認しログに残す
    // ヘルパーに統一する。
    const fireAndForget = (label: string, url: string, init: RequestInit) => {
      fetch(url, init)
        .then((res) => { if (!res.ok) console.warn(`${label} failed: ${res.status}`); })
        .catch((e) => console.warn(`${label} trigger warning:`, e));
    };

    // 2. ナレッジ自動整備（未整理記事をチャンピオン辞典へマージ）
    fireAndForget('Knowledge sync', `${origin}/api/admin/knowledge/sync`, {
      method: 'POST',
      headers: cronHeaders,
      body: JSON.stringify({ auto: true })
    });

    // 3. レーンガイド自動マージ
    fireAndForget('Lane guide', `${origin}/api/admin/lane-guides`, {
      method: 'POST',
      headers: cronHeaders,
      body: JSON.stringify({ auto: true })
    });

    // 4. 既存データの英語→日本語 自動変換（辞典本体・攻略ライブラリ・対面メモ/ノート）。
    // 以前は/admin/knowledgeの「データ整備」タブを開いてボタンを押さない限り動かなかった。
    for (const target of ['facts', 'articles', 'memos']) {
      fireAndForget(`Translate-jp(${target})`, `${origin}/api/admin/translate-jp`, {
        method: 'POST',
        headers: cronHeaders,
        body: JSON.stringify({ target })
      });
    }

    // 5. champion_facts をmatchup_sentinelへ追従させる構造化バックフィル。
    fireAndForget('Dict-migrate', `${origin}/api/admin/dict-migrate`, {
      method: 'GET',
      headers: cronHeaders,
    });

    // 6. パッチ更新検知 ＆ SSOT鮮度マーク (dict-auto-refresh)
    fireAndForget('Dict-auto-refresh', `${origin}/api/cron/dict-auto-refresh`, {
      method: 'GET',
      headers: cronHeaders,
    });

    return NextResponse.json({ success: true, message: '全自動バックグラウンドメンテナンス（データ整備・日本語化）を正常発火しました' });
  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
