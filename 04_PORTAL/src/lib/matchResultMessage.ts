// Discord の試合結果メッセージ（「⚔️ 試合リザルト」）の対戦表フィールド。
// 試合記録（/api/match/record）と試合の編集（/api/admin/match/[id]）で同じ書き方にするため 2026-10-17 に切り出した。

export interface ResultMessageRow {
  name: string;
  team: string;
  role: string;
  champion_name?: string | null;
  kills: number;
  deaths: number;
  assists: number;
  mmrDelta: number;
  hasVictoryDoubler?: boolean;
}

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;
const ICONS: Record<string, string> = { TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨' };

/** 結果メッセージの Embed の色（勝った側の色） */
export const resultEmbedColor = (winningTeam: string) => (winningTeam === 'BLUE' ? 3447003 : 15158332);

/** 「🏆 🟦 BLUE TEAM (WIN) 🆚 💀 🟥 RED TEAM」形式の対戦表フィールド */
export function buildMatchupField(rows: ResultMessageRow[], winningTeam: string, isExhibition: boolean) {
  const formatPlayer = (p: ResultMessageRow) => {
    const delta = isExhibition ? `±0 (お祭り保護)` : (p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`);
    const kda = `${p.kills}/${p.deaths}/${p.assists}`;
    const champ = p.champion_name ? p.champion_name : 'Unknown';
    const coinsEarned = p.hasVictoryDoubler
      ? '🔥+600🪙(激闘ボーナス!)'
      : (p.team === winningTeam ? '+250🪙' : '+100🪙');
    return `\`${p.name}\` (${champ}) - **${kda}** (MMR: ${delta} | ${coinsEarned})`;
  };
  const value = ROLES.map((role) => {
    const pb = rows.find((p) => p.team === 'BLUE' && p.role === role);
    const pr = rows.find((p) => p.team === 'RED' && p.role === role);
    return `${ICONS[role]} **${role}**: ${pb ? formatPlayer(pb) : '-'} 🆚 ${pr ? formatPlayer(pr) : '-'}`;
  }).join('\n\n');
  const blueTitle = winningTeam === 'BLUE' ? '🏆 🟦 BLUE TEAM (WIN)' : '💀 🟦 BLUE TEAM';
  const redTitle = winningTeam === 'RED' ? '🏆 🟥 RED TEAM (WIN)' : '💀 🟥 RED TEAM';
  return { name: `${blueTitle}  🆚  ${redTitle}`, value, inline: false };
}

/** 対戦表フィールドかどうか（名前で判定。号外・配当結果のフィールドと区別する） */
export const isMatchupField = (f: { name?: string }) => /BLUE TEAM.*🆚.*RED TEAM/.test(String(f?.name || ''));
