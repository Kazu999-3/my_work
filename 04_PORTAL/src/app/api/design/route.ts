import { NextResponse } from 'next/server';
import { systemDesignDocs } from '../../design/systemDesignMarkdown';

export async function GET() {
  try {
    // サーバーレス環境でのディスクI/Oやパス解決のトラブルを避けるため、
    // ビルド時に確実に結合・パース済みの静的辞書オブジェクトを即時返却する
    return NextResponse.json({ docs: systemDesignDocs });
  } catch (err: any) {
    console.error('❌ [Design GET API] Failed:', err);
    return NextResponse.json({ docs: {} });
  }
}
