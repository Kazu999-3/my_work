import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getExpectedToken, setAuthCookie } from '@/lib/tokenAuth';
import { clientIp, isLoginBlocked, recordLoginFailure } from '@/lib/loginRateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!getExpectedToken()) {
    return NextResponse.json(
      { error: 'サーバーに PILOT_SECRET_TOKEN が設定されていないか、安全でない値です。Vercelの環境変数を設定してください。' },
      { status: 503 },
    );
  }

  // 1. レート制限チェック（SPEC 02: フェイルクローズ準拠）
  const ip = clientIp(req.headers);
  const rateLimit = await isLoginBlocked(ip);

  // 制限基盤（DB）に障害がある場合は無制限に通さず 503 で安全に止める
  if (rateLimit.unavailable) {
    return NextResponse.json(
      { error: '認証基盤が一時的に利用できません。時間をおいて再試行してください。' },
      { status: 503 },
    );
  }

  // 試行回数上限（15分間に10回）到達時
  if (rateLimit.blocked) {
    return NextResponse.json(
      { error: '試行回数が多すぎます。15分ほど待ってから再試行してください。' },
      { status: 429 },
    );
  }

  // 2. 合言葉の検証
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || '');

  if (!verifyToken(token)) {
    await recordLoginFailure(ip);
    // 総当たりを遅らせる
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: '合言葉が違います。' }, { status: 401 });
  }

  // 3. 認証成功: Cookieには合言葉そのものではなくランダムな署名付きセッションIDを発行する
  const res = NextResponse.json({ success: true });
  const sessionInfo = setAuthCookie(res);

  if (!sessionInfo) {
    return NextResponse.json(
      { error: 'セッションCookieの発行に失敗しました。サーバー設定を確認してください。' },
      { status: 500 },
    );
  }

  return res;
}
