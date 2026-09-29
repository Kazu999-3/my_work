import { NextRequest, NextResponse } from 'next/server';
import { executeLotteryDraw } from '../../../../lib/lotteryEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // ⚠️ 2026-09-29 セキュリティ修正:
  // 以前は認証が3通りあり、いずれも実質的に無防備だった。
  //   ① 合言葉の既定値が `'ktm_admin_secret'` でハードコードされていた。`ADMIN_SECRET_KEY` は
  //      Vercelに未登録だったため**この既定値が本番で有効**で、かつこのリポジトリは公開されている。
  //      つまり誰でも `?key=ktm_admin_secret` で抽選を実行できた（executeLotteryDraw はコインを払い出す）。
  //   ② User-Agent に `vercel-cron` が含まれるだけで通していた。ヘッダは誰でも偽装できる。
  // 現在は CRON_SECRET の Bearer のみを正とする。Vercel は CRON_SECRET が設定されていれば
  // Cron 実行時に自動でこのヘッダを付けるため、`vercel.json` の定期実行はそのまま動く。
  // 手動実行が必要な場合は ADMIN_SECRET_KEY を明示的に設定した上で ?key= を使う（既定値は持たせない）。
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  const isDev = process.env.NODE_ENV === 'development';

  const bearerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!bearerOk && !isDev) {
    const key = new URL(request.url).searchParams.get('key');
    // adminSecret が未設定なら ?key= 経路そのものを閉じる（フォールバックを持たせない）
    const keyOk = !!adminSecret && !!key && key === adminSecret;
    if (!keyOk) {
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
