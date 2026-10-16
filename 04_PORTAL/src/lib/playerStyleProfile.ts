// ============================================================
// Kazurin#4036 パーソナル プレイスタイル特性プロファイル
//
// ⚠️ これは「手入力で記録した固定のスナップショット」です（2026-08-20記録 / 2026-09-15更新）。
//    your.gg や Riot API と接続しておらず、試合を重ねても自動では更新されません。
//
// ★ 2026-09-22: 以前はこのファイルが「your.gg実戦データ連動」と称され、UI にも
//    「your.gg 実戦データ連動」「客観データ」と表示されていた。実際には接続が無く、
//    1か月以上前の手入力値が最新の実測値であるかのように提示されていた。
//    さらに getPlayerStylePromptContext() がこの値を「your.gg実戦データ連動」と
//    名乗ってAIコーチのプロンプトへ注入しており、どの試合を解析させても
//    「KP@15が下位3%」という固定の前提でAI講評が生成される状態だった。
//    数値自体は実際に your.gg から転記したものと思われるため削除はせず、
//    「いつ時点の手入力値か」を明示して誤認を防ぐ方針に変更した。
// ============================================================

/** このプロファイルを手入力で記録した時点。UI・AIプロンプトで必ず併記する。 */
export const PROFILE_SNAPSHOT_DATE = '2026-09-15';

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
  return `【プレイヤー固有のプレイスタイル特性・弱点カルテ】
※以下は ${PROFILE_SNAPSHOT_DATE} 時点で手入力された固定のプロファイルであり、今回の試合の実測値ではありません。
※今回の試合データと食い違う場合は、必ず今回の試合の実測値を優先して講評してください。
・プレイヤー名: ${KAZURIN_STYLE_PROFILE.summonerName}（メイン: JG）
・最大の強み: 🛡️ 生存能力 A+（平均デス${KAZURIN_STYLE_PROFILE.avgDeaths} / 上位${KAZURIN_STYLE_PROFILE.survivalRankPercentile}%）、🌾 15分CS差 +${KAZURIN_STYLE_PROFILE.csd15}（上位${KAZURIN_STYLE_PROFILE.csdRankPercentile}%）、👁️ 分間視界スコア ${KAZURIN_VISION_METRICS.visionScorePerMin}/分（上位${KAZURIN_VISION_METRICS.visionRankPercentile}%）。防衛視界とファームが極めて正確。
・最大のボトルネック（敗因の核）: ⚠️ 序盤15分の戦闘関与率（KP@15）がわずか ${KAZURIN_STYLE_PROFILE.earlyKp15}%（下位3%）。視界の76%が防衛寄りで、敵陣ディープ視界（24%）が少ないため敵JGの初動察知が後手に回りやすい。
・典型的な負けパターン: 「自分は高CS・低デス（KDA 6.0+）で育っているが、敵JGが能動的にガンクして味方レーンが崩壊し、15分以降にオブジェクトや集団戦で押し切られる」。
・AIコーチへの特別添削指示:
  1. 単に「CSが多い」「デスが少なくて良い」と褒めるだけで終わらせず、「序盤に敵JGが仕掛けた際、カウンターアクション（逆サイドジャングル荒らし、対角タワー圧力、カウンターガンク、ディープ視界設置）」が取れていたかを厳格に評価すること。
  2. 改善アクションには必ず「1周目ファーム完了後の1回のレーン干渉または敵陣ディープワード侵入」を含めること。`;
}


