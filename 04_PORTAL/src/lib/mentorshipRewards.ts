// 師弟コースのコイン報酬の条件判定（2026-10-19）。
// 成立ボーナス（+300）・卒業ボーナス（+200）は、成立 → 卒業/解散 → 再成立 を繰り返すだけで何度でも受け取れた
// （同意の要らない「弟子カードの引き受け」と組み合わせると、1人で回せた）。コインの総量は約15,000枚。
import { supabaseAdmin as supabase } from './supabaseAdmin';

/** 卒業ボーナスを渡すのに必要な、成立からの最短日数 */
export const MIN_DAYS_FOR_GRADUATION_BONUS = 7;

/** この師匠と弟子の組み合わせで、これまでに成立したペア（このマッチ以外）が無いか。成立ボーナスは組み合わせごとに1回 */
export async function isFirstPairing(mentorDiscordId: string | null, pupilDiscordId: string | null, excludeMatchId?: string | number | null): Promise<boolean> {
  if (!mentorDiscordId || !pupilDiscordId) return false;
  let q = supabase
    .from('mentorship_matches')
    .select('id', { count: 'exact', head: true })
    .eq('mentor_discord_id', mentorDiscordId)
    .eq('pupil_discord_id', pupilDiscordId)
    .not('started_at', 'is', null);
  if (excludeMatchId !== undefined && excludeMatchId !== null) q = q.neq('id', excludeMatchId);
  const { count, error } = await q;
  if (error) {
    console.warn('[mentorshipRewards] 過去ペアの確認に失敗（ボーナスは渡さない）:', error.message);
    return false;
  }
  return (count || 0) === 0;
}

/** 成立から卒業ボーナスの対象になる日数が経っているか */
export function isGraduationBonusEligible(startedAt: string | null | undefined): boolean {
  if (!startedAt) return false;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  return elapsed >= MIN_DAYS_FOR_GRADUATION_BONUS * 24 * 60 * 60 * 1000;
}
