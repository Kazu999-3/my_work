import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';
import { syncOnboardingChannels } from '../../../../lib/onboardingChannels';
import { loadNextPeriodicCustomEntries } from '../../../../lib/periodicCustomCard';

// 管理画面「個別案内」タブの一覧。開いた時点の最新状態に更新してから返す（2026-10-17）。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  try {
    const { channels } = await syncOnboardingChannels();
    const ownerIds = channels.map((c) => c.ownerUserId);

    const { data: players } = ownerIds.length
      ? await supabase.from('ktm_players').select('name,discord_id,created_at,metadata').in('discord_id', ownerIds)
      : { data: [] as any[] };
    const nameOf = new Map((players || []).map((p: any) => [p.discord_id, p.name]));
    // 名簿に入った日（自己紹介の取り込み時の joined_at、無ければ行の作成日）。「未出場の新しい人」の絞り込み用（2026-10-20）
    const joinedOf = new Map((players || []).map((p: any) => [p.discord_id, p.metadata?.joined_at || p.created_at || null]));

    // 最後に試合へ出た日（送り先の絞り込み用）
    // 出場記録は1,000件を超えている（2026-10-19 時点で1,305件）ため分けて読む。以前は新しい1,000件だけで、
    // 古い試合にしか出ていない人の「最後の試合」が空になっていた
    const { data: parts } = ownerIds.length
      ? await fetchAllRows((from, to) =>
          supabase.from('ktm_match_participants').select('discord_id,created_at,match_id').in('discord_id', ownerIds)
            .order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to))
      : { data: [] as any[] };
    const lastPlayed = new Map<string, string>();
    // 出場回数（「来なくなった常連」の絞り込み用。2026-10-20）
    const playCount = new Map<string, number>();
    // 出場した夜の数と最初の夜（「初参加して2回目がまだの人」の絞り込み用。2026-10-20）。
    // 1晩に何試合出ても1回と数える。日時は試合側を使い（出場記録の日時は試合を直すと変わる）、
    // 0時をまたぐカスタムを2晩と数えないよう朝6時までは前日の夜として扱う（運営タブと同じ数え方）
    const { data: matches } = await fetchAllRows((from, to) =>
      supabase.from('ktm_matches').select('id,created_at').order('id').range(from, to));
    const matchAt = new Map((matches || []).map((m: any) => [m.id, new Date(m.created_at).getTime()]));
    const nights = new Map<string, Set<string>>();
    const firstPlayed = new Map<string, number>();
    for (const p of parts || []) {
      if (!p.discord_id) continue;
      if (!lastPlayed.has(p.discord_id)) lastPlayed.set(p.discord_id, p.created_at);
      playCount.set(p.discord_id, (playCount.get(p.discord_id) || 0) + 1);
      const at = matchAt.get(p.match_id);
      if (at === undefined) continue;
      const night = new Date(at + 9 * 3600e3 - 6 * 3600e3).toISOString().slice(0, 10);
      const set = nights.get(p.discord_id) || new Set<string>();
      set.add(night);
      nights.set(p.discord_id, set);
      if (!firstPlayed.has(p.discord_id) || at < (firstPlayed.get(p.discord_id) as number)) firstPlayed.set(p.discord_id, at);
    }

    const rows = channels.map((c) => ({
      ...c,
      playerName: nameOf.get(c.ownerUserId) || null,
      lastPlayedAt: lastPlayed.get(c.ownerUserId) || null,
      joinedAt: joinedOf.get(c.ownerUserId) || null,
      playCount: playCount.get(c.ownerUserId) || 0,
      playNights: nights.get(c.ownerUserId)?.size || 0,
      firstPlayedAt: firstPlayed.has(c.ownerUserId) ? new Date(firstPlayed.get(c.ownerUserId) as number).toISOString() : null,
    }));
    // 次の定期カスタムのエントリー者・観戦希望（フィルタ用）。読めなくても一覧は返す
    const nextCustom = await loadNextPeriodicCustomEntries().catch((e) => {
      console.warn('[admin/onboarding-channels] 次の定期カスタムの読み込みに失敗:', e);
      return null;
    });
    return NextResponse.json({ success: true, channels: rows, nextCustom });
  } catch (err: any) {
    console.error('[admin/onboarding-channels] error:', err);
    return NextResponse.json({ error: '個別案内チャンネルの取得に失敗しました。' }, { status: 500 });
  }
}
