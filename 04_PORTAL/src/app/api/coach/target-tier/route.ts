import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import {
  TARGET_TIER_KEY,
  DEFAULT_TARGET_TIER,
  getTargetTier,
  normalizeTargetTier,
} from '../../../../lib/coachSettings';

// コーチング用の「目標ランク」の取得・更新（2026-09-30新設）。
// 実装と経緯は lib/coachSettings.ts の冒頭コメント参照。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const targetTier = await getTargetTier();
  return NextResponse.json({ targetTier, isDefault: targetTier === DEFAULT_TARGET_TIER });
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = normalizeTargetTier(String(body?.targetTier || ''));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { error } = await supabase
      .from('ktm_settings')
      .upsert(
        { key: TARGET_TIER_KEY, value: parsed.value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    if (error) throw error;

    return NextResponse.json({ targetTier: parsed.value });
  } catch (err: any) {
    console.error('[coach/target-tier] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
