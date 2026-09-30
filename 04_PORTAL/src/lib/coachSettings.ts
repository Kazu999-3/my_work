import { supabaseAdmin as supabase } from './supabaseAdmin';

// ============================================================
// コーチング用の設定（2026-09-30新設）
//
// 目標ランク(targetTier)は 'Emerald IV' がコード内に決め打ちされており
// (SoloQDeepIntelSyncCard が毎回送っていた)、昇格しても目標が動かないまま
// AIへの指示文に固定の目標が入り続けていた。
// 既存の汎用設定テーブル ktm_settings に保存して変更できるようにする。
// ============================================================

export const TARGET_TIER_KEY = 'coach_target_tier';
export const DEFAULT_TARGET_TIER = 'Emerald IV';

export const VALID_TIERS = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
];
export const VALID_DIVISIONS = ['I', 'II', 'III', 'IV'];

/** MASTER以上はディビジョンを持たない */
export function tierNeedsDivision(tier: string): boolean {
  return !['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase());
}

/** 保存済みの目標ランクを返す（未設定・失敗時は既定値）。 */
export async function getTargetTier(): Promise<string> {
  try {
    const { data } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', TARGET_TIER_KEY)
      .maybeSingle();
    const v = (data as any)?.value;
    // ktm_settings.value は jsonb。文字列で入っている場合と {tier: "..."} の場合を許容する。
    const raw = typeof v === 'string' ? v : v?.tier;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_TARGET_TIER;
  } catch {
    return DEFAULT_TARGET_TIER;
  }
}

/** 入力を "EMERALD IV" / "MASTER" 形式へ正規化する。不正な場合は理由を返す。 */
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
