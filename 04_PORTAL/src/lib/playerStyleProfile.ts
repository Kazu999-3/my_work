// ============================================================
// Kazurin#4036 パーソナル プレイスタイル特性プロファイル
// your.gg および Riot API の客観スタッツから導出された個人特性
// ============================================================

export interface PlayerStyleMetrics {
  summonerName: string;
  tier: string;
  role: string;
  survivalRating: string;
  avgDeaths: number;
  survivalRankPercentile: number; // 上位%
  csd15: number;
  csdRankPercentile: number;
  earlyKp15: number; // 15分時点キル関与率%
  combatRating: string;
  kpRankPercentile: number; // 下位%
  mainChampions: { name: string; powerRating: string; kda: number; winRate: number }[];
  diagnosisSummary: string;
  coreBottleNeck: string;
  actionGuideline: string;
}

export const KAZURIN_STYLE_PROFILE: PlayerStyleMetrics = {
  summonerName: 'Kazurin#4036',
  tier: 'Gold 3 (41 LP)',
  role: 'JUNGLE',
  survivalRating: 'A+',
  avgDeaths: 3.46,
  survivalRankPercentile: 4, // 上位4%
  csd15: 13.88,
  csdRankPercentile: 12, // 上位12%
  earlyKp15: 35,
  combatRating: 'C-',
  kpRankPercentile: 97, // 下位3%
  mainChampions: [
    { name: 'Zyra', powerRating: 'S', kda: 7.70, winRate: 45 },
    { name: 'Shyvana', powerRating: 'B', kda: 6.06, winRate: 33 },
  ],
  diagnosisSummary: 'ファーム効率（上位12%）と生存能力（上位4%）はエメラルド〜ダイヤ級。自制心が高く無謀なデスは極めて少ない。',
  coreBottleNeck: '序盤15分の戦闘関与率が35%（下位3%）と極めて低く、自分がデスしていなくても敵JGのアクションによって味方レーンが崩壊し、中盤以降に押し切られるパターンが多い。',
  actionGuideline: '3:30のフルクリア後に即リコールせず、プッシュされているレーンへの「チラ見・カウンターガンク」または「敵JG逆サイド荒らし」を1回必ず挟むこと。',
};

export interface RadarHistoryPoint {
  period: string;
  label: string;
  gamesCount: number;
  survival: number;       // 生存スコア (0-100)
  farm: number;           // 15分CSリードスコア (0-100)
  combat: number;         // 15分キル関与スコア (0-100)
  objectives: number;     // オブジェクト確保スコア (0-100)
  teamfight: number;      // 集団戦ポジショニングスコア (0-100)
  avgDeaths: number;
  csd15: number;
  kp15: number;           // %
  avgKda: number;
  summary: string;
}

export const RADAR_HISTORY_TIMELINE: RadarHistoryPoint[] = [
  {
    period: '2026-07 (2ヶ月前)',
    label: '7月スプリット序盤',
    gamesCount: 38,
    survival: 92,
    farm: 82,
    combat: 26,
    objectives: 68,
    teamfight: 78,
    avgDeaths: 3.8,
    csd15: 11.2,
    kp15: 28,
    avgKda: 4.8,
    summary: '完全ファーム専念期。被デスは少ないが味方レーン崩壊への干渉が極めて少なかった時期。',
  },
  {
    period: '2026-08 (1ヶ月前)',
    label: '8月スプリット中盤',
    gamesCount: 45,
    survival: 94,
    farm: 85,
    combat: 31,
    objectives: 71,
    teamfight: 80,
    avgDeaths: 3.6,
    csd15: 12.5,
    kp15: 32,
    avgKda: 5.4,
    summary: 'ドラゴン・ヴォイドグラブ意識が向上。1周目のカウンターアクションを意識し始めた時期。',
  },
  {
    period: '2026-09 (現在 / 直近)',
    label: '9月最新 (直近20戦)',
    gamesCount: 20,
    survival: 96,
    farm: 88,
    combat: 35,
    objectives: 74,
    teamfight: 82,
    avgDeaths: 3.46,
    csd15: 13.88,
    kp15: 35,
    avgKda: 6.8,
    summary: 'ファーム効率・生存率はエメラルド上位級へ到達。弱点だった15分キル関与も35%へ着実に上昇中。',
  },
];

