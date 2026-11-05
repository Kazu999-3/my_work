import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 師弟中間チェックイン（成長カルテ）API
 * ※ 2026-11-05: 師匠・弟子の負担軽減および活動実態に合わせて撤廃
 */
export async function GET() {
  return NextResponse.json({ ok: false, error: '中間チェックイン機能は終了しました。' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: '中間チェックイン機能は終了しました。' }, { status: 410 });
}
