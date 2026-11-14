import { MatchRecordBody } from './types';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * 試合記録APIの入力パラメータ検証（エッジケース・異常値ガード）
 */
export function validateMatchRecordInput(body: any): ValidationResult {
  const { winningTeam, gameDuration, participants } = body || {};

  if (!winningTeam || !participants || !Array.isArray(participants) || participants.length !== 10) {
    return { ok: false, error: '入力データが不正です。10人の参加者と勝利チームが必要です。' };
  }

  if (winningTeam !== 'BLUE' && winningTeam !== 'RED') {
    return { ok: false, error: 'winningTeamはBLUEかREDのいずれかを指定してください。' };
  }

  const names = participants.map((p: any) => p?.name);
  if (new Set(names).size !== 10) {
    return { ok: false, error: '10人の参加者名が重複しています。' };
  }

  for (const p of participants) {
    if (p.team !== 'BLUE' && p.team !== 'RED') {
      return { ok: false, error: `不正なteam値です: ${p.name}` };
    }
    if (!['TOP', 'JG', 'MID', 'ADC', 'SUP'].includes(p.role)) {
      return { ok: false, error: `不正なrole値です: ${p.name}` };
    }
    for (const key of ['kills', 'deaths', 'assists'] as const) {
      const v = Number(p[key]);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        return { ok: false, error: `${p.name}の${key}が不正な値です。` };
      }
    }
    if (p.penta_kills !== undefined && p.penta_kills !== null) {
      const v = Number(p.penta_kills);
      if (!Number.isInteger(v) || v < 0 || v > 5) {
        return { ok: false, error: `${p.name}のペンタキル数が不正な値です（0〜5）。` };
      }
    }
  }

  // 各チーム5ロールが重複なく揃っているかの検証
  for (const team of ['BLUE', 'RED'] as const) {
    const roles = participants.filter((p: any) => p.team === team).map((p: any) => p.role);
    const uniqueRoles = new Set(roles);
    if (roles.length !== 5 || uniqueRoles.size !== 5) {
      return { ok: false, error: `${team}チームのロール構成が不正です（TOP/JG/MID/ADC/SUPが重複なく5人必要です）。` };
    }
  }

  if (gameDuration !== undefined && gameDuration !== null) {
    const gd = Number(gameDuration);
    if (!Number.isFinite(gd) || gd < 0 || gd > 3 * 60 * 60) {
      return { ok: false, error: 'gameDurationが不正な値です。' };
    }
  }

  return { ok: true };
}

/**
 * DBから取得したプレイヤー一覧を名前で重複排除し、10人分正しく揃っているか検証する
 */
export function resolveAndValidateDbPlayers(rawDbPlayers: any[], names: string[]): { ok: boolean; error?: string; dbPlayersMap?: Map<string, any> } {
  const playerByName = new Map<string, any>();
  for (const p of rawDbPlayers) {
    const existing = playerByName.get(p.name);
    if (!existing) {
      playerByName.set(p.name, p);
    } else {
      const existingGames = (existing.games_top || 0) + (existing.games_jg || 0) + (existing.games_mid || 0) + (existing.games_adc || 0) + (existing.games_sup || 0);
      const pGames = (p.games_top || 0) + (p.games_jg || 0) + (p.games_mid || 0) + (p.games_adc || 0) + (p.games_sup || 0);
      if (pGames > existingGames) {
        playerByName.set(p.name, p);
      }
    }
  }

  const missingNames = names.filter((n: string) => !playerByName.has(n));
  if (missingNames.length > 0) {
    return { ok: false, error: `一部のプレイヤー情報がDBから見つかりません: ${missingNames.join(', ')}` };
  }

  return { ok: true, dbPlayersMap: playerByName };
}
