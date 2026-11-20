/**
 * ==============================================================================
 * KTM 次世代バランサー・統合評価エンジン (Next-Gen Dynamic Balance Engine)
 * ==============================================================================
 * 
 * 【5大統合改革】
 * 1. AI試合シミュレーション (1,000回モンテカルロ逆算による予想試合時間 ＆ ワンサイド事故率)
 * 2. キャリー無双防止 (部屋のボス/上位突出者のミラー相殺判定)
 * 3. スノーボール連鎖耐性 (全レーン陥落ドミノ倒しの防止)
 * 4. プレイスタイル調律 (戦闘狂 vs 農民の火薬庫対面判定)
 * 5. セッション疲労・ティルト平準化 (当日連敗者への負担軽減)
 * ==============================================================================
 */

import type { AssignedPlayer, Role } from '../balancer';

export const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export type PlayerStyle = 'AGGRESSIVE' | 'PASSIVE' | 'UTILITY';

export interface NextGenSimulationResult {
  // 1. 試合シミュレーション結果
  simulatedGames: number;
  blueWinRate: number; // 0..100 (%)
  redWinRate: number;  // 0..100 (%)
  expectedDurationMinutes: number; // 予想試合時間（例: 28.5分）
  oneSidedRiskPercent: number;     // 15分早期ワンサイド事故率（0..100%）
  matchGrade: 'S_EXCELLENT' | 'A_GOOD' | 'B_FAIR' | 'C_CAUTION' | 'D_ONE_SIDED_DANGER';

  // 2. ボス・キャリー相殺評価
  bossAnalysis: {
    topPlayerBlue: { name: string; role: Role; mmr: number };
    topPlayerRed: { name: string; role: Role; mmr: number };
    mmrGap: number;
    isMirrored: boolean; // 同レーン直接対決または同格レーン対戦か
    statusText: string;
  };

  // 3. スノーボール連鎖耐性 (Resilience)
  snowballResilience: {
    blueResilienceScore: number; // 0..100
    redResilienceScore: number;  // 0..100
    dominoCollapseRisk: boolean; // 一方のチームが全レーン崩壊する危険があるか
    advice: string;
  };

  // 4. プレイスタイル衝突判定
  styleClashAlerts: Array<{
    role: Role;
    bluePlayer: { name: string; style: PlayerStyle };
    redPlayer: { name: string; style: PlayerStyle };
    clashType: 'POWDER_KEG' | 'ONE_WAY_PRESSURE' | 'BALANCED';
    description: string;
  }>;
}

/**
 * プレイヤーのスタッツやロール傾向からプレイスタイルを自動推計する
 */
export function inferPlayerStyle(player: AssignedPlayer): PlayerStyle {
  // 指定された属性や名前、勝率から推計（データ連携時はキル数やデス数を参照）
  const role = player.currentRole;
  if (role === 'SUP') return 'UTILITY';
  if (role === 'TOP' || role === 'MID') {
    // 高MMRまたは好戦的ロール
    return player.mmr >= 1400 ? 'AGGRESSIVE' : 'PASSIVE';
  }
  if (role === 'JG') {
    return 'AGGRESSIVE';
  }
  return 'PASSIVE';
}

/**
 * 当日セッション疲労（ティルト）による実効補正値
 */
export function getFatigueAdjustedMmr(player: AssignedPlayer): number {
  let adj = player.mmr;
  // 当日連敗している場合、集中力低下による実力ブレを考慮 (-30〜-50)
  if (typeof player.todayStreak === 'number') {
    if (player.todayStreak <= -2) adj -= 40;
    else if (player.todayStreak >= 2) adj += 25; // ノリノリボーナス
  }
  return adj;
}

/**
 * 10人のチーム分け結果に対して、次世代統合シミュレーションを実行する
 */
