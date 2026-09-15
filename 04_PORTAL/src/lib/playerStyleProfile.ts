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

/** AIプロンプト（事前アドバイス・事後振り返り）へ注入するパーソナルコンテキスト文 */
export function getPlayerStylePromptContext(): string {
  return `【プレイヤー固有のプレイスタイル特性・弱点カルテ（your.gg実戦データ連動）】
・プレイヤー名: ${KAZURIN_STYLE_PROFILE.summonerName}（メイン: JG）
・最大の強み: 🛡️ 生存能力 A+（平均デス${KAZURIN_STYLE_PROFILE.avgDeaths} / 上位${KAZURIN_STYLE_PROFILE.survivalRankPercentile}%）、🌾 15分CS差 +${KAZURIN_STYLE_PROFILE.csd15}（上位${KAZURIN_STYLE_PROFILE.csdRankPercentile}%）。無駄死にが極端に少なくファームが正確。
・最大のボトルネック（敗因の核）: ⚠️ 序盤15分の戦闘関与率（KP@15）がわずか ${KAZURIN_STYLE_PROFILE.earlyKp15}%（下位3%）。
・典型的負けパターン: 「自分は高CS・低デス（KDA 6.0+）で育っているが、敵JGが能動的にガンクして味方レーンが崩壊し、15分以降にオブジェクトや集団戦で押し切られる」。
・AIコーチへの特別添削指示:
  1. 単に「CSが多い」「デスが少なくて良い」と褒めるだけで終わらせず、「序盤に敵JGが仕掛けた際、カウンターアクション（逆サイドジャングル荒らし、対角タワー圧力、カウンターガンク）が取れていたか」を厳格に評価すること。
  2. 改善アクションには必ず「1周目ファーム完了後の1回のレーン干渉または敵陣侵入」を含めること。`;
}

