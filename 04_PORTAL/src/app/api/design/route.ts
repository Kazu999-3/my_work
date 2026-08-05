import { NextResponse } from 'next/server';
import { systemDesignDocs } from '../../design/systemDesignMarkdown';
import { verifyAdminSession } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  // 内部システム設計書は管理者専用。保存側(/api/admin/design)は既に保護されているが、
  // 閲覧専用のこちらには認証チェックが無く無認証で読めていた(2026-08-05発覚)。
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    // サーバーレス環境でのディスクI/Oやパス解決のトラブルを避けるため、
    // ビルド時に確実に結合・パース済みの静的辞書オブジェクトを即時返却する
    return NextResponse.json({ docs: systemDesignDocs });
  } catch (err: any) {
    console.error('❌ [Design GET API] Failed:', err);
    return NextResponse.json({ docs: {} });
  }
}
