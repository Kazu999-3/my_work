import { supabase } from './supabaseClient';

export const TARGET_TIER_KEY = 'coach_target_tier';
export const DEFAULT_TARGET_TIER = 'Emerald IV';

export const VALID_TIERS = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
];
export const VALID_DIVISIONS = ['I', 'II', 'III', 'IV'];

export function tierNeedsDivision(tier: string): boolean {
  return !['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase());
}

export async function getTargetTier(): Promise<string> {
  if (!supabase) return DEFAULT_TARGET_TIER;
  try {
    const { data } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', TARGET_TIER_KEY)
      .maybeSingle();
    const v = (data as any)?.value;
    const raw = typeof v === 'string' ? v : v?.tier;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_TARGET_TIER;
  } catch {
    return DEFAULT_TARGET_TIER;
  }
}

export function normalizeTargetTier(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const parts = String(raw || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  const tier = parts[0];
  const division = parts[1];
  if (!tier || !VALID_TIERS.includes(tier)) {
    return { ok: false, error: `ティア名が不正です（${VALID_TIERS.join(' / ')}）。` };
  }
  if (tierNeedsDivision(tier)) {
    if (!division || !VALID_DIVISIONS.includes(division)) {
      return { ok: false, error: 'ディビジョン（I〜IV）も指定してください。' };
    }
    return { ok: true, value: `${tier} ${division}` };
  }
  return { ok: true, value: tier };
}
