/**
 * 師弟マッチング共通定数
 */
export const MENTORSHIP_DURATIONS: Record<string, { label: string; days: number }> = {
  '1_DAY': { label: '⚡ スポット1回指導（1日）', days: 1 },
  '7_DAYS': { label: '⏱️ 1週間集中コース（7日）', days: 7 },
  '14_DAYS': { label: '🔥 2週間育成コース（14日・推奨）', days: 14 },
  '30_DAYS': { label: '🏆 1ヶ月ガチ特訓コース（30日）', days: 30 },
  'INDEFINITE': { label: '♾️ 目標達成まで（期限なし）', days: 90 },
};
