import { NextResponse } from 'next/server';
import { getCoachTargets, saveRoleTargets, sanitizeRoleTargets, TARGET_ROLES, type TargetRole } from '@/lib/coachTargets';
import { getTargetTier } from '@/lib/coachSettings';

// 試合後タブ「目標との比較」のロール別目標値（自分で決めた値）の取得・保存。2026-10-06
// 認証は 05 の proxy.ts が担う。
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [targets, targetTier] = await Promise.all([getCoachTargets(), getTargetTier()]);
    return NextResponse.json({ targets, targetTier });
  } catch (e: any) {
    console.error('[coach/targets GET]', e);
    return NextResponse.json({ error: e.message || '目標値の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = String(body?.role || '').toUpperCase() as TargetRole;
    if (!TARGET_ROLES.includes(role)) {
      return NextResponse.json({ error: `ロールが不正です（${TARGET_ROLES.join(' / ')}）` }, { status: 400 });
    }
    const targets = await saveRoleTargets(role, sanitizeRoleTargets(body?.values));
    return NextResponse.json({ targets });
  } catch (e: any) {
    console.error('[coach/targets POST]', e);
    return NextResponse.json({ error: e.message || '目標値の保存に失敗しました' }, { status: 500 });
  }
}
