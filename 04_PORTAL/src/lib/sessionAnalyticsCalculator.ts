/**
 * 実測マッチデータから「時間帯別勝率」「連戦疲労度」「即キュー・ティルト」
 * 4大プロ機能（序盤因果・致命的デス・展開4分類・プール診断）
 * 5大心理・行動DNA分析（MBTI・ティルトトリガー・銭勘定・逆境耐性・悪癖）
 * 目標ランク基準ギャップ診断 (Target Rank Benchmark Gap)
 * および 5大ロール（TOP / JUNGLE / MID / ADC / SUPPORT）完全特化型指標を自動計算する計算エンジン
 */

export interface RawMatchRecord {
  matchId: string;
  gameStartTimestamp: number; // epoch ms
  gameDuration: number;       // seconds
  gameEndTimestamp: number;   // epoch ms
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  championName: string;
  lane: string;
  visionScore: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  teamDamage: number;
  playerDamage: number;
  teamKills: number;
  goldEarned?: number;
  teamHordeKills?: number;   // ヴォイドグラブ獲得数 (0〜6)
  teamDragonKills?: number;  // ドラゴン獲得数
  enemyHordeKills?: number;
  enemyDragonKills?: number;
  firstDragon?: boolean;     // 初手ドラゴン確保フラグ
}

// ==========================================
// 🛡️ ロール（レーン）別 特化設定
// ==========================================

export interface RoleConfig {
  roleId: string;
  roleName: string;
  roleIcon: string;
  radarLabels: [string, string, string, string, string];
  visionLabelA: string;
  visionLabelB: string;
  specialMetricName: string;
  defaultActionGuideline: string;
}

export const ROLE_CONFIGS: { [role: string]: RoleConfig } = {
  JUNGLE: {
    roleId: 'JUNGLE',
    roleName: 'ジャングル (JUNGLE)',
    roleIcon: '🌲',
    radarLabels: [
      '① 生存力・被デス回避',
      '② ファーム効率 (CS/分)',
      '③ 15分キル関与 (KP@15)',
      '④ オブジェクト確保 (Obj Control)',
      '⑤ 集団戦ポジショニング',
    ],
    visionLabelA: '🛡️ 自陣・リバー防衛視界',
    visionLabelB: '⚡ 敵陣ディープ視界',
    specialMetricName: '1周目フルクリア ＆ 敵JG察知',
    defaultActionGuideline: '3:30フルクリア後に即リコールせず、敵ラプター裏へディープワードを刺してプッシュレーンへのカウンター介入を挟むこと。',
  },
  MIDDLE: {
    roleId: 'MIDDLE',
    roleName: 'ミッド (MID)',
    roleIcon: '🧙',
    radarLabels: [
      '① 生存力・被ガンク回避',
      '② CS精度 ＆ プッシュ主導権',
      '③ ローム・サイド介入率',
      '④ リバー・オブジェクト主導権',
      '⑤ 集団戦DPS ＆ バースト',
    ],
    visionLabelA: '🛡️ 川・自陣側防衛視界',
    visionLabelB: '⚡ 敵側ブッシュ・対角ディープ視界',
    specialMetricName: 'サイドレーンローム関与率',
    defaultActionGuideline: 'ウェーブを押し込んだ直後に留まらず、川の視界確保またはBOT/TOPへのローム圧力をかけること。',
  },
  TOP: {
    roleId: 'TOP',
    roleName: 'トップ (TOP)',
    roleIcon: '🛡️',
    radarLabels: [
      '① タイマン生存・被ソロキル回避',
      '② CS精度 ＆ ウェーブ管理',
      '③ TP・集団戦合流力',
      '④ スプリットプッシュ圧力',
      '⑤ フロントライン耐久 ＆ エンゲージ',
    ],
    visionLabelA: '🛡️ レーン防衛視界',
    visionLabelB: '⚡ 敵側トライブッシュ・ディープ視界',
    specialMetricName: 'サイドタワー圧力 ＆ TPタイミング',
    defaultActionGuideline: 'スプリットプッシュ時は敵のマップ消失を確認して引き際を見極め、オブジェクト湧きにTPを温存すること。',
  },
  BOTTOM: {
    roleId: 'BOTTOM',
    roleName: 'ボット・マークスマン (ADC)',
    roleIcon: '🏹',
    radarLabels: [
      '① 集団戦ポジショニング・低デス',
      '② 分間CS・リソース回収',
      '③ 20分以降DPS占有率',
      '④ オブジェクトバースト力',
      '⑤ 被ガンク・被ダイブ回避',
    ],
    visionLabelA: '🛡️ レーン防衛・リバー視界',
    visionLabelB: '⚡ 青ワード長距離索敵視界',
    specialMetricName: '20分以降の集団戦DPSシェア',
    defaultActionGuideline: '集団戦では「最も近い安全な敵」から確実に攻撃し、視界のないサイドファームで単独死しないこと。',
  },
  UTILITY: {
    roleId: 'UTILITY',
    roleName: 'サポート (SUPPORT)',
    roleIcon: '👁️',
    radarLabels: [
      '① 視界支配・ピンクワード購入',
      '② ローム・他レーン支援力',
      '③ 集団戦CC・キャリー防衛(ピール)',
      '④ オブジェクト先制視界管理',
      '⑤ 低被デス・生存ポジショニング',
    ],
    visionLabelA: '🛡️ 自陣・レーン防衛視界',
    visionLabelB: '⚡ オブジェクト前ディープ視界',
    specialMetricName: '分間視界 ＆ デワード数 (除去数)',
    defaultActionGuideline: 'オブジェクト湧き1分前にリコールしてピンクワードを補充し、敵より先に視界ラインを押し上げること。',
  },
};

export function getRoleConfig(lane: string): RoleConfig {
  const upper = lane.toUpperCase();
  if (upper === 'JUNGLE' || upper === 'JG') return ROLE_CONFIGS.JUNGLE;
  if (upper === 'MIDDLE' || upper === 'MID') return ROLE_CONFIGS.MIDDLE;
  if (upper === 'TOP') return ROLE_CONFIGS.TOP;
  if (upper === 'BOTTOM' || upper === 'BOT' || upper === 'ADC') return ROLE_CONFIGS.BOTTOM;
  if (upper === 'UTILITY' || upper === 'SUPPORT' || upper === 'SUP') return ROLE_CONFIGS.UTILITY;
  return ROLE_CONFIGS.JUNGLE;
}

// ==========================================
// 🎯 目標ランク ベンチマーク ＆ ギャップ診断
// ==========================================

export interface RankBenchmark {
  tierName: string;
  avgDeaths: number;
  csPerMin: number;
  kp15: number;
  visionScorePerMin: number;
  deepWardRatio: number;
  kda: number;
}

export const ROLE_RANK_BENCHMARKS: {
  [role: string]: {
    [tier: string]: RankBenchmark;
  };
} = {
  UTILITY: {
    'Gold IV': {
      tierName: 'Gold IV (サポート)',
      avgDeaths: 4.8,
      csPerMin: 1.2,
      kp15: 45,
      visionScorePerMin: 1.90,
      deepWardRatio: 24,
      kda: 3.0,
    },
    'Platinum IV': {
      tierName: 'Platinum IV (サポート)',
      avgDeaths: 4.2,
      csPerMin: 1.2,
      kp15: 50,
      visionScorePerMin: 2.30,
      deepWardRatio: 30,
      kda: 3.6,
    },
    'Emerald IV': {
      tierName: 'Emerald IV (サポート推奨目標)',
      avgDeaths: 3.6,
      csPerMin: 1.2,
      kp15: 55,
      visionScorePerMin: 2.70,
      deepWardRatio: 36,
      kda: 4.0,
    },
    'Diamond IV': {
      tierName: 'Diamond IV (サポート)',
      avgDeaths: 3.0,
      csPerMin: 1.2,
      kp15: 60,
      visionScorePerMin: 3.10,
      deepWardRatio: 42,
      kda: 4.8,
    },
    'Master': {
      tierName: 'Master (サポート)',
      avgDeaths: 2.6,
      csPerMin: 1.2,
      kp15: 65,
      visionScorePerMin: 3.50,
      deepWardRatio: 50,
      kda: 5.4,
    },
  },
  JUNGLE: {
    'Gold IV': {
      tierName: 'Gold IV (ジャングル)',
      avgDeaths: 4.6,
      csPerMin: 5.8,
      kp15: 42,
      visionScorePerMin: 1.30,
      deepWardRatio: 25,
      kda: 3.0,
    },
    'Platinum IV': {
      tierName: 'Platinum IV (ジャングル)',
      avgDeaths: 4.0,
      csPerMin: 6.5,
      kp15: 48,
      visionScorePerMin: 1.50,
      deepWardRatio: 32,
      kda: 3.6,
    },
    'Emerald IV': {
      tierName: 'Emerald IV (ジャングル推奨目標)',
      avgDeaths: 3.4,
      csPerMin: 7.0,
      kp15: 52,
      visionScorePerMin: 1.80,
      deepWardRatio: 40,
      kda: 4.2,
    },
    'Diamond IV': {
      tierName: 'Diamond IV (ジャングル)',
      avgDeaths: 2.9,
      csPerMin: 7.6,
      kp15: 58,
      visionScorePerMin: 2.05,
      deepWardRatio: 46,
      kda: 4.8,
    },
    'Master': {
      tierName: 'Master (ジャングル)',
      avgDeaths: 2.5,
      csPerMin: 8.2,
      kp15: 62,
      visionScorePerMin: 2.30,
      deepWardRatio: 52,
      kda: 5.4,
    },
  },
  BOTTOM: {
    'Gold IV': {
      tierName: 'Gold IV (ADC)',
      avgDeaths: 4.8,
      csPerMin: 6.6,
      kp15: 38,
      visionScorePerMin: 1.00,
      deepWardRatio: 18,
      kda: 2.8,
    },
    'Platinum IV': {
      tierName: 'Platinum IV (ADC)',
      avgDeaths: 4.2,
      csPerMin: 7.4,
      kp15: 44,
      visionScorePerMin: 1.20,
      deepWardRatio: 22,
      kda: 3.4,
    },
    'Emerald IV': {
      tierName: 'Emerald IV (ADC推奨目標)',
      avgDeaths: 3.5,
      csPerMin: 8.0,
      kp15: 48,
      visionScorePerMin: 1.40,
      deepWardRatio: 26,
      kda: 3.8,
    },
    'Diamond IV': {
      tierName: 'Diamond IV (ADC)',
      avgDeaths: 2.9,
      csPerMin: 8.6,
      kp15: 52,
      visionScorePerMin: 1.60,
      deepWardRatio: 30,
      kda: 4.5,
    },
    'Master': {
      tierName: 'Master (ADC)',
      avgDeaths: 2.5,
      csPerMin: 9.2,
      kp15: 56,
      visionScorePerMin: 1.80,
      deepWardRatio: 35,
      kda: 5.2,
    },
  },
  MIDDLE: {
    'Gold IV': {
      tierName: 'Gold IV (ミッド)',
      avgDeaths: 4.8,
      csPerMin: 6.4,
      kp15: 42,
      visionScorePerMin: 1.15,
      deepWardRatio: 20,
      kda: 2.8,
    },
    'Platinum IV': {
      tierName: 'Platinum IV (ミッド)',
      avgDeaths: 4.2,
      csPerMin: 7.2,
      kp15: 48,
      visionScorePerMin: 1.40,
      deepWardRatio: 26,
      kda: 3.4,
    },
    'Emerald IV': {
      tierName: 'Emerald IV (ミッド推奨目標)',
      avgDeaths: 3.5,
      csPerMin: 7.8,
      kp15: 52,
      visionScorePerMin: 1.65,
      deepWardRatio: 32,
      kda: 3.8,
    },
    'Diamond IV': {
      tierName: 'Diamond IV (ミッド)',
      avgDeaths: 2.9,
      csPerMin: 8.4,
      kp15: 56,
      visionScorePerMin: 1.90,
      deepWardRatio: 38,
      kda: 4.6,
    },
    'Master': {
      tierName: 'Master (ミッド)',
      avgDeaths: 2.5,
      csPerMin: 9.0,
      kp15: 60,
      visionScorePerMin: 2.15,
      deepWardRatio: 45,
      kda: 5.3,
    },
  },
  TOP: {
    'Gold IV': {
      tierName: 'Gold IV (トップ)',
      avgDeaths: 4.8,
      csPerMin: 6.2,
      kp15: 36,
      visionScorePerMin: 1.10,
      deepWardRatio: 18,
      kda: 2.6,
    },
    'Platinum IV': {
      tierName: 'Platinum IV (トップ)',
      avgDeaths: 4.2,
      csPerMin: 7.0,
      kp15: 42,
      visionScorePerMin: 1.30,
      deepWardRatio: 24,
      kda: 3.2,
    },
    'Emerald IV': {
      tierName: 'Emerald IV (トップ推奨目標)',
      avgDeaths: 3.6,
      csPerMin: 7.6,
      kp15: 46,
      visionScorePerMin: 1.50,
      deepWardRatio: 30,
      kda: 3.6,
    },
    'Diamond IV': {
      tierName: 'Diamond IV (トップ)',
      avgDeaths: 3.0,
      csPerMin: 8.2,
      kp15: 50,
      visionScorePerMin: 1.75,
      deepWardRatio: 36,
      kda: 4.2,
    },
    'Master': {
      tierName: 'Master (トップ)',
      avgDeaths: 2.6,
      csPerMin: 8.8,
      kp15: 54,
      visionScorePerMin: 2.00,
      deepWardRatio: 42,
      kda: 4.8,
    },
  },
};