export function evaluateNextGenBalance(
  teamBlue: AssignedPlayer[],
  teamRed: AssignedPlayer[],
  simCount: number = 1000
): NextGenSimulationResult {
  // ── 1. ボス・キャリー相殺判定 ────────────────────────────────
  const sortedBlue = [...teamBlue].sort((a, b) => b.mmr - a.mmr);
  const sortedRed = [...teamRed].sort((a, b) => b.mmr - a.mmr);
  const topBlue = sortedBlue[0];
  const topRed = sortedRed[0];
  const bossMmrGap = Math.abs(topBlue.mmr - topRed.mmr);

  // 同レーン対決か、または同格キャリーレーン(MID/JG/TOP)同士か
  const isDirectMirror = topBlue.currentRole === topRed.currentRole;
  const isHighImpactMirror =
    ['MID', 'JG'].includes(topBlue.currentRole) && ['MID', 'JG'].includes(topRed.currentRole);
  const isMirrored = isDirectMirror || isHighImpactMirror;

  let bossStatusText = '';
  if (isDirectMirror) {
    bossStatusText = `👑 両軍エースが ${topBlue.currentRole} で直接対決（完全相殺・格差 ${bossMmrGap}pt）`;
  } else if (isHighImpactMirror) {
    bossStatusText = `⚡ エースが ${topBlue.currentRole} vs ${topRed.currentRole} で対等牽引（格差 ${bossMmrGap}pt）`;
  } else {
    bossStatusText = `⚠️ エース配置が不均衡（${topBlue.name} [${topBlue.currentRole}] vs ${topRed.name} [${topRed.currentRole}]）`;
  }

  // ── 2. プレイスタイル衝突判定 ────────────────────────────────
  const styleAlerts: NextGenSimulationResult['styleClashAlerts'] = [];
  let powderKegCount = 0;

  for (const role of ROLES) {
    const b = teamBlue.find((p) => p.currentRole === role)!;
    const r = teamRed.find((p) => p.currentRole === role)!;
    const bStyle = inferPlayerStyle(b);
    const rStyle = inferPlayerStyle(r);

    if (bStyle === 'AGGRESSIVE' && rStyle === 'AGGRESSIVE') {
      powderKegCount++;
      styleAlerts.push({
        role,
        bluePlayer: { name: b.name, style: bStyle },
        redPlayer: { name: r.name, style: rStyle },
        clashType: 'POWDER_KEG',
        description: `${role}対面: 超好戦的同士の激突（序盤ソロキル・火薬庫リスク高）`,
      });
    } else if (
      (bStyle === 'AGGRESSIVE' && rStyle === 'PASSIVE' && b.mmr - r.mmr > 150) ||
      (rStyle === 'AGGRESSIVE' && bStyle === 'PASSIVE' && r.mmr - b.mmr > 150)
    ) {
      styleAlerts.push({
        role,
        bluePlayer: { name: b.name, style: bStyle },
        redPlayer: { name: r.name, style: rStyle },
        clashType: 'ONE_WAY_PRESSURE',
        description: `${role}対面: 実力差のある一方的プッシュ・タワーダイブ虐殺リスク`,
      });
    } else {
      styleAlerts.push({
        role,
        bluePlayer: { name: b.name, style: bStyle },
        redPlayer: { name: r.name, style: rStyle },
        clashType: 'BALANCED',
        description: `${role}対面: 安定したレーン戦が期待できます`,
      });
    }
  }

  // ── 3. スノーボール連鎖耐性 ──────────────────────────────────
  // 各レーンの実効MMR格差
  const laneDiffs: Record<Role, number> = {} as any;
  let blueDisadvantagedLanes = 0;
  let redDisadvantagedLanes = 0;

  for (const role of ROLES) {
    const b = teamBlue.find((p) => p.currentRole === role)!;
    const r = teamRed.find((p) => p.currentRole === role)!;
    const diff = getFatigueAdjustedMmr(b) - getFatigueAdjustedMmr(r);
    laneDiffs[role] = diff;
    if (diff < -80) blueDisadvantagedLanes++;
    if (diff > 80) redDisadvantagedLanes++;
  }

  // 全3レーン（TOP/MID/ADC）で不利を背負うとドミノ倒し崩壊（15分ゲーム）になる
  const dominoCollapseRisk = blueDisadvantagedLanes >= 3 || redDisadvantagedLanes >= 3;
  const blueResilience = Math.max(10, Math.min(100, 100 - blueDisadvantagedLanes * 25));
  const redResilience = Math.max(10, Math.min(100, 100 - redDisadvantagedLanes * 25));

  let resilienceAdvice = '両チームともに複数のレーンで逆転・対抗の足がかりがあります。';
  if (dominoCollapseRisk) {
    resilienceAdvice = '⚠️ 片方のチームが全レーンで劣勢を背負っており、スノーボール崩壊リスクが極めて高いです。';
  }

  // ── 4. 1,000回 モンテカルロ試合シミュレーション ─────────────
  let blueWins = 0;
  let oneSidedGames = 0;
  let totalSimMinutes = 0;

  // 各レーンの基礎勝率確率をシグモイド関数で計算
  const calcWinProb = (diff: number) => 1 / (1 + Math.exp(-diff / 180));

  for (let i = 0; i < simCount; i++) {
    let blueScore = 0;
    let maxLaneDeficit = 0;

    for (const role of ROLES) {
      const diff = laneDiffs[role];
      const prob = calcWinProb(diff);
      // ランダム変動（クリティカル、ガンク成功等のノイズ）
      const roll = Math.random();
      const laneWonByBlue = roll < prob;
      if (laneWonByBlue) blueScore++;

      const absDeficit = Math.abs(diff);
      if (absDeficit > maxLaneDeficit) maxLaneDeficit = absDeficit;
    }

    // チーム全体の勝敗判定 (レーン勝利数 + ボス補正 + ノイズ)
    const bossRoll = (Math.random() - 0.5) * 0.4;
    const blueFinalChance = blueScore / 5 + (topBlue.mmr - topRed.mmr) / 1000 + bossRoll;
    const isBlueWin = blueFinalChance >= 0.5;
    if (isBlueWin) blueWins++;

    // 試合時間のシミュレーション (基本30分、格差が大きいほど短縮)
    const baseDuration = 31.0;
    const variance = (Math.random() - 0.5) * 6; // ±3分の乱数
    const speedUp = (maxLaneDeficit / 150) * 4.5; // レーン格差で試合が早まる
    const gameMinutes = Math.max(15, baseDuration - speedUp + variance);
    totalSimMinutes += gameMinutes;

    // 18分未満かつ一方が4レーン以上圧勝した場合はワンサイドゲーム判定
    if (gameMinutes <= 18.5 && (blueScore <= 1 || blueScore >= 4)) {
      oneSidedGames++;
    }
  }

  const blueWinRate = +((blueWins / simCount) * 100).toFixed(1);
  const redWinRate = +((100 - blueWinRate)).toFixed(1);
  const expectedDurationMinutes = +(totalSimMinutes / simCount).toFixed(1);
  const oneSidedRiskPercent = +((oneSidedGames / simCount) * 100).toFixed(1);

  // 総合試合グレード判定
  let matchGrade: NextGenSimulationResult['matchGrade'] = 'A_GOOD';
  if (oneSidedRiskPercent <= 3.0 && isMirrored && !dominoCollapseRisk && Math.abs(blueWinRate - 50) <= 3) {
    matchGrade = 'S_EXCELLENT';
  } else if (oneSidedRiskPercent >= 12.0 || dominoCollapseRisk) {
    matchGrade = 'D_ONE_SIDED_DANGER';
  } else if (oneSidedRiskPercent >= 7.0 || !isMirrored) {
    matchGrade = 'C_CAUTION';
  }

  return {
    simulatedGames: simCount,
    blueWinRate,
    redWinRate,
    expectedDurationMinutes,
    oneSidedRiskPercent,
    matchGrade,
    bossAnalysis: {
      topPlayerBlue: { name: topBlue.name, role: topBlue.currentRole, mmr: topBlue.mmr },
      topPlayerRed: { name: topRed.name, role: topRed.currentRole, mmr: topRed.mmr },
      mmrGap: bossMmrGap,
      isMirrored,
      statusText: bossStatusText,
    },
    snowballResilience: {
      blueResilienceScore: blueResilience,
      redResilienceScore: redResilience,
      dominoCollapseRisk,
      advice: resilienceAdvice,
    },
    styleClashAlerts: styleAlerts,
  };
}
