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

// ============================================================
// 👑 チャンピオン別深掘りドリルダウンデータ
// ============================================================
export interface ChampionDeepProfile {
  id: string;
  name: string;
  role: string;
  powerRating: string;
  winRate: number;
  kda: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  csPerMin: number;
  gamesCount: number;
  powerSpikes: {
    earlyLvl1to5: string;
    mid1to2Core: string;
    late3CorePlus: string;
  };
  favoredMatchups: Array<{ enemy: string; winRate: number; reason: string }>;
  hardMatchups: Array<{ enemy: string; winRate: number; counterPlay: string }>;
  winVsLossDiffs: {
    cs15Diff: string;
    deathsDiff: string;
    visionDiff: string;
    firstCoreTime: string;
  };
  aiTacticsGuide: string;
}

export const CHAMPION_DEEP_PROFILES: ChampionDeepProfile[] = [
  {
    id: 'Zyra',
    name: 'Zyra (ザイラ)',
    role: 'JUNGLE',
    powerRating: 'S (メインキャリー)',
    winRate: 45,
    kda: 7.70,
    avgKills: 5.8,
    avgDeaths: 2.1,
    avgAssists: 10.4,
    csPerMin: 7.4,
    gamesCount: 42,
    powerSpikes: {
      earlyLvl1to5: '3:15秒最速フルクリア。種ハラスによる安全なグラブ・ドラゴン触り。',
      mid1to2Core: '【最大スパイク】ライアンドリー＋ブラックファイアトーチ完成時。集団戦のゾーン制圧力MAX。',
      late3CorePlus: 'ゾーニャ・クリプトブルームで敵の突進を完全シャットアウト。',
    },
    favoredMatchups: [
      { enemy: 'Sejuani', winRate: 71, reason: '植物ハラスでパッシブを剥がし続け、接近を完全拒否して完封可能。' },
      { enemy: 'Amumu', winRate: 68, reason: 'Qバインドを植物でブロック。序盤のファーム速度差で大差をつける。' },
      { enemy: 'Zac', winRate: 64, reason: 'Eのジャンプ着地点に植物とEバインドを敷いて無力化。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', winRate: 31, counterPlay: 'Ult暗転時に即座に自身の足元にE+Rを敷き、ストップウォッチ/ゾーニャを最優先で購入する。' },
      { enemy: 'XinZhao', winRate: 35, counterPlay: '1周目に川で絶対にタイマンせず、逆サイドスタートでフルクリア徹底。' },
      { enemy: 'Hecarim', winRate: 38, counterPlay: '移動速度で植物を無視して突っ込まれるため、フェイズラッシュまたはライライのクリスタルセプターを2手目に採用。' },
    ],
    winVsLossDiffs: {
      cs15Diff: '勝利時: 15分CS +18.2 / 敗北時: +4.1',
      deathsDiff: '勝利時: 平均 1.2デス / 敗北時: 平均 3.8デス',
      visionDiff: '勝利時: ピンク 3.1本 / 敗北時: ピンク 1.4本',
      firstCoreTime: '勝利時: 10分40秒完成 / 敗北時: 13分10秒',
    },
    aiTacticsGuide: 'Wの種を敵JGの侵入ルートに事前設置して「実質無料のディープワード」として機能させ、3:30秒に敵ラプターへディープワードを刺すのが勝率を最大化する秘訣。',
  },
  {
    id: 'Shyvana',
    name: 'Shyvana (シヴァーナ)',
    role: 'JUNGLE',
    powerRating: 'B (スケーリングファーム型)',
    winRate: 33,
    kda: 6.06,
    avgKills: 6.2,
    avgDeaths: 2.8,
    avgAssists: 10.8,
    csPerMin: 7.9,
    gamesCount: 24,
    powerSpikes: {
      earlyLvl1to5: 'Lv6前は最弱クラス。ガンクは完全放棄しフルクリア＆ドラゴン先取に専念。',
      mid1to2Core: 'Lv6以降＋ショウジンの矛完成時。ドラゴンフォームのEハラスで敵後衛を半壊させる。',
      late3CorePlus: 'タンク＆APハイブリッドビルドで前線を焼き尽くす高耐久キャリー。',
    },
    favoredMatchups: [
      { enemy: 'Karthus', winRate: 62, reason: 'ファーム速度で負けず、Lv6以降のドラゴン突進でカーサスを瞬殺可能。' },
      { enemy: 'MasterYi', winRate: 58, reason: '序盤のドラゴン管理でリードし、集団戦の硬さとAoEダメージで押し切る。' },
    ],
    hardMatchups: [
      { enemy: 'LeeSin', winRate: 28, counterPlay: '自陣バフ侵入を警戒し、3:00前に自陣トライブッシュに必ず防衛ワードを刺す。' },
      { enemy: 'Vi', winRate: 33, counterPlay: '確定ノックアップでフォーカスされるため、ステラックの篭手やバンシーヴェールを組み込む。' },
    ],
    winVsLossDiffs: {
      cs15Diff: '勝利時: 15分CS +24.5 / 敗北時: +8.2',
      deathsDiff: '勝利時: 平均 1.6デス / 敗北時: 平均 4.4デス',
      visionDiff: '勝利時: ドラゴン確保率 85% / 敗北時: 28%',
      firstCoreTime: '勝利時: 11分00秒完成 / 敗北時: 14分20秒',
    },
    aiTacticsGuide: '味方に「Lv6までファーム徹底」を試合開始時にピン連絡し、パッシブのドラゴン特効を活かして5分湧きドラゴンを即座に触ることが絶対条件。',
  },
  {
    id: 'Viego',
    name: 'Viego (ヴィエゴ)',
    role: 'JUNGLE',
    powerRating: 'A (リセットスノーボール型)',
    winRate: 52,
    kda: 4.80,
    avgKills: 7.4,
    avgDeaths: 4.1,
    avgAssists: 6.8,
    csPerMin: 6.8,
    gamesCount: 18,
    powerSpikes: {
      earlyLvl1to5: 'Wスタン＋Eステルスによるガンク性能。3:30のスカトルファイトが強力。',
      mid1to2Core: 'クラーケンスレイヤー＋サンダードスカイ完成時。最初の1キルリセットからエース。',
      late3CorePlus: '敵キャリーを乗っ取った際の集団戦破壊力MAX。',
    },
    favoredMatchups: [
      { enemy: 'Briar', winRate: 66, reason: '狂乱突進をWスタンで受け止め、簡単にカウンターキルを取れる。' },
      { enemy: 'Kayn', winRate: 60, reason: '変身前のケインを序盤のタイマンで圧倒しジャングルを奪取。' },
    ],
    hardMatchups: [
      { enemy: 'Rammus', winRate: 29, counterPlay: '通常攻撃主体のため天敵。APダメージのウィッツエンドやブラッククリーバーを急ぐ。' },
      { enemy: 'Poppy', winRate: 33, counterPlay: 'Wでヴィエゴの突進・スタンがすべて防がれるため、集団戦ではポッピーのW終わりを待つ。' },
    ],
    winVsLossDiffs: {
      cs15Diff: '勝利時: 15分CS +12.0 / 敗北時: -5.4',
      deathsDiff: '勝利時: 平均 2.2デス / 敗北時: 平均 6.2デス',
      visionDiff: '勝利時: キル関与 62% / 敗北時: 31%',
      firstCoreTime: '勝利時: 10分15秒完成 / 敗北時: 12分45秒',
    },
    aiTacticsGuide: '単独での強引な仕掛けを控え、味方のイニシエート後にEの壁沿いステルスから入って「最初の1キル」を確実に回収すること。',
  },
];

