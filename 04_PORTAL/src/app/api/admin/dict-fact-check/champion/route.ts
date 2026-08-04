import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { runFactCheckForChampion } from '../../../../../lib/dictFactCheck';

// チャンピオン辞典ページから、そのチャンピオン1体だけを即時ファクトチェックする。
// 全体一斉チェック(Step2)は170体前後を回すため数分かかるが、1体だけならページ内で
// その場で完結させたい、というニーズに対応する。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const champion = String(body.champion || '').trim();
    if (!champion) return NextResponse.json({ error: 'championを指定してください。' }, { status: 400 });

    const result = await runFactCheckForChampion(supabase, champion);
    return NextResponse.json({ success: true, flagged: result.flagged, capped: result.capped });
  } catch (err: any) {
    console.error('[dict-fact-check/champion] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
