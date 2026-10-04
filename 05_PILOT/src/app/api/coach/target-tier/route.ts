// 05移植(2026-10-04): 旧ポータルから移植。認証は 05 の proxy.ts が担う。Riot ID は画面から渡す（lib/riotIdParam.ts）。
import { NextResponse } from 'next/server';
import { supabase as supabaseClient } from '@/lib/supabaseClient';
const supabase = supabaseClient!;
import {
  TARGET_TIER_KEY,
  DEFAULT_TARGET_TIER,
  getTargetTier,
  normalizeTargetTier,
} from '@/lib/coachSettings';

// コーチング用の「目標ランク」の取得・更新（2026-09-30新設）。
// 実装と経緯は lib/coachSettings.ts の冒頭コメント参照。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const targetTier = await getTargetTier();
  return NextResponse.json({ targetTier, isDefault: targetTier === DEFAULT_TARGET_TIER });
}

export async function POST(req: Request) {
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