// ============================================================
// 🧠 ゲーム外・コンディション分析データ (Life & Session Analytics)
// ============================================================
export interface LifeSessionAnalytics {
  timeOfDayPerformance: Array<{
    timeSlot: string;
    label: string;
    winRate: number;
    kda: number;
    gamesCount: number;
    conditionRating: string;
    insight: string;
  }>;
  sessionFatigueImpact: Array<{
    gameNumberInSession: string;
    label: string;
    winRate: number;
    avgDeaths: number;
    focusScore: number;
    fatigueLevel: string;
  }>;
  requeueTiltStats: {
    immediateRequeueWinRate: number; // 負け直後1分以内即マッチ
    restedRequeueWinRate: number;    // 5分以上休憩後のマッチ
    tiltWinRateDropPercent: number;
  };
  dayOfWeekVariance: Array<{
    day: string;
    winRate: number;
    playerPoolType: string;
  }>;
  goldenSessionRules: string[];
}

export const KAZURIN_SESSION_ANALYTICS: LifeSessionAnalytics = {
  timeOfDayPerformance: [
    {
      timeSlot: '20:00 - 23:30',
      label: '🌟 ゴールデンタイム (集中力MAX)',
      winRate: 62,
      kda: 7.2,
      gamesCount: 54,
      conditionRating: 'Sランク (最高パフォーマンス)',
      insight: '反射神経・マップ把握・ミニマップ注視が最も研ぎ澄まされている時間帯。ソロQを回すならここがベスト。',
    },
    {
      timeSlot: '13:00 - 18:00',
      label: '☀️ 休日昼間 (安定水準)',
      winRate: 51,
      kda: 5.6,
      gamesCount: 22,
      conditionRating: 'Bランク (標準的)',
      insight: '比較的落ち着いたプレイが可能。新チャンプの練習やノーマルにも最適。',
    },
    {
      timeSlot: '24:00 - 03:30',
      label: '⚠️ 深夜帯 (疲労蓄積・注意)',
      winRate: 41,
      kda: 4.4,
      gamesCount: 38,
      conditionRating: 'Dランク (ティルト注意報)',
      insight: '脳の疲労により「敵JG位置の予測」「危険ピンの反応」がコンマ数秒遅れる。味方のティルト遭遇率も急増。',
    },
  ],
  sessionFatigueImpact: [
    {
      gameNumberInSession: '1〜2試合目',
      label: 'ウォーミングアップ ＆ ピーク集中',
      winRate: 64,
      avgDeaths: 2.4,
      focusScore: 98,
      fatigueLevel: 'ゼロ (快調)',
    },
    {
      gameNumberInSession: '3〜4試合目',
      label: '安定巡航ゾーン',
      winRate: 55,
      avgDeaths: 3.2,
      focusScore: 84,
      fatigueLevel: '軽度 (安定)',
    },
    {
      gameNumberInSession: '5試合目以降',
      label: '無自覚な疲労 ＆ 集中力低下ゾーン',
      winRate: 36,
      avgDeaths: 5.1,
      focusScore: 52,
      fatigueLevel: '重度 (要終了)',
    },
  ],
  requeueTiltStats: {
    immediateRequeueWinRate: 32,
    restedRequeueWinRate: 56,
    tiltWinRateDropPercent: 24,
  },
  dayOfWeekVariance: [
    { day: '火〜木 (平日夜)', winRate: 60, playerPoolType: '落ち着いたソロプレイヤー多め (勝ちやすい)' },
    { day: '金曜夜〜土曜', winRate: 46, playerPoolType: '飲酒・デュオ・トロール多め (ブレが大きい)' },
    { day: '日曜夜', winRate: 54, playerPoolType: 'カスタム練習後でモチベ高め' },
  ],
  goldenSessionRules: [
    '【黄金律1】1日のソロQは最大3〜4戦で打ち切る（5戦目以降は勝率が36%に急落するため厳禁）。',
    '【黄金律2】敗北後は絶対に「即キュー」を押さず、5分間の画面離脱（水分補給・トイレ・深呼吸）を義務化。',
    '【黄金律3】23:30以降の深夜ソロQは原則控える（ゴールデンタイム20:00〜23:00に集中投下）。',
  ],
};