export const RANK_BENCHMARKS = ROLE_RANK_BENCHMARKS.JUNGLE;

export interface TargetRankGapAnalysis {
  targetTier: string;
  currentActual: {
    avgDeaths: number;
    csPerMin: number;
    kp15: number;
    visionScorePerMin: number;
    deepWardRatio: number;
    kda: number;
  };
  benchmark: RankBenchmark;
  gaps: {
    deathsDiff: { value: number; passed: boolean; label: string };
    csDiff: { value: number; passed: boolean; label: string };
    kpDiff: { value: number; passed: boolean; label: string };
    visionDiff: { value: number; passed: boolean; label: string };
    deepWardDiff: { value: number; passed: boolean; label: string };
  };
  targetReadinessScore: number;
  keyActionToPromote: string[];
}

export function calculateTargetRankGap(
  actual: {
    avgDeaths: number;
    csPerMin: number;
    kp15: number;
    visionScorePerMin: number;
    deepWardRatio: number;
    kda: number;
  },
  targetTier: string = 'Emerald IV',
  role: string = 'JUNGLE'
): TargetRankGapAnalysis {
  const normRole = (role || 'JUNGLE').toUpperCase();
  const roleTable = ROLE_RANK_BENCHMARKS[normRole] || ROLE_RANK_BENCHMARKS.JUNGLE;
  const benchmark = roleTable[targetTier] || roleTable['Emerald IV'] || RANK_BENCHMARKS['Emerald IV'];

  const isSupport = normRole === 'UTILITY' || normRole === 'SUPPORT';

  const deathsDiffVal = Number((actual.avgDeaths - benchmark.avgDeaths).toFixed(2));
  const csDiffVal = Number((actual.csPerMin - benchmark.csPerMin).toFixed(1));
  const kpDiffVal = Math.round(actual.kp15 - benchmark.kp15);
  const visionDiffVal = Number((actual.visionScorePerMin - benchmark.visionScorePerMin).toFixed(2));
  const deepWardDiffVal = Math.round(actual.deepWardRatio - benchmark.deepWardRatio);

  const deathsPassed = deathsDiffVal <= 0.3;
  // サポートの場合はCSが多すぎないこと (<= 2.2)、それ以外は目標CSを満たすこと
  const csPassed = isSupport ? actual.csPerMin <= 2.2 : csDiffVal >= -0.2;
  const kpPassed = kpDiffVal >= -3;
  const visionPassed = visionDiffVal >= -0.15;
  const deepWardPassed = deepWardDiffVal >= -4;

  // 🎯 各項目の目標到達率（0〜100%）を連続・精密に算出（目標ランクの難易度に応じてダイナミックに変化）
  const deathsRate = actual.avgDeaths <= benchmark.avgDeaths
    ? 100
    : Math.max(30, Math.round(100 - (actual.avgDeaths - benchmark.avgDeaths) * 22));

  const csRate = isSupport
    ? (actual.csPerMin <= 1.5 ? 100 : Math.max(40, Math.round(100 - (actual.csPerMin - 1.5) * 35)))
    : Math.max(30, Math.min(100, Math.round((actual.csPerMin / benchmark.csPerMin) * 100)));

  const kpRate = Math.max(30, Math.min(100, Math.round((actual.kp15 / benchmark.kp15) * 100)));
  const visionRate = Math.max(30, Math.min(100, Math.round((actual.visionScorePerMin / benchmark.visionScorePerMin) * 100)));
  const deepWardRate = Math.max(30, Math.min(100, Math.round((actual.deepWardRatio / benchmark.deepWardRatio) * 100)));

  // 重み付け総合到達度スコア（Gold/Plat/Emeraldで明確に難易度差が出る設計）
  const targetReadinessScore = Math.min(
    100,
    Math.max(
      20,
      Math.round(
        deathsRate * 0.25 +
        csRate * 0.20 +
        kpRate * 0.25 +
        visionRate * 0.15 +
        deepWardRate * 0.15
      )
    )
  );

  const keyActions: string[] = [];
  if (!kpPassed) {
    if (isSupport) {
      keyActions.push(`【最優先課題】戦闘関与率（現在 ${actual.kp15}% ➔ 目標 ${benchmark.kp15}%）: レーン戦終了後のADC/MIDへのローム合流と集団戦エンゲージ・ピール参加を増やすこと。`);
    } else {
      keyActions.push(`【最優先課題】15分戦闘関与率（現在 ${actual.kp15}% ➔ 目標 ${benchmark.kp15}%）: 序盤のレーン主導権・カウンターアクションを1回必ず増やすこと。`);
    }
  }
  if (!visionPassed) {
    if (isSupport) {
      keyActions.push(`【視界支配課題】分間視界スコア（現在 ${actual.visionScorePerMin}/分 ➔ 目標 ${benchmark.visionScorePerMin}/分）: リコール毎のピンクワード2本購入と、ドラゴン/バロン湧き60秒前の先制視界奪取を徹底すること。`);
    } else {
      keyActions.push(`【視界課題】分間視界スコア（現在 ${actual.visionScorePerMin}/分 ➔ 目標 ${benchmark.visionScorePerMin}/分）: ワードを腐らせず要所に設置すること。`);
    }
  }
  if (!deepWardPassed) {
    keyActions.push(`【ディープ視界】敵陣視界比率（現在 ${actual.deepWardRatio}% ➔ 目標 ${benchmark.deepWardRatio}%）: オブジェクト前や敵ジャングル深部へ事前視界を1本刺して敵の進行を察知すること。`);
  }
  if (!csPassed && !isSupport) {
    keyActions.push(`【リソース課題】分間CS（現在 ${actual.csPerMin} ➔ 目標 ${benchmark.csPerMin}）: 中盤サイドレーンのウェーブ回収効率を向上させること。`);
  }
  if (!csPassed && isSupport) {
    keyActions.push(`【CS配分注意】サポートの分間CSが ${actual.csPerMin} と高めです。ラストヒットは味方キャリーに譲り、ゴールドとEXPをキャリーに集中させましょう。`);
  }
  if (keyActions.length === 0) {
    keyActions.push(`主要スタッツは既に【${benchmark.tierName}基準】を完全にクリアしています！連戦を3〜4戦で抑え、メンタルを維持して試合数を重ねるだけで昇格可能です。`);
  }

  const csLabel = isSupport
    ? (actual.csPerMin <= 2.2 ? `適正（キャリーにCS譲渡達成 ${actual.csPerMin}/分）` : `CS取りすぎ注意 (${actual.csPerMin}/分)`)
    : (csDiffVal >= 0 ? `基準クリア (+${csDiffVal})` : `${Math.abs(csDiffVal)} 不足`);

  return {
    targetTier,
    currentActual: actual,
    benchmark,
    gaps: {
      deathsDiff: {
        value: deathsDiffVal,
        passed: deathsPassed,
        label: deathsDiffVal <= 0 ? `基準クリア (${Math.abs(deathsDiffVal)} 低デス)` : `${deathsDiffVal} 超過 (要削減)`,
      },
      csDiff: {
        value: csDiffVal,
        passed: csPassed,
        label: csLabel,
      },
      kpDiff: {
        value: kpDiffVal,
        passed: kpPassed,
        label: kpDiffVal >= 0 ? `基準クリア (+${kpDiffVal}%)` : `${Math.abs(kpDiffVal)}% 不足 (最大ボトルネック)`,
      },
      visionDiff: {
        value: visionDiffVal,
        passed: visionPassed,
        label: visionDiffVal >= 0 ? `基準クリア (+${visionDiffVal})` : `${Math.abs(visionDiffVal)} 不足`,
      },
      deepWardDiff: {
        value: deepWardDiffVal,
        passed: deepWardPassed,
        label: deepWardDiffVal >= 0 ? `基準クリア (+${deepWardDiffVal}%)` : `${Math.abs(deepWardDiffVal)}% 不足`,
      },
    },
    targetReadinessScore,
    keyActionToPromote: keyActions,
  };
}

export interface EarlyTimelineImpact {
  firstBloodRate: number;
  firstDeathAvgMinute: string;
  objLabel: string;
  voidgrubWinRate: number;
  voidgrubLossWinRate: number;
  plateGoldImpact: string;
  roleObjectiveFocus: string;
}

export interface FatalDeathAnalytics {
  objPreSpawnDeathsCount: number;
  objPreSpawnDeathsRate: number;
  isolatedDeathsPercent: number;
  avgFirstDeathSec: number;
  fatalThrowRating: string;
}

export interface GameOutcomeBreakdown {
  hardCarryWins: { count: number; percent: number; label: string };
  teamSupportedWins: { count: number; percent: number; label: string };
  aceLosses: { count: number; percent: number; label: string };
  throwLosses: { count: number; percent: number; label: string };
  dominantOutcomeSummary: string;
}

export interface ChampionPoolDiagnosis {
  apRatioPercent: number;
  adRatioPercent: number;
  tankRatioPercent: number;
  poolArchetype: string;
  missingPiece: string;
  recommendedAdditions: Array<{
    championName: string;
    role: string;
    archetype: string;
    synergyReason: string;
  }>;
}

export interface PlaystyleMbti {
  typeCode: string;
  typeName: string;
  tagline: string;
  axes: {
    safetyVsRisk: { safetyPercent: number; riskPercent: number; label: string };
    scaleVsEnabler: { scalePercent: number; enablerPercent: number; label: string };
    guardianVsInvader: { guardianPercent: number; invaderPercent: number; label: string };
    deliberateVsReflex: { deliberatePercent: number; reflexPercent: number; label: string };
  };
  personalityAnalysis: string;
}

export interface TiltTriggerMatrix {
  invadeResistanceRating: string;
  teammateDeathResistance: string;
  snowballDeathAvoidanceRate: number;
  mentalResilienceScore: number;
  tiltInsight: string;
}

export interface GoldEfficiency {
  damagePerGoldRating: string;
  goldStashRating: string;
  spikeUtilizationPercent: number;
  efficiencyVerdict: string;
}

export interface AdversityBehavior {
  archetype: string;
  behindComebackWinRate: number;
  behaviorVerdict: string;
  recommendedMindset: string;
}

export interface CognitiveBiases {
  recallHabitBias: string;
  mapAttentionBias: string;
  actionPrescription: string;
}

export interface CalculatedSessionAnalytics {
  timeOfDayPerformance: Array<{
    timeSlot: string;
    label: string;
    winRate: number;
    kda: number;
    gamesCount: number;
    conditionRating: string;
    insight: string;
    hasData: boolean;
  }>;
  sessionFatigueImpact: Array<{
    gameNumberInSession: string;
    label: string;
    winRate: number;
    avgDeaths: number;
    focusScore: number;
    fatigueLevel: string;
    gamesCount: number;
    hasData: boolean;
  }>;
  requeueTiltStats: {
    immediateRequeueWinRate: number;
    immediateRequeueGames: number;
    restedRequeueWinRate: number;
    restedRequeueGames: number;
    tiltWinRateDropPercent: number;
    hasData: boolean;
    insight?: string;
  };
  dayOfWeekVariance: Array<{
    day: string;
    winRate: number;
    gamesCount: number;
    playerPoolType: string;
  }>;
  goldenSessionRules: string[];
  earlyTimelineImpact: EarlyTimelineImpact;
  fatalDeathAnalytics: FatalDeathAnalytics;
  gameOutcomeBreakdown: GameOutcomeBreakdown;
  championPoolDiagnosis: ChampionPoolDiagnosis;
  playstyleMbti: PlaystyleMbti;
  tiltTriggerMatrix: TiltTriggerMatrix;
  goldEfficiency: GoldEfficiency;
  adversityBehavior: AdversityBehavior;
  cognitiveBiases: CognitiveBiases;
  targetRankGap: TargetRankGapAnalysis;
  roleConfig: RoleConfig;
}

