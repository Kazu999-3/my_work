import { supabaseAdmin as supabase } from './supabaseAdmin';
import { syncMentorshipDashboard } from './discordMentorship';

const GRACE_PERIOD_DAYS = 7;
let lastCheckTime = 0;
const THROTTLE_MS = 60 * 1000; // 1分間に1回以上の重複チェックを抑止

function parseDurationDays(notes: string | null): number {
  if (!notes) return 30;
  try {
    if (notes.startsWith('{') && notes.endsWith('}')) {
      const parsed = JSON.parse(notes);
      if (typeof parsed.durationDays === 'number') return parsed.durationDays;
    }
  } catch (_) {}

  const durMatch = notes.match(/\[DURATION:([^\]]+)\]/);
  if (durMatch) {
    if (durMatch[1] === '14_DAYS') return 14;
    if (durMatch[1] === '60_DAYS') return 60;
    return 30;
  }
  return 30;
}

function appendCancelReason(notes: string | null, reason: string): string {
  try {
    if (notes && notes.startsWith('{') && notes.endsWith('}')) {
      const parsed = JSON.parse(notes);
      parsed.cancelReason = reason;
      parsed.autoDisbanded = true;
      parsed.autoDisbandedAt = new Date().toISOString();
      return JSON.stringify(parsed);
    }
  } catch (_) {}

  return JSON.stringify({
    cancelReason: reason,
    autoDisbanded: true,
    autoDisbandedAt: new Date().toISOString(),
    rawNotes: notes || '',
  });
}

/**
 * 期間満了後、7日間の猶予期間を過ぎても延長されなかった師弟ペアを
 * 自動的に円満解散（CANCELLED）とし、相談枠とプロフィールを解放する。
 */
export async function autoCloseExpiredMentorshipMatches(force = false): Promise<{
  checked: boolean;
  closedCount: number;
  closedIds: string[];
}> {
  const now = Date.now();
  if (!force && now - lastCheckTime < THROTTLE_MS) {
    return { checked: false, closedCount: 0, closedIds: [] };
  }
  lastCheckTime = now;

  try {
    const { data: activeMatches, error } = await supabase
      .from('mentorship_matches')
      .select('id, mentor_profile_id, pupil_profile_id, started_at, notes')
      .eq('status', 'ACTIVE');

    if (error || !activeMatches || activeMatches.length === 0) {
      return { checked: true, closedCount: 0, closedIds: [] };
    }

    const nowDate = new Date(now);
    const expiredToClose: {
      match: typeof activeMatches[0];
      newNotes: string;
      profileIds: string[];
    }[] = [];

    for (const m of activeMatches) {
      const durationDays = parseDurationDays(m.notes);
      const started = m.started_at ? new Date(m.started_at) : nowDate;
      const expiresAt = new Date(started.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const gracePeriodEnd = new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      // 猶予期間（満了日 + 7日）を超過しているか判定
      if (nowDate.getTime() > gracePeriodEnd.getTime()) {
        const newNotes = appendCancelReason(m.notes, '🗓️ 期間満了（未延長による自動解散）');
        const profileIds: string[] = [];
        if (m.mentor_profile_id) profileIds.push(m.mentor_profile_id);
        if (m.pupil_profile_id) profileIds.push(m.pupil_profile_id);

        expiredToClose.push({
          match: m,
          newNotes,
          profileIds,
        });
      }
    }

    if (expiredToClose.length === 0) {
      return { checked: true, closedCount: 0, closedIds: [] };
    }

    const closedIds: string[] = [];
    const allProfileIdsToOpen = new Set<string>();

    for (const item of expiredToClose) {
      const { error: updateErr } = await supabase
        .from('mentorship_matches')
        .update({
          status: 'CANCELLED',
          completed_at: nowDate.toISOString(),
          notes: item.newNotes,
        })
        .eq('id', item.match.id)
        .eq('status', 'ACTIVE'); // 競合防止

      if (!updateErr) {
        closedIds.push(item.match.id);
        item.profileIds.forEach((id) => allProfileIdsToOpen.add(id));
      }
    }

    // 解散された参加者のプロフィールステータスを OPEN に復帰
    if (allProfileIdsToOpen.size > 0) {
      await supabase
        .from('mentorship_profiles')
        .update({ status: 'OPEN' })
        .in('id', Array.from(allProfileIdsToOpen));
    }

    // Discord掲示板のピン留めダッシュボードを非同期更新
    if (closedIds.length > 0) {
      syncMentorshipDashboard().catch(() => {});
      console.log(`[mentorshipAutoClose] Auto-disbanded ${closedIds.length} expired matches:`, closedIds);
    }

    return { checked: true, closedCount: closedIds.length, closedIds };
  } catch (err) {
    console.error('[mentorshipAutoClose] Error in autoCloseExpiredMentorshipMatches:', err);
    return { checked: false, closedCount: 0, closedIds: [] };
  }
}
