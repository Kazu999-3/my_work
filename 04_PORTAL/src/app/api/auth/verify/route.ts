import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminSession';

// Cookie(HttpOnly)ベースの検証に統一。クライアントからsessionKeyを渡す必要はない
// （fetchが`credentials: 'include'`でCookieを同送していれば自動的に検証される）。
export async function POST(req: Request) {
  const result = await verifyAdminSession(req);
  if (result.ok) {
    return NextResponse.json({ valid: true });
  }
  return NextResponse.json({ valid: false, error: result.error }, { status: 401 });
}