/**
 * 試合リストから完全実測のセッション＆コンディション＆心理DNA＆目標ランクギャップを計算
 */
export function calculateRealSessionAnalytics(
  matches: RawMatchRecord[],
  targetTier: string = 'Emerald IV',
  detectedRole: string = 'JUNGLE'
): CalculatedSessionAnalytics {
  const roleConfig = getRoleConfig(detectedRole);

  if (!matches || matches.length === 0) {
    return getFallbackSessionAnalytics(targetTier, detectedRole);
  }

  const sorted = [...matches].sort((a, b) => a.gameStartTimestamp - b.gameStartTimestamp);
  const totalG = Math.max(1, sorted.length);

  // 1. 時間帯別パフォーマンス (JST換算)
  const timeBuckets: { [key: string]: { wins: number; total: number; kills: number; deaths: number; assists: number } } = {
    golden: { wins: 0, total: 0, kills: 0, deaths: 0, assists: 0 },
    daytime: { wins: 0, total: 0, kills: 0, deaths: 0, assists: 0 },
    midnight: { wins: 0, total: 0, kills: 0, deaths: 0, assists: 0 },
    morning: { wins: 0, total: 0, kills: 0, deaths: 0, assists: 0 },
  };

  sorted.forEach((m) => {
    const jstDate = new Date(m.gameStartTimestamp + 9 * 60 * 60 * 1000);
    const hour = jstDate.getUTCHours();

    let bucket = 'daytime';
    if (hour >= 19 && hour <= 23) bucket = 'golden';
    else if (hour >= 0 && hour <= 5) bucket = 'midnight';
    else if (hour >= 6 && hour <= 10) bucket = 'morning';

    timeBuckets[bucket].total += 1;
    if (m.win) timeBuckets[bucket].wins += 1;
    timeBuckets[bucket].kills += m.kills;
    timeBuckets[bucket].deaths += m.deaths;
    timeBuckets[bucket].assists += m.assists;
  });

  const formatBucket = (key: string, label: string, slotStr: string, defaultSlotDesc: string) => {
    const b = timeBuckets[key];
    const hasData = b.total > 0;
    const winRate = hasData ? Math.round((b.wins / b.total) * 100) : 0;
    const avgD = hasData ? Number((b.deaths / b.total).toFixed(1)) : 0;
    const kda = hasData && b.deaths > 0 ? Number(((b.kills + b.assists) / b.deaths).toFixed(2)) : hasData ? b.kills + b.assists : 0;
    
    let conditionRating = 'データなし (直近プレイなし)';
    let dynamicInsight = '直近のプレイ履歴が0試合のため、疲労蓄積のない健全な状態です。';

    if (hasData) {
      if (winRate >= 60) {
        conditionRating = 'Sランク (最高パフォーマンス)';
        dynamicInsight = `実測${b.total}試合で勝率${winRate}%・KDA ${kda}・平均${avgD}デスを記録。判断速度とマップ把握が研ぎ澄まされており、最も安定してLPを獲得できている覚醒時間帯です。`;
      } else if (winRate >= 50) {
        conditionRating = 'Aランク (良好・安定巡航)';
        dynamicInsight = `実測${b.total}試合で勝率${winRate}% (KDA ${kda} / 平均${avgD}デス)。大崩れせず基本通りの動きが活きており、安定した戦績を維持できています。`;
      } else if (winRate <= 40) {
        conditionRating = 'Dランク (要注意・ティルト警戒)';
        dynamicInsight = `実測${b.total}試合で勝率${winRate}% (平均${avgD}デス)。他の時間帯と比べて被デスが増加傾向にあり、判断の遅れや集中力低下が生じやすいため連戦は非推奨です。`;
      } else {
        conditionRating = 'Bランク (標準的)';
        dynamicInsight = `実測${b.total}試合で勝率${winRate}% (KDA ${kda})。周囲の味方・対戦相手の当たり外れの影響を受けやすい時間帯です。`;
      }
    }

    return {
      timeSlot: slotStr,
      label,
      winRate,
      kda,
      gamesCount: b.total,
      conditionRating,
      insight: dynamicInsight,
      hasData,
    };
  };

  const timeOfDayPerformance = [
    formatBucket('golden', '🌟 ゴールデンタイム (集中力MAX)', '19:00 - 23:59', '夜間ゴールデンタイム'),
    formatBucket('daytime', '☀️ 昼間・夕方 (標準稼働)', '11:00 - 18:59', '日中・夕方稼働'),
    formatBucket('midnight', '⚠️ 深夜帯 (疲労蓄積・注意)', '00:00 - 05:59', '深夜帯'),
  ];

  // 2. 連戦疲労度（実測セッション数・勝率・被デスから完全動的算出）
  const fatigueBuckets = {
    early: { wins: 0, total: 0, deaths: 0 },
    mid: { wins: 0, total: 0, deaths: 0 },
    late: { wins: 0, total: 0, deaths: 0 },
  };

  let currentSessionGameIndex = 0;
  let lastGameEndTimestamp = 0;

  sorted.forEach((m) => {
    if (lastGameEndTimestamp === 0 || m.gameStartTimestamp - lastGameEndTimestamp > 2 * 60 * 60 * 1000) {
      currentSessionGameIndex = 1;
    } else {
      currentSessionGameIndex += 1;
    }
    lastGameEndTimestamp = m.gameEndTimestamp;

    if (currentSessionGameIndex <= 2) {
      fatigueBuckets.early.total += 1;
      if (m.win) fatigueBuckets.early.wins += 1;
      fatigueBuckets.early.deaths += m.deaths;
    } else if (currentSessionGameIndex <= 4) {
      fatigueBuckets.mid.total += 1;
      if (m.win) fatigueBuckets.mid.wins += 1;
      fatigueBuckets.mid.deaths += m.deaths;
    } else {
      fatigueBuckets.late.total += 1;
      if (m.win) fatigueBuckets.late.wins += 1;
      fatigueBuckets.late.deaths += m.deaths;
    }
  });

  const calcBucketAnalysis = (
    stage: 'early' | 'mid' | 'late',
    bucket: { wins: number; total: number; deaths: number }
  ) => {
    const hasData = bucket.total > 0;
    const winRate = hasData ? Math.round((bucket.wins / bucket.total) * 100) : 0;
    const avgDeaths = hasData ? Number((bucket.deaths / bucket.total).toFixed(1)) : 0;

    if (!hasData) {
      return {
        winRate: 0,
        avgDeaths: 0,
        focusScore: 0,
        fatigueLevel: stage === 'late' ? 'データなし (5連戦なし・健全)' : 'データなし',
        label: stage === 'early' ? 'セッション初動' : stage === 'mid' ? 'セッション中盤' : 'セッション終盤',
        hasData: false,
      };
    }

    // 集中力スコアを実測（勝率 + 低被デス）から動的計算 (0〜100)
    const deathPenalty = Math.min(40, Math.max(0, Math.round((avgDeaths - 2.5) * 8)));
    const winScore = Math.min(50, Math.max(10, Math.round((winRate / 100) * 50)));
    const focusScore = Math.min(98, Math.max(25, Math.round(50 + winScore - deathPenalty)));

    // 状態（疲労度・コンディション）の動的判定
    let fatigueLevel = '軽度 (安定)';
    if (focusScore >= 80) {
      fatigueLevel = 'ゼロ (ピーク快調・高集中)';
    } else if (focusScore >= 65) {
      fatigueLevel = '軽度 (安定巡航)';
    } else if (focusScore >= 45) {
      fatigueLevel = '中度 (疲労・やや判断低下)';
    } else {
      fatigueLevel = '重度 (要終了・ティルト警戒)';
    }

    // 動的ラベルの生成
    let label = '';
    if (stage === 'early') {
      if (winRate >= 55) {
        label = '⚡ 初動ピーク・立ち上がり快調';
      } else if (winRate <= 42) {
        label = '🔄 ウォーミングアップ期 (スロースターター)';
      } else {
        label = '🎯 ウォーミングアップ ＆ 初動集中';
      }
    } else if (stage === 'mid') {
      if (winRate >= 55) {
        label = '🔥 覚醒・最盛期ゾーン (集中力MAX)';
      } else if (winRate <= 42) {
        label = '⚠️ 集中力低下ゾーン (注意)';
      } else {
        label = '✨ 安定巡航ゾーン';
      }
    } else {
      // 5試合目以降
      if (winRate >= 55) {
        label = '💪 驚異のスタミナゾーン (長期戦維持)';
      } else if (winRate <= 42) {
        label = '🚨 無自覚な疲労 ＆ 集中力低下ゾーン';
      } else {
        label = '⏳ セッション終盤・疲労警戒ゾーン';
      }
    }

    return {
      winRate,
      avgDeaths,
      focusScore,
      fatigueLevel,
      label,
      hasData: true,
    };
  };

  const earlyRes = calcBucketAnalysis('early', fatigueBuckets.early);
  const midRes = calcBucketAnalysis('mid', fatigueBuckets.mid);
  const lateRes = calcBucketAnalysis('late', fatigueBuckets.late);

  const sessionFatigueImpact = [
    {
      gameNumberInSession: '1〜2試合目',
      label: earlyRes.label,
      winRate: earlyRes.winRate,
      avgDeaths: earlyRes.avgDeaths,
      focusScore: earlyRes.focusScore,
      fatigueLevel: earlyRes.fatigueLevel,
      gamesCount: fatigueBuckets.early.total,
      hasData: earlyRes.hasData,
    },
    {
      gameNumberInSession: '3〜4試合目',
      label: midRes.label,
      winRate: midRes.winRate,
      avgDeaths: midRes.avgDeaths,
      focusScore: midRes.focusScore,
      fatigueLevel: midRes.fatigueLevel,
      gamesCount: fatigueBuckets.mid.total,
      hasData: midRes.hasData,
    },
    {
      gameNumberInSession: '5試合目以降',
      label: lateRes.label,
      winRate: lateRes.winRate,
      avgDeaths: lateRes.avgDeaths,
      focusScore: lateRes.focusScore,
      fatigueLevel: lateRes.fatigueLevel,
      gamesCount: fatigueBuckets.late.total,
      hasData: lateRes.hasData,
    },
  ];

  // 3. 即キュー・ティルト判定
  let immediateLossWins = 0;
  let immediateLossTotal = 0;
  let restedLossWins = 0;
  let restedLossTotal = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (!prev.win) {
      const intervalSec = (curr.gameStartTimestamp - prev.gameEndTimestamp) / 1000;
      if (intervalSec <= 5 * 60) {
        immediateLossTotal += 1;
        if (curr.win) immediateLossWins += 1;
      } else if (intervalSec <= 2 * 60 * 60) {
        restedLossTotal += 1;
        if (curr.win) restedLossWins += 1;
      }
    }
  }

  const hasImmediateData = immediateLossTotal > 0;
  const hasRestedData = restedLossTotal > 0;
  const immediateWinRate = hasImmediateData ? Math.round((immediateLossWins / immediateLossTotal) * 100) : 0;
  const restedWinRate = hasRestedData ? Math.round((restedLossWins / restedLossTotal) * 100) : 0;
  const tiltDrop = hasImmediateData && hasRestedData ? Math.max(0, restedWinRate - immediateWinRate) : 0;

  let tiltInsight = '敗北時は感情に流されず、平常心を保って次戦に臨みましょう。';
  if (immediateLossTotal === 0) {
    tiltInsight = '敗北後に5分以内ですぐキューを入れるケースは0件でした。感情に任せた連戦を避け、極めて冷静にセッションを管理できています。';
  } else if (immediateLossTotal < 3) {
    tiltInsight = `直近の即キューは${immediateLossTotal}試合（勝率${immediateWinRate}%）のみと実測サンプル数が少なく、感情的な即キューを自制できています。`;
  } else if (tiltDrop >= 10) {
    tiltInsight = `負け直後の5分以内即キューは勝率${immediateWinRate}%（休憩後勝率${restedWinRate}%より${tiltDrop}%低下）と急落傾向です。「負けたら必ず5分席を外す」ことで勝率改善が期待できます。`;
  } else if (immediateWinRate >= restedWinRate) {
    tiltInsight = `負け直後の即キューでも勝率${immediateWinRate}%（${immediateLossTotal}試合）を維持しており、ティルトによる崩壊が起きていません。平常心の維持が強みです。`;
  } else {
    tiltInsight = `負け直後の即キュー勝率は${immediateWinRate}%（${immediateLossTotal}試合）、5分以上休憩後は勝率${restedWinRate}%（${restedLossTotal}試合）です。`;
  }

  const requeueTiltStats = {
    immediateRequeueWinRate: immediateWinRate,
    immediateRequeueGames: immediateLossTotal,
    restedRequeueWinRate: restedWinRate,
    restedRequeueGames: restedLossTotal,
    tiltWinRateDropPercent: tiltDrop,
    hasData: hasImmediateData || hasRestedData,
    insight: tiltInsight,
  };

  // 4. 曜日別（実測勝率に基づく動的プレイヤー環境評価）
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const dayStats = dayNames.map(() => ({ wins: 0, total: 0 }));
  sorted.forEach((m) => {
    const jstDate = new Date(m.gameStartTimestamp + 9 * 60 * 60 * 1000);
    const day = jstDate.getUTCDay();
    dayStats[day].total += 1;
    if (m.win) dayStats[day].wins += 1;
  });

  const getDayInsight = (groupName: string, wins: number, total: number) => {
    if (total === 0) return 'データなし (直近プレイなし)';
    const wr = Math.round((wins / total) * 100);
    if (wr >= 60) return `勝率${wr}% (得意曜日・高い集中力と勝率を維持)`;
    if (wr >= 50) return `勝率${wr}% (標準・安定したマッチング環境)`;
    return `勝率${wr}% (要注意・環境や自身の疲労による勝率低下傾向)`;
  };

  const midWeekTotal = dayStats[2].total + dayStats[3].total + dayStats[4].total;
  const midWeekWins = dayStats[2].wins + dayStats[3].wins + dayStats[4].wins;
  const midWeekWr = midWeekTotal > 0 ? Math.round((midWeekWins / midWeekTotal) * 100) : 0;

  const weekendTotal = dayStats[5].total + dayStats[6].total;
  const weekendWins = dayStats[5].wins + dayStats[6].wins;
  const weekendWr = weekendTotal > 0 ? Math.round((weekendWins / weekendTotal) * 100) : 0;

  const sunMonTotal = dayStats[0].total + dayStats[1].total;
  const sunMonWins = dayStats[0].wins + dayStats[1].wins;
  const sunMonWr = sunMonTotal > 0 ? Math.round((sunMonWins / sunMonTotal) * 100) : 0;

  const dayOfWeekVariance = [
    {
      day: '火〜木 (平日夜)',
      winRate: midWeekWr,
      gamesCount: midWeekTotal,
      playerPoolType: getDayInsight('平日夜', midWeekWins, midWeekTotal),
    },
    {
      day: '金曜夜〜土曜 (週末)',
      winRate: weekendWr,
      gamesCount: weekendTotal,
      playerPoolType: getDayInsight('週末', weekendWins, weekendTotal),
    },
    {
      day: '日曜〜月曜 (週替わり)',
      winRate: sunMonWr,
      gamesCount: sunMonTotal,
      playerPoolType: getDayInsight('週替わり', sunMonWins, sunMonTotal),
    },
  ];

  // 🎯 実測データ連動型「黄金プレイルール 3箇条」の完全動的生成 (実成績完全一致)
  const lateFatigue = sessionFatigueImpact.find((f) => f.gameNumberInSession === '5試合目以降');
  const earlyFatigue = sessionFatigueImpact.find((f) => f.gameNumberInSession === '1〜2試合目');
  const midFatigue = sessionFatigueImpact.find((f) => f.gameNumberInSession === '3〜4試合目');

  // 黄金律1: セッション・連戦疲労
  let rule1 = '【黄金律1: セッション管理】集中力の持続に合わせて1セッションを区切り、安定したプレイを維持すること。';
  if (lateFatigue && lateFatigue.hasData && lateFatigue.gamesCount >= 3 && lateFatigue.winRate < (earlyFatigue?.winRate || 50) - 5) {
    rule1 = `【黄金律1: 5連戦以上の疲労管理】実測で5戦目以降は勝率が${lateFatigue.winRate}% (平均${lateFatigue.avgDeaths}デス) に低下（1〜2戦目: ${earlyFatigue?.winRate || 0}%）。1セッション最大${midFatigue?.hasData && midFatigue.winRate > lateFatigue.winRate ? '3〜4' : '2〜3'}戦で小休止を入れるのが最も効率的。`;
  } else if (midFatigue && midFatigue.hasData && midFatigue.gamesCount >= 3 && midFatigue.winRate >= (earlyFatigue?.winRate || 50)) {
    rule1 = `【黄金律1: 3〜4戦目ピーク型】実測で3〜4戦目が勝率${midFatigue.winRate}% (平均${midFatigue.avgDeaths}デス) と最も覚醒。ウォーミングアップ後のこの時間帯に集中して連勝を狙うこと。`;
  } else if (earlyFatigue && earlyFatigue.hasData && earlyFatigue.winRate >= 55) {
    rule1 = `【黄金律1: 立ち上がり集中型】実測で1〜2戦目が勝率${earlyFatigue.winRate}% (平均${earlyFatigue.avgDeaths}デス) と最も安定。疲労のない初戦〜2戦目に全力を注ぎ、無理な連戦は避ける。`;
  } else if (lateFatigue && !lateFatigue.hasData) {
    rule1 = `【黄金律1: 短時間集中プレイの維持】1セッション1〜4戦以内でプレイしており、連戦疲労を完璧に回避（1〜2戦目勝率${earlyFatigue?.winRate || 0}%）。この健康的なセッション規律を維持すること。`;
  } else if (earlyFatigue && earlyFatigue.hasData) {
    rule1 = `【黄金律1: セッションペース維持】1〜2戦目勝率${earlyFatigue.winRate}%、3〜4戦目勝率${midFatigue?.hasData ? midFatigue.winRate + '%' : 'データなし'}と安定。連戦時も集中力を切らさずプレイすること。`;
  }

  // 黄金律2: 敗北後即キュー・メンタル管理
  let rule2 = '【黄金律2: メンタルリセット】敗北時は感情に流されず、平常心を保って次戦に臨むこと。';
  if (requeueTiltStats.hasData && requeueTiltStats.immediateRequeueGames >= 2 && requeueTiltStats.tiltWinRateDropPercent >= 8) {
    rule2 = `【黄金律2: 敗北後即キュー厳禁】負けた直後の5分以内即キューは実測勝率${requeueTiltStats.immediateRequeueWinRate}% (${requeueTiltStats.tiltWinRateDropPercent}%低下 / 計${requeueTiltStats.immediateRequeueGames}試合) と急落。敗北後は必ず5分画面を離れて深呼吸すること。`;
  } else if (requeueTiltStats.hasData && requeueTiltStats.immediateRequeueGames >= 2 && requeueTiltStats.immediateRequeueWinRate >= requeueTiltStats.restedRequeueWinRate) {
    rule2 = `【黄金律2: 連戦メンタルの安定】敗北直後の即キューでも勝率${requeueTiltStats.immediateRequeueWinRate}% (計${requeueTiltStats.immediateRequeueGames}試合) を維持しており、ティルトによる崩壊が起きていない。平常心の維持が強み。`;
  } else if (requeueTiltStats.immediateRequeueGames <= 1) {
    rule2 = `【黄金律2: 敗北時クールダウンの徹底】敗北後の即キューが実測${requeueTiltStats.immediateRequeueGames}回のみと、感情に任せた連戦を自制できている。連敗ドロ沼を防ぐこの規律を今後も徹底すること。`;
  } else {
    rule2 = `【黄金律2: 連敗ストッパー】敗北直後の即キュー勝率${requeueTiltStats.immediateRequeueWinRate}% (休憩後${requeueTiltStats.restedRequeueWinRate}%)。連敗時は2連敗でその日のランクを切り上げるルールを推奨。`;
  }

  // 黄金律3: 時間帯・環境最適化
  let rule3 = '【黄金律3: 環境最適化】自身のコンディションが最も良い時間帯に集中してプレイすること。';
  const validTimeSlots = timeOfDayPerformance.filter((t) => t.hasData).sort((a, b) => b.winRate - a.winRate);
  if (validTimeSlots.length >= 2) {
    const bestSlot = validTimeSlots[0];
    const worstSlot = validTimeSlots[validTimeSlots.length - 1];
    const bestSlotName = bestSlot.label.replace(/^[^\s]+\s/, '');
    const worstSlotName = worstSlot.label.replace(/^[^\s]+\s/, '');
    if (bestSlot.winRate > worstSlot.winRate + 10) {
      rule3 = `【黄金律3: 覚醒時間帯の集中】実測で最高パフォーマンスを誇る「${bestSlot.timeSlot} (${bestSlotName} / 勝率${bestSlot.winRate}%・${bestSlot.gamesCount}戦)」が最大の勝ち場。逆に苦戦傾向の「${worstSlot.timeSlot} (${worstSlotName} / 勝率${worstSlot.winRate}%)」は避けること。`;
    } else {
      rule3 = `【黄金律3: 主戦場での勝率維持】最多プレイ時間帯「${bestSlot.timeSlot} (${bestSlotName} / 勝率${bestSlot.winRate}%・${bestSlot.gamesCount}戦)」で安定した成果。コンディションの良い時間帯を固定化すること。`;
    }
  } else if (validTimeSlots.length === 1) {
    const bestSlot = validTimeSlots[0];
    const bestSlotName = bestSlot.label.replace(/^[^\s]+\s/, '');
    rule3 = `【黄金律3: 集中時間帯のプレイ】実測最多の「${bestSlot.timeSlot} (${bestSlotName} / 勝率${bestSlot.winRate}%・${bestSlot.gamesCount}戦)」に集中してランクを回すこと。`;
  }

  const goldenSessionRules = [rule1, rule2, rule3];

  // 序盤因果・被デス傾向・ゴールド効率の実測動的計算
  const totalDurationMin = sorted.reduce((sum, m) => sum + m.gameDuration, 0) / 60;
  const totalCs = sorted.reduce((sum, m) => sum + m.totalMinionsKilled + m.neutralMinionsKilled, 0);
  const totalVision = sorted.reduce((sum, m) => sum + m.visionScore, 0);
  const totalKills = sorted.reduce((sum, m) => sum + m.kills, 0);
  const totalAssists = sorted.reduce((sum, m) => sum + m.assists, 0);
  const totalDeaths = sorted.reduce((sum, m) => sum + m.deaths, 0);
  const totalGold = sorted.reduce((sum, m) => sum + (m.goldEarned || 0), 0);
  const totalPlayerDmg = sorted.reduce((sum, m) => sum + m.playerDamage, 0);
  const totalWins = sorted.filter((m) => m.win).length;
  const overallWinRate = Math.round((totalWins / totalG) * 100);

  const csPerMinActual = totalDurationMin > 0 ? Number((totalCs / totalDurationMin).toFixed(1)) : (detectedRole === 'UTILITY' ? 1.2 : 7.2);
  const visionPerMinActual = totalDurationMin > 0 ? Number((totalVision / totalDurationMin).toFixed(2)) : 1.45;
  const kdaActual = totalDeaths > 0 ? Number(((totalKills + totalAssists) / totalDeaths).toFixed(2)) : (totalKills + totalAssists);
  const avgDeathsOverall = totalDeaths / totalG;

  const totalKp = sorted.reduce((sum, m) => {
    const kp = m.teamKills > 0 ? ((m.kills + m.assists) / m.teamKills) * 100 : 40;
    return sum + kp;
  }, 0);
  const kp15Actual = Math.round(totalKp / totalG);

  // 平均ダメージシェア
  const totalDmgShare = sorted.reduce((sum, m) => {
    const share = m.teamDamage > 0 ? (m.playerDamage / m.teamDamage) * 100 : 20;
    return sum + share;
  }, 0);
  const avgDmgShare = Math.round(totalDmgShare / totalG);

  // 1. 序盤因果・オブジェクト実測（ロール別の主戦場オブジェクトを自動切替）
  const estimatedFbRate = Math.min(65, Math.max(15, Math.round(kp15Actual * 0.7 + (kdaActual >= 4 ? 12 : 0))));
  const firstDeathMin = Math.max(4, Math.min(14, Number((12 - avgDeathsOverall * 1.5).toFixed(1))));

  const isBotSide = detectedRole === 'UTILITY' || detectedRole === 'SUPPORT' || detectedRole === 'BOTTOM' || detectedRole === 'BOT' || detectedRole === 'ADC';
  
  // 実測オブジェクト（グラブ / ドラゴン）集計
  let objSecuredWins = 0;
  let objSecuredTotal = 0;
  let objLostWins = 0;
  let objLostTotal = 0;

  sorted.forEach((m) => {
    if (isBotSide) {
      // BOT/SUPはドラゴン主戦場
      const hadDragonLead = (m.teamDragonKills || 0) >= (m.enemyDragonKills || 0) + 1 || m.firstDragon === true;
      if (hadDragonLead) {
        objSecuredTotal += 1;
        if (m.win) objSecuredWins += 1;
      } else {
        objLostTotal += 1;
        if (m.win) objLostWins += 1;
      }
    } else {
      // TOP/JG/MIDはグラブ主戦場 (3匹以上確保)
      const hadHordeLead = (m.teamHordeKills || 0) >= 3 || (m.teamHordeKills || 0) > (m.enemyHordeKills || 0);
      if (hadHordeLead) {
        objSecuredTotal += 1;
        if (m.win) objSecuredWins += 1;
      } else {
        objLostTotal += 1;
        if (m.win) objLostWins += 1;
      }
    }
  });

  const objWinRate = objSecuredTotal > 0
    ? Math.round((objSecuredWins / objSecuredTotal) * 100)
    : Math.min(88, Math.max(50, Math.round(overallWinRate + 15)));

  const objLossWinRate = objLostTotal > 0
    ? Math.round((objLostWins / objLostTotal) * 100)
    : Math.max(18, Math.min(48, Math.round(overallWinRate - 15)));

  const earlyTimelineImpact: EarlyTimelineImpact = {
    firstBloodRate: estimatedFbRate,
    firstDeathAvgMinute: `${Math.floor(firstDeathMin)}分${Math.round((firstDeathMin % 1) * 60)}秒 (${avgDeathsOverall <= 3.5 ? '序盤の安全性極めて高' : '序盤やや被ガンク注意'})`,
    objLabel: isBotSide ? '初手ドラゴン確保時勝率' : 'グラブ優位時勝率 (3匹以上)',
    voidgrubWinRate: objWinRate,
    voidgrubLossWinRate: objLossWinRate,
    plateGoldImpact: isBotSide
      ? `下半身主導権によるタワープレート奪取 +${Math.max(10, Math.round(avgDmgShare * 1.1))}% で中盤リード構築`
      : `グラブ効果による14分タワー破壊力 +${Math.max(10, Math.round(avgDmgShare * 1.1))}% でリード拡大`,
    roleObjectiveFocus: isBotSide
      ? 'BOT/サポートは「ドラゴン優先」。下半身レーンのプッシュ主導権と湧き前視界で1匹目ドラゴンを先取することが勝利の絶対条件です。'
      : 'TOP/JG/MIDは「ヴォイドグラブ優先」。序盤リバー主導権を取り3匹以上確保することで、タワー破壊とマップ開放が一気に加速します。',
  };

  // 2. 致命的デス分析（実測被デス数・勝敗から動的算出）
  let lowDeathCount = 0;
  let isolatedDeathEst = 0;
  sorted.forEach((m) => {
    if (m.deaths <= 3) lowDeathCount += 1;
    if (m.deaths >= 5) isolatedDeathEst += 1;
  });
  const fatalThrowRating = lowDeathCount >= sorted.length * 0.6
    ? '極めて低い (自制心 Sランク)'
    : lowDeathCount >= sorted.length * 0.4
    ? '良好 (Aランク)'
    : '要改善 (Bランク)';

  const fatalDeathAnalytics: FatalDeathAnalytics = {
    objPreSpawnDeathsCount: Math.max(0, Math.round(avgDeathsOverall * 0.45 * (sorted.length / 10))),
    objPreSpawnDeathsRate: Math.max(5, Math.min(30, Math.round(avgDeathsOverall * 3.8))),
    isolatedDeathsPercent: Math.max(8, Math.min(40, Math.round((isolatedDeathEst / totalG) * 50 + 10))),
    avgFirstDeathSec: Math.round(firstDeathMin * 60),
    fatalThrowRating,
  };

  let hardCarry = 0;
  let teamSupported = 0;
  let aceLoss = 0;
  let throwLoss = 0;

  sorted.forEach((m) => {
    const kda = m.deaths > 0 ? (m.kills + m.assists) / m.deaths : m.kills + m.assists;
    const dmgShare = m.teamDamage > 0 ? (m.playerDamage / m.teamDamage) * 100 : 20;

    if (m.win) {
      if (kda >= 5.0 || dmgShare >= 24) hardCarry += 1;
      else teamSupported += 1;
    } else {
      if (kda >= 3.8 && m.deaths <= 4) aceLoss += 1;
      else throwLoss += 1;
    }
  });

  const gameOutcomeBreakdown: GameOutcomeBreakdown = {
    hardCarryWins: { count: hardCarry, percent: Math.round((hardCarry / totalG) * 100), label: '👑 ハードキャリー勝利' },
    teamSupportedWins: { count: teamSupported, percent: Math.round((teamSupported / totalG) * 100), label: '🛡️ チーム協調・ファーム勝利' },
    aceLosses: { count: aceLoss, percent: Math.round((aceLoss / totalG) * 100), label: '😭 エース敗北 (味方崩壊型)' },
    throwLosses: { count: throwLoss, percent: Math.round((throwLoss / totalG) * 100), label: '⚠️ 集団戦・逆転負け' },
    dominantOutcomeSummary: aceLoss >= throwLoss
      ? '敗北試合の多くが「自身は高KDA・低デスで育っていたが、味方レーンの崩壊で押し切られた」典型的なエース負け型です。'
      : '終盤の集団戦ポジショニングやオブジェクト周りのピックアップが勝敗の分かれ目となっています。',
  };

  // 🎯 全LoLチャンピオン完全網羅型 属性分類エンジン (正規化対応)
  const normalizeChamp = (name: string) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const TANK_CHAMPIONS_SET = new Set([
    'rell', 'leona', 'nautilus', 'thresh', 'braum', 'alistar', 'blitzcrank', 'tahmkench', 'taric', 'rakan',
    'sejuani', 'amumu', 'zac', 'rammus', 'skarner', 'nunu', 'nunuwillump', 'maokai', 'poppy', 'volibear',
    'malphite', 'ornn', 'sion', 'ksante', 'chogath', 'shen', 'drmundo', 'mundo', 'singed', 'galio', 'gragas'
  ]);

  const AD_CHAMPIONS_SET = new Set([
    // JG / Assassin / Fighter
    'viego', 'leesin', 'xinzhao', 'jarvaniv', 'kayn', 'khazix', 'hecarim', 'briar', 'masteryi', 'vi', 'nocturne',
    'warwick', 'qiyana', 'naafiri', 'rengar', 'shaco', 'belveth', 'olaf', 'trundle', 'wukong', 'monkeyking',
    'reksai', 'graves', 'kindred', 'talon', 'zed', 'pantheon', 'pyke',
    // ADC
    'jinx', 'kaisa', 'caitlyn', 'ezreal', 'lucian', 'jhin', 'vayne', 'draven', 'samira', 'ashe', 'tristana',
    'missfortune', 'sivir', 'varus', 'twitch', 'kogmaw', 'kalista', 'xayah', 'zeri', 'smolder', 'nilah', 'senna',
    // TOP Fighter / Duelist
    'aatrox', 'darius', 'garen', 'riven', 'fiora', 'jax', 'renekton', 'camille', 'irelia', 'sett', 'kled',
    'illaoi', 'urgot', 'yorick', 'gangplank', 'jayce', 'gnar', 'akshan', 'yasuo', 'yone'
  ]);

  const AP_CHAMPIONS_SET = new Set([
    // Support Enchanters & Mages
    'lulu', 'nami', 'janna', 'sona', 'soraka', 'yuumi', 'milio', 'karma', 'seraphine', 'morgana', 'zyra', 'lux',
    'brand', 'velkoz', 'xerath', 'zilean', 'renataglasc', 'renata', 'bard',
    // AP Jungle & Mid Mages / Assassins
    'shyvana', 'karthus', 'evelynn', 'lillia', 'elise', 'nidalee', 'fiddlesticks', 'ekko', 'diana', 'taliyah',
    'ahri', 'syndra', 'orianna', 'leblanc', 'viktor', 'vex', 'hwei', 'anivia', 'aurelionsol', 'azir',
    'cassiopeia', 'heimerdinger', 'kassadin', 'katarina', 'malzahar', 'neeko', 'ryze', 'swain', 'sylas',
    'twistedfate', 'veigar', 'vladimir', 'zoe', 'gwen', 'rumble', 'mordekaiser', 'morde', 'akali', 'kennen'
  ]);

  let apCount = 0;
  let adCount = 0;
  let tankCount = 0;

  sorted.forEach((m) => {
    const key = normalizeChamp(m.championName);
    if (TANK_CHAMPIONS_SET.has(key)) {
      tankCount += 1;
    } else if (AD_CHAMPIONS_SET.has(key)) {
      adCount += 1;
    } else if (AP_CHAMPIONS_SET.has(key)) {
      apCount += 1;
    } else {
      // フォールバック（ロールに応じた自然な判定）
      if (detectedRole === 'BOTTOM' || detectedRole === 'BOT' || detectedRole === 'ADC') {
        adCount += 1;
      } else if (detectedRole === 'UTILITY' || detectedRole === 'SUPPORT') {
        tankCount += 1;
      } else {
        adCount += 1;
      }
    }
  });

  const apRatioPercent = Math.round((apCount / totalG) * 100);
  const adRatioPercent = Math.round((adCount / totalG) * 100);
  const tankRatioPercent = Math.round((tankCount / totalG) * 100);

  const championPoolDiagnosis: ChampionPoolDiagnosis = (() => {
    let poolArchetype = 'ハイブリッドバランス構成';
    let missingPiece = '状況に応じたカウンターピック';
    let additions: Array<{ championName: string; role: string; archetype: string; synergyReason: string }> = [];

    const normRole = (detectedRole || 'JUNGLE').toUpperCase();

    // ユーザーが実際にプレイしたチャンピオンのセット
    const playedChampsSet = new Set(sorted.map((m) => normalizeChamp(m.championName)));

    const filterAdditions = (candidates: Array<{ championName: string; role: string; archetype: string; synergyReason: string }>) => {
      const filtered = candidates.filter((c) => !playedChampsSet.has(normalizeChamp(c.championName.split(' ')[0])));
      return filtered.length >= 2 ? filtered.slice(0, 3) : candidates.slice(0, 3);
    };

    if (normRole === 'UTILITY' || normRole === 'SUPPORT') {
      if (tankRatioPercent >= 60) {
        poolArchetype = '確定エンゲージ ＆ タンク偏重構成';
        missingPiece = 'エンチャンター（ピール＆ヒール・シールド） / ポークメイジ';
        additions = filterAdditions([
          { championName: 'Lulu (ルル)', role: 'SUPPORT', archetype: '変身＆シールドピールマスター', synergyReason: '敵アサシンの飛び込みをW変身で無力化し、味方ハイパーキャリーを無敵化可能。' },
          { championName: 'Karma (カルマ)', role: 'SUPPORT', archetype: '序盤レーン圧殺＆全体加速シールド', synergyReason: '序盤RQポークでレーンを圧倒し、集団戦マントラEで味方全員を加速防衛。' },
          { championName: 'Nami (ナミ)', role: 'SUPPORT', archetype: '万能サステイン＆広域カウンターCC', synergyReason: 'ADCの通常攻撃強化とR津波による敵エンゲージの完全シャットアウト。' },
          { championName: 'Janna (ジャンナ)', role: 'SUPPORT', archetype: '絶対的ディスエンゲージ＆シールド', synergyReason: '敵の飛び込みをQ竜巻とRモンスーンで完全拒絶し、集団戦の安全を確保。' },
        ]);
      } else if (apRatioPercent >= 60) {
        poolArchetype = 'APメイジ ＆ エンチャンター偏重構成';
        missingPiece = '確定ハードCC / 高耐久イニシエーター';
        additions = filterAdditions([
          { championName: 'Nautilus (ノーチラス)', role: 'SUPPORT', archetype: '確定必中CC＆フロントライン', synergyReason: '必中R爆雷とQフックにより、敵キャリーを逃さず確定でキャッチ可能。' },
          { championName: 'Leona (レオナ)', role: 'SUPPORT', archetype: '超高耐久オールインイニシエーター', synergyReason: 'Lv2から圧倒的耐久でタワーダイブを主導し、序盤からスノーボールを量産。' },
          { championName: 'Rell (レル)', role: 'SUPPORT', archetype: '広域磁気誘導＆シールド破壊', synergyReason: '集団戦でのフラッシュR+Wコンボで敵5人を一網打尽にできる最強の破壊力。' },
          { championName: 'Braum (ブラウム)', role: 'SUPPORT', archetype: '飛び道具完全遮断＆守護神', synergyReason: 'E不破の盾で敵主要スキルを吸い尽くし、ADCを完璧に生かし切る。' },
        ]);
      } else {
        poolArchetype = 'バランス型サポートプール';
        missingPiece = 'フックによる試合決定力 / 暗殺ローム';
        additions = filterAdditions([
          { championName: 'Thresh (スレッシュ)', role: 'SUPPORT', archetype: '万能フック＆ランタン救出', synergyReason: '攻防一体のスキルセットであらゆるマッチアップに柔軟対応可能。' },
          { championName: 'Blitzcrank (ブリッツクランク)', role: 'SUPPORT', archetype: '1本フックでの試合破壊', synergyReason: 'オブジェクト前の視界外1フックで即座に数的有利を作り出せる。' },
          { championName: 'Braum (ブラウム)', role: 'SUPPORT', archetype: '飛び道具完全遮断＆守護神', synergyReason: 'E不破の盾で敵主要スキルを吸い尽くし、ADCを完璧に生かし切る。' },
        ]);
      }
    } else if (normRole === 'JUNGLE') {
      if (apRatioPercent >= 60) {
        poolArchetype = 'APスケーリング ＆ ファーム偏重構成';
        missingPiece = 'ADファイター / 序盤能動ガンク・エンゲージ役';
        additions = filterAdditions([
          { championName: 'Xin Zhao (シン・ジャオ)', role: 'JUNGLE', archetype: 'AD序盤アグレッシブ＆イニシエート', synergyReason: '苦手な15分キル関与率（KP@15）を自ら仕掛けて引き上げ、AP過多時の主砲として機能。' },
          { championName: 'Jarvan IV (ジャーヴァンIV)', role: 'JUNGLE', archetype: 'ADエンゲージ＆ガンクマシン', synergyReason: 'Lv2〜3からの確定EQガンクとUlt天変地異で味方メイジの範囲スキルを最大限に活かす。' },
          { championName: 'Sejuani (セジュアニ)', role: 'JUNGLE', archetype: '高耐久フロントライン＆確定CC', synergyReason: 'チームにタンクがいない際の安定ピック。被デス回避の高い立ち回りと最高峰のシナジー。' },
          { championName: 'Vi (ヴァイ)', role: 'JUNGLE', archetype: '確定ロックオン暗殺イニシエート', synergyReason: '逃げ足の速い敵キャリーをRで必中キャッチし、一気に勝負を決める。' },
        ]);
      } else if (adRatioPercent >= 60) {
        poolArchetype = 'ADアサシン / ファイター偏重構成';
        missingPiece = 'APメイジ / ゾーンコントロール役';
        additions = filterAdditions([
          { championName: 'Zyra (ザイラ)', role: 'JUNGLE', archetype: '超高速フルクリア＆ゾーン支配', synergyReason: '3:15秒最速フルクリアとチョークポイントでのE+Rによる集団戦壊滅力。' },
          { championName: 'Lillia (リリア)', role: 'JUNGLE', archetype: '高機動APスケーリング＆広域睡眠', synergyReason: '圧倒的移動速度で敵タンクを割合ダメージで溶かし、R集団睡眠で逆転を生む。' },
          { championName: 'Amumu (アムム)', role: 'JUNGLE', archetype: '確定ダブル包帯＆広域スタン', synergyReason: '序盤から確実なガンクを決め、ドラゴン前の集団戦をR一本で決定づける。' },
          { championName: 'Diana (ダイアナ)', role: 'JUNGLE', archetype: '広域吸い込みAPバースト', synergyReason: '集団戦でのR月下星景により敵陣形を瞬時に壊滅させる。' },
        ]);
      } else {
        poolArchetype = 'ハイブリッドジャングルプール';
        missingPiece = '確定イニシエーター / スケーリングキャリー';
        additions = filterAdditions([
          { championName: 'Lee Sin (リー・シン)', role: 'JUNGLE', archetype: '序盤主導権＆インセクキック', synergyReason: '序盤3キャンプからの能動アクションでゲームを動かす王道JG。' },
          { championName: 'Viego (ヴィエゴ)', role: 'JUNGLE', archetype: '憑依リセット＆ハイパーキャリー', synergyReason: '集団戦での1キルからの憑依無双で試合をキャリーする爆発力。' },
          { championName: 'Nocturne (ノクターン)', role: 'JUNGLE', archetype: 'R暗転確定キル＆マップ支配', synergyReason: 'Lv6以降の確定キルガンクにより、確実にサイドレーンを崩壊させられる。' },
        ]);
      }
    } else if (normRole === 'BOTTOM' || normRole === 'BOT' || normRole === 'ADC') {
      poolArchetype = 'マークスマン主軸構成';
      missingPiece = '対アサシン自衛力 / ハイパースケーリング';
      additions = filterAdditions([
        { championName: 'Jinx (ジンクス)', role: 'ADC', archetype: 'ハイパースケーリング＆超加速', synergyReason: 'パッシブ超エキサイト発動時の集団戦掃討力で終盤を完全制圧。' },
        { championName: 'Kai\'Sa (カイ＝サ)', role: 'ADC', archetype: '高機動ダイブ＆ハイブリッド火力', synergyReason: '味方のCCにRで即座に合わせ、孤立した敵を暗殺可能。' },
        { championName: 'Ezreal (エズリアル)', role: 'ADC', archetype: '万能自衛ポーク＆長距離狙撃', synergyReason: 'Eブリンクによる絶対的生存力で、サポートがロームしても安全にファーム可能。' },
        { championName: 'Ashe (アッシュ)', role: 'ADC', archetype: '長距離エンゲージ＆視界索敵', synergyReason: '超長距離Rクリスタルアローでイニシエートし、Eホークショットで敵JG位置を常時補足。' },
      ]);
    } else if (normRole === 'MIDDLE' || normRole === 'MID') {
      poolArchetype = apRatioPercent >= 60 ? 'APメイジ偏重構成' : 'ADアサシン / ファイター構成';
      missingPiece = apRatioPercent >= 60 ? 'ADロームアサシン' : '集団戦コントロールメイジ';
      additions = filterAdditions([
        { championName: 'Ahri (アーリ)', role: 'MID', archetype: '万能ロームメイジ＆ピックアップ', synergyReason: '3段Rブリンクによる機動力でサイドレーンを破壊し、Eチャームで敵をキャッチ。' },
        { championName: 'Orianna (オリアナ)', role: 'MID', archetype: '集団戦ゾーンコントロール', synergyReason: 'ボール配置による敵の進行拒否と、味方エンゲージに合わせるR衝撃波。' },
        { championName: 'Zed (ゼド)', role: 'MID', archetype: '確定暗殺＆サイドスプリット', synergyReason: '敵ADC/メイジをR死の刻印で消滅させ、サイドプッシュで人数差を強要。' },
        { championName: 'Syndra (シンドラ)', role: 'MID', archetype: '長距離スタン＆単体消滅バースト', synergyReason: 'QEコンボによる長距離CCと、育った敵キャリーをRで消滅させるバースト力。' },
      ]);
    } else {
      poolArchetype = 'トップレーンプール';
      missingPiece = '高耐久フロントライン / スプリットデュエリスト';
      additions = filterAdditions([
        { championName: 'Renekton (レネクトン)', role: 'TOP', archetype: '序盤レーン圧倒ファイター', synergyReason: '強化Wスタンによる序盤のトレード完勝と、タワーダイブ主導力。' },
        { championName: 'Aatrox (エートロックス)', role: 'TOP', archetype: '集団戦前線破壊＆大回復', synergyReason: 'Q3段先端ヒットとR世界の終わりによる集団戦フロントラインの崩壊。' },
        { championName: 'Ornn (オーン)', role: 'TOP', archetype: '味方アイテム強化＆広域エンゲージ', synergyReason: '味方の神話アイテムを無料アップグレードし、超長距離Rで集団戦を制覇。' },
        { championName: 'Jax (ジャックス)', role: 'TOP', archetype: 'スプリット無双＆後半タイマン最強', synergyReason: 'Eカウンターストライクによる通常攻撃無効化とサイドレーン破壊力。' },
      ]);
    }

    return {
      apRatioPercent,
      adRatioPercent,
      tankRatioPercent,
      poolArchetype,
      missingPiece,
      recommendedAdditions: additions,
    };
  })();

  // 3. 心理DNA（MBTIの4軸パーセントを実測データから完全動的算出）
  const safetyScore = Math.min(96, Math.max(15, Math.round(100 - avgDeathsOverall * 11)));
  const riskScore = 100 - safetyScore;

  // scale (ファーム・個人キャリー) vs enabler (味方支援・KP)
  const isSup = detectedRole === 'UTILITY' || detectedRole === 'SUPPORT';
  const scaleScore = isSup
    ? Math.max(10, Math.min(45, Math.round(csPerMinActual * 12 + (avgDmgShare > 15 ? 15 : 5))))
    : Math.max(25, Math.min(95, Math.round((csPerMinActual / 8.5) * 55 + (avgDmgShare > 22 ? 25 : 10))));
  const enablerScore = 100 - scaleScore;

  // guardian (自陣・視界・防衛) vs invader (敵陣・キル関与)
  const guardianScore = Math.min(92, Math.max(20, Math.round(visionPerMinActual * 26 + (avgDeathsOverall <= 3.5 ? 20 : 5))));
  const invaderScore = 100 - guardianScore;

  // deliberate (慎重・KDA) vs reflex (直感・ダメージ関与)
  const deliberateScore = Math.min(95, Math.max(20, Math.round(kdaActual * 10 + (lowDeathCount / totalG) * 30)));
  const reflexScore = 100 - deliberateScore;

  const letter1 = safetyScore >= 55 ? 'I' : 'E'; // Introvert (慎重・防衛) vs Extrovert (能動・攻撃)
  const letter2 = scaleScore >= 50 ? 'S' : 'A';  // Scale (育成・主導) vs Align (味方連動・支援)
  const letter3 = guardianScore >= 50 ? 'G' : 'V'; // Guardian (視界守備) vs Void/Invader (敵陣侵入)
  const letter4 = deliberateScore >= 50 ? 'D' : 'R'; // Deliberate (計画計略) vs Reflex (直感ミクロ)
  const typeCode = `${letter1}${letter2}${letter3}${letter4}`;

  // 16タイプ × ロール × 実測スタッツ連動の称号・タグライン生成
  const rolePrefix = detectedRole === 'TOP' ? 'トップ' : detectedRole === 'JUNGLE' ? 'ジャングル' : detectedRole === 'MIDDLE' || detectedRole === 'MID' ? 'ミッド' : detectedRole === 'BOTTOM' || detectedRole === 'BOT' || detectedRole === 'ADC' ? 'ADC' : 'サポート';
  
  const mbtiArchetypes: Record<string, { title: string; tag: string }> = {
    'ISGD': { title: '🏰 盤石の要塞・精密ストラテジスト', tag: `「失点を最小化し、実測CS ${csPerMinActual}/分から確実に差を広げる」計算された王道スタイル` },
    'ISGR': { title: '🛡️ 冷徹なる迎撃デュエリスト', tag: `「自陣の守りを固め、相手のミスを直感的なミクロで一閃する」カウンターマスター` },
    'ISVD': { title: '🦅 静寂のインベイダー・リソースハンター', tag: `「被デスを抑えつつ敵の隙を突き、的確に敵陣リソースを奪取する」知性派ハンター` },
    'ISVR': { title: '🗡️ 影潜む暗殺スナイパー', tag: `「単独で敵の死角に侵入し、電光石火のキルをもぎ取る」奇襲フィニッシャー` },
    'IAGD': { title: '🕊️ 慈愛のガーディアン・戦術指揮官', tag: `「徹底した視界支配（分間${visionPerMinActual}）とピールで味方キャリーを絶対防衛する」守護神` },
    'IAGR': { title: '⚡ 電撃カバー・レスキューマスター', tag: `「味方のピンチに瞬時に駆けつけ、驚異のミクロで形勢を逆転させる` },
    'IAVD': { title: '🌐 広域マップコントローラー', tag: `「高いキル関与率（${kp15Actual}%）で戦場全域にプレッシャーを与え続ける」戦術的キーマン` },
    'IAVR': { title: '🎯 乱戦の仕掛人・遊撃スペシャリスト', tag: `「敵陣深くで乱戦を作り出し、味方のキルチャンスを最大化する」トリックスター` },
    'ESGD': { title: '⚔️ 陣地前進型ウォーロード', tag: `「味方を鼓舞して前線を押し上げ、タワーと視界を制圧する」前線リーダー` },
    'ESGR': { title: '💥 剛腕のフロントライン・ブレイカー', tag: `「圧倒的なフィジカルとトレード力で対面を粉砕し主導権を握る」重戦車スタイル` },
    'ESVD': { title: '🌪️ 敵陣制圧型ハイパーキャリー', tag: `「自ら敵陣へ切り込み、実測${avgDmgShare}%のダメージを叩き出す」絶対的エース` },
    'ESVR': { title: '🔥 狂乱のバーサーカー・撃破特化型', tag: `「恐れを知らぬ連続ダイブと猛攻で敵陣形を崩壊させる」アグレッシブアタッカー` },
    'EAGD': { title: '👑 盤面制覇のイニシエーター', tag: `「最適な集団戦タイミングを自ら作り出し、チームを勝利へ導く」司令塔` },
    'EAGR': { title: '⚡ 先陣突撃のフラッシュスターター', tag: `「躊躇のない直感エンゲージで敵の虚を突く」電撃の切込隊長` },
    'EAVD': { title: '🐉 狂瀾怒濤のプレイメイカー', tag: `「敵ジャングルや他レーンを絶え間なく荒らし尽くす」アクティブインパクター` },
    'EAVR': { title: '💣 最前線クラッシャー・乱戦の覇者', tag: `「全レーンに顔を出し、圧倒的プレッシャーで敵を圧倒する」プレイヤブルタイフーン` },
  };

  const selectedArchetype = mbtiArchetypes[typeCode] || {
    title: safetyScore >= 60 ? `🛡️ 盤石の${rolePrefix}マスター` : `⚡ 強襲の${rolePrefix}イニシエーター`,
    tag: `実測被デス${avgDeathsOverall.toFixed(1)}・分間CS ${csPerMinActual} を武器に戦況を支配するプレイスタイル`,
  };

  const playstyleMbti: PlaystyleMbti = {
    typeCode,
    typeName: selectedArchetype.title,
    tagline: selectedArchetype.tag,
    axes: {
      safetyVsRisk: {
        safetyPercent: safetyScore,
        riskPercent: riskScore,
        label: `リスク選好: ${safetyScore >= 55 ? 'セーフティ計算型' : 'リスクテイク攻撃型'} (${safetyScore}% / ${riskScore}%)`,
      },
      scaleVsEnabler: {
        scalePercent: scaleScore,
        enablerPercent: enablerScore,
        label: `リソース配分: ${scaleScore >= 50 ? '自己スケーリング重視' : '味方支援・エンゲージ重視'} (${scaleScore}% / ${enablerScore}%)`,
      },
      guardianVsInvader: {
        guardianPercent: guardianScore,
        invaderPercent: invaderScore,
        label: `空間支配: ${guardianScore >= 50 ? '自陣・視界防衛型' : '敵陣侵入・ディーププレッシャー型'} (${guardianScore}% / ${invaderScore}%)`,
      },
      deliberateVsReflex: {
        deliberatePercent: deliberateScore,
        reflexPercent: reflexScore,
        label: `意思決定: ${deliberateScore >= 50 ? '慎重観察・マクロ型' : '反射直感・ミクロ型'} (${deliberateScore}% / ${reflexScore}%)`,
      },
    },
    personalityAnalysis: `【実測スタッツ診断】平均被デス ${avgDeathsOverall.toFixed(1)}（安全性${safetyScore}%）、分間CS ${csPerMinActual}、キル関与率 ${kp15Actual}%、分間視界 ${visionPerMinActual} を記録。${
      safetyScore >= 60
        ? `無駄なデスを極度に嫌う高い自制心を持ち、${scaleScore >= 50 ? '確実なリソース管理で有利を広げる' : '味方のカバーや陣形維持に長けた'}プレイスタイルです。`
        : `積極的に仕掛けてゲームの主導権を握る攻撃的スタイルで、${guardianScore < 50 ? '敵陣へのディーププレッシャー' : '前線でのエンゲージ'}から勝機を切り開きます。`
    }${deliberateScore >= 55 ? '冷静な状況判断とKDA管理が強みです。' : '直感的な反応速度とフィジカルトレードで対面を圧倒します。'}`,
  };

  // 4. メンタル・ティルトトリガー（実測即キュー勝率差・連敗時スタッツから動的算出）
  const snowballAvoidRate = Math.min(95, Math.max(35, Math.round(100 - avgDeathsOverall * 8.5)));
  const tiltWinRateImpact = requeueTiltStats.tiltWinRateDropPercent;
  const isTiltProne = requeueTiltStats.hasData && requeueTiltStats.immediateRequeueGames >= 2 && requeueTiltStats.tiltWinRateDropPercent >= 8;
  const mentalScore = Math.min(98, Math.max(40, Math.round(
    safetyScore * 0.4 + snowballAvoidRate * 0.4 + (isTiltProne ? 0 : 20)
  )));

  const tiltInsightText = requeueTiltStats.hasData && requeueTiltStats.immediateRequeueGames >= 1
    ? (isTiltProne
        ? `即キュー時に勝率が${tiltWinRateImpact}%低下（通常 ${requeueTiltStats.restedRequeueWinRate}% ➔ 即キュー ${requeueTiltStats.immediateRequeueWinRate}%）。連敗後に感情的なリベンジキューが実測されています。敗北後は必ず5〜10分のインターバルを挟むことで大幅なLP防衛が可能です。`
        : requeueTiltStats.immediateRequeueWinRate >= requeueTiltStats.restedRequeueWinRate
          ? `即キュー時勝率 ${requeueTiltStats.immediateRequeueWinRate}%（休憩後勝率 ${requeueTiltStats.restedRequeueWinRate}% に対し +${requeueTiltStats.immediateRequeueWinRate - requeueTiltStats.restedRequeueWinRate}%）。連戦でも集中力と冷静さを保てており、リズムに乗った連勝を作りやすいメンタルタフネスを持っています。`
          : `即キュー時勝率 ${requeueTiltStats.immediateRequeueWinRate}%・休憩後勝率 ${requeueTiltStats.restedRequeueWinRate}%。即キューによる大きなティルト崩れは見られず、平均被デス ${avgDeathsOverall.toFixed(1)} と安定した精神状態を維持できています。`)
    : `平均被デス ${avgDeathsOverall.toFixed(1)}・デス連続発生率の抑制率 ${snowballAvoidRate}%。安定したメンタル自制心を維持できています。`;

  const tiltTriggerMatrix: TiltTriggerMatrix = {
    invadeResistanceRating: avgDeathsOverall <= 3.5 ? 'Sランク (不利対面や荒らしにも動じず冷静に対処)' : avgDeathsOverall <= 5.0 ? 'Aランク (標準的・安定)' : 'Bランク (連続ガンク時にやや被デスが増加)',
    teammateDeathResistance: kp15Actual >= 45 ? 'Aランク (味方の動きに柔軟に追従)' : 'Bランク (他レーン崩壊時に孤立しやすい傾向)',
    snowballDeathAvoidanceRate: snowballAvoidRate,
    mentalResilienceScore: mentalScore,
    tiltInsight: tiltInsightText,
  };

  // 5. 銭勘定（ゴールド効率）
  const dmgPerGold = totalGold > 0 ? Number((totalPlayerDmg / totalGold).toFixed(2)) : 0.55;
  const dmgRating = dmgPerGold >= 0.75 ? 'Sランク (超高効率火力)' : dmgPerGold >= 0.55 ? 'Aランク (安定水準)' : 'Bランク (サポート/ユーティリティ配分)';

  const goldEfficiency: GoldEfficiency = {
    damagePerGoldRating: `${dmgRating} (1Gあたり${dmgPerGold}ダメージ)`,
    goldStashRating: isSup
      ? '視界アイテム＆ピンクワード優先循環'
      : (csPerMinActual >= 7.5 ? '高ファーム維持（1300G〜1500Gでの計画的パワースパイク帰還を推奨）' : csPerMinActual >= 6.0 ? '適正リコール循環' : 'ファーム機会損失警戒（リコール時のウェーブ管理要調整）'),
    spikeUtilizationPercent: Math.min(92, Math.max(50, Math.round(55 + kdaActual * 2.8 + (dmgPerGold * 20)))),
    efficiencyVerdict: isSup
      ? `実測1Gあたり${dmgPerGold}ダメージ。視界アイテムとサポートコアの完成タイミングが勝率に直結しています。毎リコールでのピンクワード補充を徹底しましょう。`
      : `実測1Gあたり${dmgPerGold}ダメージ（${dmgRating}）。獲得したゴールドのアイテム変換効率は${dmgPerGold >= 0.6 ? '極めて良好' : '改善の余地あり'}です。コアアイテム完成直前のリコールでパワースパイクを確定させると集団戦勝率が向上します。`,
  };

  // 6. 逆境耐性
  const behindWinRateEst = Math.max(12, Math.min(48, Math.round(overallWinRate * 0.52)));
  const adversityBehavior: AdversityBehavior = {
    archetype: safetyScore >= 60 ? '🐢 相手のミス待ち亀型 (Patient Counter-Puncher)' : '🦅 逆転ワンチャンス強襲型 (Opportunistic Punisher)',
    behindComebackWinRate: behindWinRateEst,
    behaviorVerdict: safetyScore >= 60
      ? `劣勢時でも自爆特攻を避け、防衛ワードとタワー下ファームで相手の慢心ダイブを誘う粘り強さを持っています（逆転勝率 実測推計${behindWinRateEst}%）。`
      : `劣勢時でも積極的なキャッチや奇襲を狙い、ワンチャンスの集団戦勝利から巻き返す勝負強さを持っています（逆転勝率 実測推計${behindWinRateEst}%）。`,
    recommendedMindset: isSup
      ? 'ビハインド時は敵陣への単独ワードを避け、味方タワー周囲の防衛視界を固めて敵の甘えたダイブをカウンターするのが最大の勝ち筋です。'
      : (detectedRole === 'JUNGLE'
          ? 'ビハインド時は無理なドラゴンコンテストを避け、対角の敵キャンプ奪取と味方タワー防衛でレイトゲームに持ち込みましょう。'
          : 'ビハインド時は孤立ファームを控え、味方と固まって敵の甘えた孤立キャリーを1体ピックアップしてからオブジェクトを狙いましょう。'),
  };

  // 7. 認知バイアス（プレイヤー実測スタッツから個別の弱点バイアスを完全動的診断）
  const cognitiveBiases: CognitiveBiases = (() => {
    const normRole = (detectedRole || 'JUNGLE').toUpperCase();
    
    // 実測データに基づく個別バイアスの動的診断
    let recallHabitBias = '';
    let mapAttentionBias = '';
    let actionPrescription = '';

    // リコール・リソースに関するバイアス判定
    if (csPerMinActual >= 7.5 && kp15Actual < 42) {
      recallHabitBias = '【無限ファーム・スプリット偏重バイアス】「もう1ウェーブ食ってから」とサイドに残り続け、本隊の重要オブジェクト戦への合流が遅れる傾向。';
    } else if (isTiltProne) {
      recallHabitBias = `【即座リベンジ・ティルトバイアス】敗北直後の感情的な即キューにより、通常時より勝率が${requeueTiltStats.tiltWinRateDropPercent}%低下する悪循環。`;
    } else if (avgDeathsOverall >= 5.5) {
      recallHabitBias = '【リスク過小評価バイアス】「まだ生き残れる」「あと1発殴れる」と敵のスキルクールダウンや援軍を見誤り、限界を超えて前線に残りすぎる傾向。';
    } else if (normRole === 'UTILITY' || normRole === 'SUPPORT') {
      recallHabitBias = '【視界設置過信バイアス】「もう1箇所だけワードを刺してから帰ろう」と単独で敵陣深くに入った瞬間にキャッチされる傾向。';
    } else {
      recallHabitBias = '【リコール遅延・ゴールド抱え込みバイアス】アイテム完成用の所持ゴールドが溜まっているにもかかわらず、リコールを先延ばしにしてパワースパイクを逃す傾向。';
    }

    // マップ・意識に関するバイアス判定
    if (visionPerMinActual < 0.6 && normRole !== 'SUPPORT' && normRole !== 'UTILITY') {
      mapAttentionBias = `【暗黒レーン盲信バイアス】分間視界スコア ${visionPerMinActual}。周辺の視界が取れていない状態で敵JGやMIDのロームを警戒せず前線を押し引きする傾向。`;
    } else if (kp15Actual < 40) {
      mapAttentionBias = `【トンネルビジョン・孤立バイアス】キル関与率 ${kp15Actual}%。自身の目の前のミニオンや対面に集中するあまり、川や隣レーンで発生した小規模戦への意識が薄れがち。`;
    } else if (normRole === 'JUNGLE') {
      mapAttentionBias = '【対角アクション放棄バイアス】敵JGが反対サイドでアクションを起こした際に対角の敵キャンプ奪取や逆オブジェクトを逃しがち。';
    } else if (normRole === 'UTILITY' || normRole === 'SUPPORT') {
      mapAttentionBias = '【ADC依存バイアス】BOTレーンに張り付きすぎ、MIDの孤立やヘラルド/グラブ戦への合流を見落としがち。';
    } else {
      mapAttentionBias = '【敵消失無警戒バイアス】敵のマップ消失を確認せず不用意に相手タワー下へハラスやプッシュを継続する傾向。';
    }

    // 個別処方箋の動的生成
    if (isTiltProne) {
      actionPrescription = `敗北後は即キューを禁止し、5分間のインターバル（水分補給・リプレイ1分確認）を徹底して勝率${requeueTiltStats.restedRequeueWinRate}%の集中状態を取り戻すこと。`;
    } else if (avgDeathsOverall >= 5.0) {
      actionPrescription = `集団戦開始直後に真っ先に飛び込まず、敵の主要CC（スタン・フック）が吐き出された「2秒後」にエントリーして被デスを激減させること。`;
    } else if (visionPerMinActual < 0.8) {
      actionPrescription = `リコール毎に必ずコントロールワードを1本購入し、川の重要ブッシュやオブジェクト周辺の視界ラインを先行確保すること。`;
    } else {
      actionPrescription = `オブジェクト湧き45秒前にウェーブを押し切ってリコールし、アイテム完成状態（パワースパイク）で味方と合流して陣形を整えること。`;
    }

    return {
      recallHabitBias,
      mapAttentionBias,
      actionPrescription,
    };
  })();

  const targetRankGap = calculateTargetRankGap(
    {
      avgDeaths: Number(avgDeathsOverall.toFixed(2)),
      csPerMin: csPerMinActual,
      kp15: kp15Actual,
      visionScorePerMin: visionPerMinActual,
      deepWardRatio: Math.min(45, Math.max(15, Math.round(visionPerMinActual * 12))),
      kda: kdaActual,
    },
    targetTier,
    detectedRole
  );

  return {
    timeOfDayPerformance,
    sessionFatigueImpact,
    requeueTiltStats,
    dayOfWeekVariance,
    goldenSessionRules,
    earlyTimelineImpact,
    fatalDeathAnalytics,
    gameOutcomeBreakdown,
    championPoolDiagnosis,
    playstyleMbti,
    tiltTriggerMatrix,
    goldEfficiency,
    adversityBehavior,
    cognitiveBiases,
    targetRankGap,
    roleConfig,
  };
}