export interface VisionMetrics {
  visionScorePerMin: number;       // 分間視界スコア (例: 1.62)
  visionRankPercentile: number;    // 上位% (例: 18%)
  controlWardsPerGame: number;     // 1試合平均ピンクワード購入数 (例: 2.4本)
  controlWardAvgLifetimeSec: number; // ピンクワード平均生存秒数 (例: 184秒)
  wardsPlacedPerMin: number;       // 分間ワード設置数 (例: 0.65)
  wardsClearedPerMin: number;      // 分間ワード破壊数 (例: 0.38)
  deepWardRatioPercent: number;    // 敵陣ディープ視界比率% (例: 24%)
  defensiveWardRatioPercent: number;// 自陣・防衛視界比率% (例: 76%)
  visionScoreTier: string;         // 'A (エメラルド級)'
  strengthsSummary: string;
  bottleneckSummary: string;
  actionAdvice: string;
}

export const KAZURIN_VISION_METRICS: VisionMetrics = {
  visionScorePerMin: 1.62,
  visionRankPercentile: 18, // 上位18% (同ランク平均 1.18 に対して大幅先行)
  controlWardsPerGame: 2.4,
  controlWardAvgLifetimeSec: 184,
  wardsPlacedPerMin: 0.65,
  wardsClearedPerMin: 0.38,
  deepWardRatioPercent: 24,
  defensiveWardRatioPercent: 76,
  visionScoreTier: 'A (エメラルド水準)',
  strengthsSummary: '防衛視界・オブジェクト周りの視界確保（上位18%）が非常に優秀。ピンクワード平均2.4本購入と長寿命（184秒）が、被デス3.46という驚異的な生存率を支える基盤となっています。',
  bottleneckSummary: '設置ワードの76%が自陣・リバー防衛に偏っており、敵ジャングル深部（ディープワード）への設置が24%に留まっています。これが「敵JGのガンク位置察知の遅れ（KP@15低下）」の要因の1つです。',
  actionAdvice: '3:30フルクリア後やリコール直後、敵ラプター裏・青バフ横のブッシュに「ディープワード」を1本刺すだけで、敵JGのガンクルートを30秒前に察知できます。',
};

/** AIプロンプト（事前アドバイス・事後振り返り）へ注入するパーソナルコンテキスト文 */
export function getPlayerStylePromptContext(): string {
  return `【プレイヤー固有のプレイスタイル特性・弱点カルテ（your.gg実戦データ連動）】
・プレイヤー名: ${KAZURIN_STYLE_PROFILE.summonerName}（メイン: JG）
・最大の強み: 🛡️ 生存能力 A+（平均デス${KAZURIN_STYLE_PROFILE.avgDeaths} / 上位${KAZURIN_STYLE_PROFILE.survivalRankPercentile}%）、🌾 15分CS差 +${KAZURIN_STYLE_PROFILE.csd15}（上位${KAZURIN_STYLE_PROFILE.csdRankPercentile}%）、👁️ 分間視界スコア ${KAZURIN_VISION_METRICS.visionScorePerMin}/分（上位${KAZURIN_VISION_METRICS.visionRankPercentile}%）。防衛視界とファームが極めて正確。
・最大のボトルネック（敗因の核）: ⚠️ 序盤15分の戦闘関与率（KP@15）がわずか ${KAZURIN_STYLE_PROFILE.earlyKp15}%（下位3%）。視界の76%が防衛寄りで、敵陣ディープ視界（24%）が少ないため敵JGの初動察知が後手に回りやすい。
・典型的負けパターン: 「自分は高CS・低デス（KDA 6.0+）で育っているが、敵JGが能動的にガンクして味方レーンが崩壊し、15分以降にオブジェクトや集団戦で押し切られる」。
・AIコーチへの特別添削指示:
  1. 単に「CSが多い」「デスが少なくて良い」と褒めるだけで終わらせず、「序盤に敵JGが仕掛けた際、カウンターアクション（逆サイドジャングル荒らし、対角タワー圧力、カウンターガンク、ディープ視界設置）」が取れていたかを厳格に評価すること。
  2. 改善アクションには必ず「1周目ファーム完了後の1回のレーン干渉または敵陣ディープワード侵入」を含めること。`;
}

