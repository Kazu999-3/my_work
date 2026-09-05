// 共通のロール正規化ユーティリティ
// Riot API, LCU, DB (ktm_match_participants) での様々なロール表記揺れを
// 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' の5つに統一する。

export type StandardRole = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';

export function normalizeRole(rawRole: string | null | undefined): StandardRole | null {
  if (!rawRole) return null;
  const r = String(rawRole).trim().toUpperCase();

  if (r === 'TOP' || r === 'TOP_LANE') return 'TOP';
  if (r === 'JG' || r === 'JUG' || r === 'JUNGLE' || r === 'JUNGLER') return 'JG';
  if (r === 'MID' || r === 'MIDDLE' || r === 'MID_LANE') return 'MID';
  if (r === 'ADC' || r === 'BOT' || r === 'BOTTOM' || r === 'DUO_CARRY' || r === 'CARRY') return 'ADC';
  if (r === 'SUP' || r === 'SUPPORT' || r === 'UTILITY' || r === 'DUO_SUPPORT') return 'SUP';

  return null;
}

export function normalizeRoleCapitalized(rawRole: string | null | undefined): 'Top' | 'Jg' | 'Mid' | 'Adc' | 'Sup' | 'Unknown' {
  const norm = normalizeRole(rawRole);
  if (!norm) return 'Unknown';
  switch (norm) {
    case 'TOP': return 'Top';
    case 'JG': return 'Jg';
    case 'MID': return 'Mid';
    case 'ADC': return 'Adc';
    case 'SUP': return 'Sup';
  }
}
