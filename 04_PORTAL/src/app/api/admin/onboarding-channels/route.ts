import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { syncOnboardingChannels } from '../../../../lib/onboardingChannels';

// 管理画面「個別案内」タブの一覧。開いた時点の最新状態に更新してから返す（2026-10-17）。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  try {
    const { channels } = await syncOnboardingChannels();
    const ownerIds = channels.map((c) => c.ownerUserId);

    const { data: players } = ownerIds.length
      ? await supabase.from('ktm_players').select('name,discord_id').in('discord_id', ownerIds)
      : { data: [] as any[] };
    const nameOf = new Map((players || []).map((p: any) => [p.discord_id, p.name]));

    // 最後に試合へ出た日（送り先の絞り込み用）
    const { data: parts } = ownerIds.length
      ? await supabase.from('ktm_match_participants').select('discord_id,created_at').in('discord_id', ownerIds).order('created_at', { ascending: false })
      : { data: [] as any[] };
    const lastPlayed = new Map<string, string>();
    for (const p of parts || []) if (p.discord_id && !lastPlayed.has(p.discord_id)) lastPlayed.set(p.discord_id, p.created_at);

    const rows = channels.map((c) => ({
      ...c,
      playerName: nameOf.get(c.ownerUserId) || null,
      lastPlayedAt: lastPlayed.get(c.ownerUserId) || null,
    }));
    return NextResponse.json({ success: true, channels: rows });
  } catch (err: any) {
    console.error('[admin/onboarding-channels] error:', err);
    return NextResponse.json({ error: '個別案内チャンネルの取得に失敗しました。' }, { status: 500 });
  }
}
