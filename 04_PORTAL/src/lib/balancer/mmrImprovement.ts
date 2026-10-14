/**
 * ==============================================================================
 * KTM MMR ＆ Pity 次世代改善アルゴリズム モジュール (mmrImprovement.ts)
 * ==============================================================================
 *
 * 【設計思想】
 * 1. 純粋関数化: DBや外部APIに一切依存せず、テスト容易性と決定論的動作を保証する。
 * 2. 急激な偏りの防止: 少試合プレイヤーの勝率（ベイズ平滑化）やMMR（Kダンパー）の暴れを抑え、公平なチーム分けを実現。
 * 3. 納得感の最大化: オフロール時の不満（Pity傾斜・連続第2希望救済）や早期投了時の理不尽な減少を緩和する。
 */

// ------------------------------------------------------------------------------
// 1. 少試合プレイヤーの収束加速（K値アダプティブダンパー）
// ------------------------------------------------------------------------------
/**
 * 試合数に応じたKファクター（変動係数）を算出する。
 * - 5試合未満: 高速収束（K=48）
 * - 5〜14試合: 通常移行期（K=32）
 * - 15試合以上: 安定期（K=24）
 */
export function calculateAdaptiveKFactor(games: number): number {
  if (games < 5) return 48;
  if (games < 15) return 32;
  return 24;
}

// ------------------------------------------------------------------------------
// 2. 連勝ボーナス（Streak Multiplier）
// ------------------------------------------------------------------------------
/**
 * 連勝数に応じた獲得MMRの倍率を算出する。
 * - 3連勝: +10% (1.10)
 * - 4連勝: +20% (1.20)
 * - 5連勝以上: +30% (1.30 上限)
 * - 2連勝以下: 補正なし (1.00)
 */
export function calculateStreakMultiplier(winStreak: number): number {
  if (winStreak >= 5) return 1.30;
  if (winStreak === 4) return 1.20;
  if (winStreak === 3) return 1.10;
  return 1.00;
}

// ------------------------------------------------------------------------------
// 3. 全レーン波及効果（リップルMMR）
// ------------------------------------------------------------------------------
/**
 * プレイしたメインレーンのMMR変動（delta）を、一定比率（既定20%）で他4レーンへ波及させる。
 * オフロール時の「メインは上手いのに他ロールが初期値のままで初狩りになる」事故を防止する。
 */
export function calculateRippleMmrDeltas(
  playedRole: string,
  delta: number,
  rippleRatio: number = 0.20
): Record<string, number> {
  const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const result: Record<string, number> = {};
  const rippleDelta = Math.round(delta * rippleRatio);

  for (const r of ROLES) {
    if (r.toUpperCase() === playedRole.toUpperCase()) {
      result[r] = delta;
    } else {
      result[r] = rippleDelta;
    }
  }
  return result;
}

// ------------------------------------------------------------------------------
// 4. 少試合プレイヤーの勝率ベイズ平滑化（ラプラス平滑化）
// ------------------------------------------------------------------------------
/**
 * 試行回数が少ないプレイヤーの勝率の暴れ（1戦1勝で100%、1戦0勝で0%など）を
 * 事前分布（勝率50%、仮想重み2試合分: 1勝1敗）を加えることで滑らかにする。
 * 計算式: (wins + 1) / (totalGames + 2) * 100
 */
export function calculateSmoothedWinRate(wins: number, totalGames: number): number {
  if (totalGames === 0) return 50.0;
  const smoothed = ((wins + 1) / (totalGames + 2)) * 100;
  return Math.round(smoothed * 10) / 10;
}

// ------------------------------------------------------------------------------
// 5. オフロールPityの傾斜付与
// ------------------------------------------------------------------------------
export type AssignmentType = 'PRIMARY' | 'SECONDARY' | 'OFF_ROLE';

/**
 * ロール割り当て結果に応じたPity（優先救済値）の増減を算出する。
 * - PRIMARY: 希望通りなのでPityリセット（-999）
 * - SECONDARY: 第2希望なので +1
 * - OFF_ROLE: 完全オフロールなので +3（次戦最優先救済）
 */
export function calculateOffRolePityDelta(type: AssignmentType): number {
  switch (type) {
    case 'PRIMARY':
      return -999;
    case 'SECONDARY':
      return 1;
    case 'OFF_ROLE':
      return 3;
  }
}

// ------------------------------------------------------------------------------
// 6. 早期投了（18分未満）時の敗北MMR減少緩和
// ------------------------------------------------------------------------------
/**
 * 18分未満の早期降伏・投了（Surrender）が発生した際、
 * 事故（回線落ちや完全崩壊）による敗北側のMMR減少を50%緩和する。
 * - 負け（delta < 0）かつ 18分未満: delta を半減（ただし最低 -2 は保証）
 * - 勝ち（delta >= 0）または 18分以上: そのまま
 */
export function calculateSurrenderMmrMitigation(delta: number, gameDurationMinutes: number): number {
  if (delta >= 0 || gameDurationMinutes >= 18) {
    return delta;
  }
  // 18分未満の敗北: 減少幅を半減
  const mitigated = Math.round(delta * 0.5);
  // 最低でも -2 は下がる安全ガード
  return Math.min(-2, mitigated);
}

// ------------------------------------------------------------------------------
// 7. 第2希望連続救済（Consecutive Secondary Protection）
// ------------------------------------------------------------------------------
/**
 * 第2希望配置が連続した場合のPityボーナス。
 * 第2希望であっても2戦連続でメインに行けなかった場合は、完全オフロール相当（+2追加）の救済を付与。
 */
export function calculateConsecutiveSecondaryPity(consecutiveSecondaryCount: number): number {
  if (consecutiveSecondaryCount >= 2) {
    return 2; // 追加ボーナス
  }
  return 0;
}

// ------------------------------------------------------------------------------
// 8. ALL（どこでも）参加者ボーナス
// ------------------------------------------------------------------------------
export interface AllRoleBonus {
  coinBonus: number;
  pityBonus: number;
}

/**
 * チーム編成の調整役として「ALL（どこでも）」を選択して参加したプレイヤーへの還元ボーナス。
 * コイン +50、Pity +1 を付与してロール固定化を防ぐ。
 */
export function calculateAllRoleBonus(isAllRole: boolean): AllRoleBonus {
  if (!isAllRole) {
    return { coinBonus: 0, pityBonus: 0 };
  }
  return {
    coinBonus: 50,
    pityBonus: 1,
  };
}