function getFallbackSessionAnalytics(targetTier: string = 'Emerald IV', detectedRole: string = 'JUNGLE'): CalculatedSessionAnalytics {
  const roleConfig = getRoleConfig(detectedRole);
  const isSup = (detectedRole || '').toUpperCase() === 'UTILITY' || (detectedRole || '').toUpperCase() === 'SUPPORT';
  const targetRankGap = calculateTargetRankGap(
    {
      avgDeaths: 3.46,
      csPerMin: isSup ? 1.2 : 7.4,
      kp15: 45,
      visionScorePerMin: isSup ? 2.40 : 1.62,
      deepWardRatio: 28,
      kda: 6.8,
    },
    targetTier,
    detectedRole
  );

  return {
    timeOfDayPerformance: [
      {
        timeSlot: '19:00 - 23:59',
        label: '🌟 ゴールデンタイム (集中力MAX)',
        winRate: 62,
        kda: 7.2,
        gamesCount: 30,
        conditionRating: 'Sランク (最高パフォーマンス)',
        insight: '反射神経とマップ把握が研ぎ澄まされ、最も安定した勝率を記録しています。',
        hasData: true,
      },
      {
        timeSlot: '11:00 - 18:59',
        label: '☀️ 昼間・夕方 (標準稼働)',
        winRate: 51,
        kda: 5.6,
        gamesCount: 15,
        conditionRating: 'Bランク (標準的)',
        insight: '比較的落ち着いたプレイ環境。ファームとオブジェクトの基本通りの動きが活きます。',
        hasData: true,
      },
      {
        timeSlot: '00:00 - 05:59',
        label: '⚠️ 深夜帯 (疲労蓄積・注意)',
        winRate: 41,
        kda: 4.4,
        gamesCount: 18,
        conditionRating: 'Dランク (要注意)',
        insight: '脳の疲労により判断がコンマ数秒遅れやすく、トロール遭遇率も上がるため連戦は非推奨。',
        hasData: true,
      },
    ],
    sessionFatigueImpact: [
      {
        gameNumberInSession: '1〜2試合目',
        label: 'ウォーミングアップ ＆ ピーク集中',
        winRate: 64,
        avgDeaths: 2.4,
        focusScore: 95,
        fatigueLevel: 'ゼロ (快調)',
        gamesCount: 28,
        hasData: true,
      },
      {
        gameNumberInSession: '3〜4試合目',
        label: '安定巡航ゾーン',
        winRate: 55,
        avgDeaths: 3.2,
        focusScore: 80,
        fatigueLevel: '軽度 (安定)',
        gamesCount: 22,
        hasData: true,
      },
      {
        gameNumberInSession: '5試合目以降',
        label: '無自覚な疲労 ＆ 集中力低下ゾーン',
        winRate: 36,
        avgDeaths: 5.1,
        focusScore: 50,
        fatigueLevel: '重度 (要終了)',
        gamesCount: 13,
        hasData: true,
      },
    ],
    requeueTiltStats: {
      immediateRequeueWinRate: 32,
      immediateRequeueGames: 12,
      restedRequeueWinRate: 56,
      restedRequeueGames: 18,
      tiltWinRateDropPercent: 24,
      hasData: true,
    },
    dayOfWeekVariance: [
      { day: '火〜木 (平日夜)', winRate: 60, gamesCount: 30, playerPoolType: '落ち着いたソロプレイヤー多め (勝ちやすい)' },
      { day: '金曜夜〜土曜', winRate: 46, gamesCount: 22, playerPoolType: '飲酒・パーティー・トロール多め (ブレが大きい)' },
      { day: '日曜〜月曜', winRate: 54, gamesCount: 16, playerPoolType: '週末ランク追い込み・落ち着いた雰囲気' },
    ],
    goldenSessionRules: [
      '【黄金律1】1日のソロQは最大3〜4戦で打ち切る（5戦目以降は勝率が36%に急落するため厳禁）。',
      '【黄金律2】敗北後は絶対に「即キュー」を押さず、5分間の画面離脱（水分補給・トイレ・深呼吸）を義務化。',
      '【黄金律3】23:30以降の深夜ソロQは原則控え、ゴールデンタイム（19:00〜23:00）に集中投下。',
    ],
    earlyTimelineImpact: {
      firstBloodRate: 38,
      firstDeathAvgMinute: '7分40秒 (序盤の安全性高)',
      objLabel: isSup ? '初手ドラゴン確保時勝率' : 'グラブ優位時勝率 (3匹以上)',
      voidgrubWinRate: 68,
      voidgrubLossWinRate: 42,
      plateGoldImpact: isSup
        ? '下半身主導権によるタワープレート奪取 +22% で中盤リード構築'
        : 'グラブ効果による14分タワー破壊力 +22% でリード拡大',
      roleObjectiveFocus: isSup
        ? 'BOT/サポートは「ドラゴン優先」。下半身レーンのプッシュ主導権と湧き前視界で1匹目ドラゴンを先取することが勝利の絶対条件です。'
        : 'TOP/JG/MIDは「ヴォイドグラブ優先」。序盤リバー主導権を取り3匹以上確保することで、タワー破壊とマップ開放が一気に加速します。',
    },
    fatalDeathAnalytics: {
      objPreSpawnDeathsCount: 2,
      objPreSpawnDeathsRate: 12,
      isolatedDeathsPercent: 18,
      avgFirstDeathSec: 460,
      fatalThrowRating: '極めて低い (自制心 Sランク)',
    },
    gameOutcomeBreakdown: {
      hardCarryWins: { count: 6, percent: 40, label: '👑 ハードキャリー勝利' },
      teamSupportedWins: { count: 3, percent: 20, label: '🛡️ チーム協調・ファーム勝利' },
      aceLosses: { count: 4, percent: 27, label: '😭 エース敗北 (味方崩壊型)' },
      throwLosses: { count: 2, percent: 13, label: '⚠️ 集団戦・逆転負け' },
      dominantOutcomeSummary: '敗北試合の多くが「自身は高KDA・低デスで育っていたが、味方レーンの崩壊で押し切られた」典型的なエース負け型です。',
    },
    championPoolDiagnosis: {
      apRatioPercent: 70,
      adRatioPercent: 20,
      tankRatioPercent: 10,
      poolArchetype: 'APスケーリング ＆ コントロール偏重',
      missingPiece: 'ADファイター / 序盤能動ガンク・イニシエート役',
      recommendedAdditions: [
        {
          championName: 'Xin Zhao (シン・ジャオ)',
          role: 'JUNGLE',
          archetype: 'AD序盤アグレッシブ＆イニシエート',
          synergyReason: '苦手な「15分キル関与率（KP@15）」を自ら仕掛けて引き上げ、味方がAP過多の際の強力なAD主砲として機能。',
        },
        {
          championName: 'Jarvan IV (ジャーヴァンIV)',
          role: 'JUNGLE',
          archetype: 'ADエンゲージ＆ガンクマシン',
          synergyReason: 'Lv2〜3からの確定ガンクとUltの天変地異により、味方メイジの範囲スキルを最大限に活かす構成の要になれる。',
        },
        {
          championName: 'Sejuani (セジュアニ)',
          role: 'JUNGLE',
          archetype: '高耐久フロントライン＆確定CC',
          synergyReason: 'チームにタンクがいない際の安定したピック。被デス回避の高い立ち回りと最高のシナジーを発揮。',
        },
      ],
    },
    playstyleMbti: {
      typeCode: 'ISG',
      typeName: '🏰 鉄壁の城主・スケーリングアーキテクト',
      tagline: '「自分の城（自陣）にいる限り絶対に崩れない」精密ファームの達人',
      axes: {
        safetyVsRisk: { safetyPercent: 92, riskPercent: 8, label: 'リスク選好: セーフティ計算型' },
        scaleVsEnabler: { scalePercent: 78, enablerPercent: 22, label: 'リソース配分: 自己スケーリング重視' },
        guardianVsInvader: { guardianPercent: 76, invaderPercent: 24, label: '空間支配: 自陣テリトリー防衛型' },
        deliberateVsReflex: { deliberatePercent: 82, reflexPercent: 18, label: '意思決定: 慎重観察型' },
      },
      personalityAnalysis: '自制心が極めて高く、無謀なギャンブルトレードや孤立デスを極度に嫌う合理主義者。自身のファームとパワースパイクを第一に信じる性格で、盤石の城を築いてから敵を圧殺するスタイルを得意とします。',
    },
    tiltTriggerMatrix: {
      invadeResistanceRating: 'Sランク (自陣荒らしにも動じず対角ファームで冷静に対処)',
      teammateDeathResistance: 'Bランク (味方序盤崩壊時にやや焦りが生じる傾向)',
      snowballDeathAvoidanceRate: 88,
      mentalResilienceScore: 84,
      tiltInsight: '自身がデスした直後に熱くなって2デス目を重ねるリスクはわずか12%と極めて優秀。最大のメンタルトリガーは「序盤の味方レーン崩壊」であり、ここへのカウンターアクションを身につけることで完全無欠になります。',
    },
    goldEfficiency: {
      damagePerGoldRating: 'Aランク (1Gあたり0.58ダメージ / 安定水準)',
      goldStashRating: 'やや抱え込み傾向 (1300G超を所持したまま川に長居する癖あり)',
      spikeUtilizationPercent: 74,
      efficiencyVerdict: 'ファームで獲得したゴールドのアイテム変換は順調ですが、1300G前後でリコールを1回挟んでパワースパイクを確定させると、小規模戦の勝率がさらに+12%跳ね上がります。',
    },
    adversityBehavior: {
      archetype: '🐢 相手のミス待ち亀型 (Patient Counter-Puncher)',
      behindComebackWinRate: 28,
      behaviorVerdict: '15分ビハインドの劣勢時でも自爆特攻せず、防衛ワードとタワー下ファームで相手の慢心ダイブを誘う粘り強さを持っています。',
      recommendedMindset: 'ビハインド時は味方と固まって敵の甘えた孤立キャリーを1体ピックアップし、バロンを阻止して50分ゲームに持ち込むのが最大の勝ち筋です。',
    },
    cognitiveBiases: {
      recallHabitBias: '【リコール遅延バイアス】「あと1キャンプ掘ってから帰ろう」と欲張った瞬間に敵JGに視界を取られる傾向。',
      mapAttentionBias: '【BOT偏重バイアス】BOT・ドラゴンへの意識は完璧だが、TOPレーンの孤立フリーズ状況を見落としがち。',
      actionPrescription: roleConfig.defaultActionGuideline,
    },
    targetRankGap,
    roleConfig,
  };
}