/** AIプロンプト（事前アドバイス・事後振り返り）へ注入するパーソナルコンテキスト文 */
export function getPlayerStylePromptContext(): string {
  return `【プレイヤー固有のプレイスタイル特性・弱点カルテ（your.gg実戦データ連動）】
・プレイヤー名: ${KAZURIN_STYLE_PROFILE.summonerName}（メイン: JG）
・最大の強み: 🛡️ 生存能力 A+（平均デス${KAZURIN_STYLE_PROFILE.avgDeaths} / 上位${KAZURIN_STYLE_PROFILE.survivalRankPercentile}%）、🌾 15分CS差 +${KAZURIN_STYLE_PROFILE.csd15}（上位${KAZURIN_STYLE_PROFILE.csdRankPercentile}%）、👁️ 分間視界スコア ${KAZURIN_VISION_METRICS.visionScorePerMin}/分（上位${KAZURIN_VISION_METRICS.visionRankPercentile}%）。防衛視界とファームが極めて正確。
・最大のボトルネック（敗因の核）: ⚠️ 序盤15分の戦闘関与率（KP@15）がわずか ${KAZURIN_STYLE_PROFILE.earlyKp15}%（下位3%）。視界の76%が防衛寄りで、敵陣ディープ視界（24%）が少ないため敵JGの初動察知が後手に回りやすい。
・典型的な負けパターン: 「自分は高CS・低デス（KDA 6.0+）で育っているが、敵JGが能動的にガンクして味方レーンが崩壊し、15分以降にオブジェクトや集団戦で押し切られる」。
・AIコーチへの特別添削指示:
  1. 単に「CSが多い」「デスが少なくて良い」と褒めるだけで終わらせず、「序盤に敵JGが仕掛けた際、カウンターアクション（逆サイドジャングル荒らし、対角タワー圧力、カウンターガンク、ディープ視界設置）」が取れていたかを厳格に評価すること。
  2. 改善アクションには必ず「1周目ファーム完了後の1回のレーン干渉または敵陣ディープワード侵入」を含めること。`;
}


