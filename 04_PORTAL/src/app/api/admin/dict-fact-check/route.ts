import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { scanInvalidChampionTags, runFactCheckBatch } from '../../../../lib/dictFactCheck';

// 辞典/コーチAI知識層/ナレッジの一斉ファクトチェック(#②精度向上)。
// mode='scan_tags': champion列の表記揺れ・ゴミ値検出（LLM不要・即時）
// mode='batch'    : チャンピオン単位で全ソースを横断照合するAI判定（チャンク処理）
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'batch';

    if (mode === 'scan_tags') {
      const inserted = await scanInvalidChampionTags(supabase);
      return NextResponse.json({ mode: 'scan_tags', inserted });
    }

    if (mode === 'batch') {
      const offset = Number.isFinite(body?.offset) ? Number(body.offset) : 0;
      const limit = 5; // チャンピオン単位で1回あたり5体（Gemini呼び出し5件/回、Vercelタイムアウト回避）
      const result = await runFactCheckBatch(supabase, offset, limit);
      return NextResponse.json({ mode: 'batch', ...result });
    }

    return NextResponse.json({ error: `不明なmode: ${mode}` }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-fact-check] error:', err);
    return NextResponse.json({ error: err.message || '処理に失敗しました。' }, { status: 500 });
  }
}
