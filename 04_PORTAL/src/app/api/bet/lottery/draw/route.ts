import { NextRequest, NextResponse } from 'next/server';
import { executeLotteryDraw } from '../../../../../lib/lotteryEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const result = await executeLotteryDraw();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[lottery/draw] Error:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
