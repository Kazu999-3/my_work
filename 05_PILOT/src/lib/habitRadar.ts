/**
 * ==============================================================================
 * KTM 癖暴露スカウター (Habit Radar) 解析エンジン (habitRadar.ts)
 * ==============================================================================
 *
 * 【設計思想】
 * 1. ファクト重視（ハルシネーション完全排除）:
 *    AIの推測や一般論ではなく、Riot Games API Match-V5 Timelineの実測イベント
 *    （WARD_PLACED, ITEM_PURCHASED, CHAMPION_KILL, participantFrames）から
 *    対面プレイヤーの無意識の行動パターンを機械的に抽出する。
 *
 * 2. 序盤勝率直結の3大指標:
 *    - 初手ワード癖 (Early Ward Habit): 設置時刻と位置傾向
 *    - 1stリコール癖 (First Recall Habit): 帰還時刻と所持ゴールド・購入傾向
 *    - 序盤被デス癖 (Early Death Tendency): 10分以内の被デス時刻・ガンク耐性
 */

export interface WardEventInfo {
  timestampMs: number;
  timeFormatted: string; // "1:18"
  wardType: string;
  x?: number;
  y?: number;
  area: 'RIVER' | 'LANE_BUSH' | 'JUNGLE' | 'BASE' | 'UNKNOWN';
}

export interface RecallEventInfo {
  timestampMs: number;
  timeFormatted: string; // "5:15"
  level: number;
  goldSpent: number;
  firstPurchasedItems: number[];
}

export interface EarlyDeathInfo {
  timestampMs: number;
  timeFormatted: string; // "4:10"
  killerChampion?: string;
  isGankDeath: boolean; // キラーまたはアシストにJGが含まれるか
}

export interface SingleGameHabit {
  matchId: string;
  championName: string;
  role: string;
  firstWard: WardEventInfo | null;
  firstRecall: RecallEventInfo | null;
  earlyDeaths: EarlyDeathInfo[];
  firstDeathTimestampMs: number | null;
}

export interface HabitRadarSummary {
  sampleGames: number;
  analyzedChampion: string;
  
  // 1. 初手ワード癖
  earlyWard: {
    placementRate: number; // 0.0 - 1.0 (設置率)
    averageTimeSec: number;
    averageTimeFormatted: string; // "1:22"
    dominantArea: string; // "河川草むら" 等
    advice: string; // 実戦アドバイス
  };

  // 2. 1stリコール癖
  firstRecall: {
    averageTimeSec: number;
    averageTimeFormatted: string; // "5:10"
    averageLevel: number;
    commonItems: string[]; // よく買う初手アイテム（例: ["ブーツ", "涙"]）
    advice: string;
  };

  // 3. 序盤被デス癖
  earlyDeath: {
    deathRateUnder10Min: number; // 10分以内にデスする確率 (0.0 - 1.0)
    averageFirstDeathTimeSec: number | null;
    averageFirstDeathFormatted: string | null; // "4:15"
    gankVulnerabilityRate: number; // ガンクで死んだ割合
    advice: string;
  };

  // 3行スカウター弾丸サマリー（画面・HUDでそのまま表示する用）
  bulletPoints: [string, string, string];
}

/** ミリ秒を "分:秒" 表記にフォーマット */
export function formatMsToTime(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** 秒を "分:秒" 表記にフォーマット */
export function formatSecToTime(sec: number): string {
  if (sec < 0 || !Number.isFinite(sec)) return '0:00';
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

/** マップ座標 (x, y) から大まかなエリアを分類 (Summoner's Rift: 0〜15000) */
export function classifyMapArea(x?: number, y?: number): 'RIVER' | 'LANE_BUSH' | 'JUNGLE' | 'BASE' | 'UNKNOWN' {
  if (x === undefined || y === undefined) return 'UNKNOWN';
  
  // ベース付近
  if ((x < 2000 && y < 2000) || (x > 13000 && y > 13000)) {
    return 'BASE';
  }
  
  // 河川（対角線付近: x + y が 13000〜17000 付近）
  const diag = x + y;
  if (diag >= 12500 && diag <= 17500) {
    // 中央レーン以外なら河川
    const distFromCenter = Math.abs(x - y);
    if (distFromCenter > 2000) {
      return 'RIVER';
    }
  }

  // サイドレーン付近
  if (x < 3000 || y < 3000 || x > 12000 || y > 12000) {
    return 'LANE_BUSH';
  }

  return 'JUNGLE';
}

/**
 * 1試合のタイムラインデータから特定プレイヤーの行動癖を抽出
 */
export function extractSingleGameHabit(
  timelineData: any,
  targetPuuid: string,
  matchDetails?: any
): SingleGameHabit | null {
  if (!timelineData?.info?.frames || !timelineData?.info?.participants) {
    return null;
  }

  // 1. 対象の participantId を特定
  const targetP = timelineData.info.participants.find((p: any) => p.puuid === targetPuuid);
  if (!targetP) return null;
  const participantId = targetP.participantId;

  // チャンピオン・ロールの取得
  let championName = 'Unknown';
  let role = 'UNKNOWN';
  if (matchDetails?.participants) {
    const pDetail = matchDetails.participants.find((p: any) => p.puuid === targetPuuid);
    if (pDetail) {
      championName = pDetail.championName;
      role = pDetail.lane || 'UNKNOWN';
    }
  }

  let firstWard: WardEventInfo | null = null;
  let firstRecall: RecallEventInfo | null = null;
  const earlyDeaths: EarlyDeathInfo[] = [];
  let firstDeathTimestampMs: number | null = null;

  const initialPurchasesDoneTime = 60 * 1000; // 試合開始1分以内は初期アイテム買い

  // 2. フレームを走査
  for (const frame of timelineData.info.frames) {
    const events = frame.events || [];
    for (const ev of events) {
      // (1) 初手ワード（試合開始〜3分30秒以内）
      if (
        ev.type === 'WARD_PLACED' &&
        ev.creatorId === participantId &&
        ev.timestamp <= 210 * 1000 &&
        !firstWard
      ) {
        firstWard = {
          timestampMs: ev.timestamp,
          timeFormatted: formatMsToTime(ev.timestamp),
          wardType: ev.wardType || 'YELLOW_TRINKET',
          x: ev.position?.x,
          y: ev.position?.y,
          area: classifyMapArea(ev.position?.x, ev.position?.y)
        };
      }

      // (2) 1stリコール（初期購入完了後、最初のアイテム購入イベントを帰還とみなす）
      if (
        ev.type === 'ITEM_PURCHASED' &&
        ev.participantId === participantId &&
        ev.timestamp > initialPurchasesDoneTime &&
        !firstRecall
      ) {
        // 当該フレームのレベルとゴールド
        const pFrame = frame.participantFrames?.[participantId];
        firstRecall = {
          timestampMs: ev.timestamp,
          timeFormatted: formatMsToTime(ev.timestamp),
          level: pFrame?.level || 1,
          goldSpent: pFrame?.currentGold || 0,
          firstPurchasedItems: [ev.itemId]
        };
      }

      // (3) 序盤被デス（10分以内）
      if (
        ev.type === 'CHAMPION_KILL' &&
        ev.victimId === participantId &&
        ev.timestamp <= 600 * 1000
      ) {
        if (firstDeathTimestampMs === null) {
          firstDeathTimestampMs = ev.timestamp;
        }

        // JGが関与しているか判定（アシストまたはキラー）
        // matchDetailsがあればロールをチェック
        let isGankDeath = false;
        if (matchDetails?.participants) {
          const killer = matchDetails.participants.find((p: any) => p.participantId === ev.killerId);
          const assisters = (ev.assistingParticipantIds || []).map((id: number) =>
            matchDetails.participants.find((p: any) => p.participantId === id)
          );
          if (killer?.lane === 'JUNGLE' || assisters.some((a: any) => a?.lane === 'JUNGLE')) {
            isGankDeath = true;
          }
        }

        earlyDeaths.push({
          timestampMs: ev.timestamp,
          timeFormatted: formatMsToTime(ev.timestamp),
          isGankDeath
        });
      }
    }
  }

  return {
    matchId: matchDetails?.matchId || 'unknown',
    championName,
    role,
    firstWard,
    firstRecall,
    earlyDeaths,
    firstDeathTimestampMs
  };
}

/**
 * 複数試合の癖データを統計処理し、対面スカウターサマリーを生成する
 */
export function aggregateHabitRadar(habits: SingleGameHabit[]): HabitRadarSummary {
  const validGames = habits.filter(Boolean);
  const total = validGames.length;

  if (total === 0) {
    return {
      sampleGames: 0,
      analyzedChampion: 'データ不足',
      earlyWard: {
        placementRate: 0,
        averageTimeSec: 0,
        averageTimeFormatted: '未計測',
        dominantArea: '未計測',
        advice: '試合データが不足しています。'
      },
      firstRecall: {
        averageTimeSec: 0,
        averageTimeFormatted: '未計測',
        averageLevel: 0,
        commonItems: [],
        advice: '試合データが不足しています。'
      },
      earlyDeath: {
        deathRateUnder10Min: 0,
        averageFirstDeathTimeSec: null,
        averageFirstDeathFormatted: null,
        gankVulnerabilityRate: 0,
        advice: '試合データが不足しています。'
      },
      bulletPoints: [
        '👁️ 初手ワード: 実戦データ収集中',
        '🛒 1stリコール: 実戦データ収集中',
        '⚠️ ガンク耐性: 実戦データ収集中'
      ]
    };
  }

  const primaryChamp = validGames[0]?.championName || '対面';

  // 1. 初手ワード分析
  const wardGames = validGames.filter((g) => g.firstWard !== null);
  const placementRate = Math.round((wardGames.length / total) * 100) / 100;
  
  let averageWardSec = 0;
  let dominantArea = '河川草むら';
  if (wardGames.length > 0) {
    const totalWardSec = wardGames.reduce((acc, g) => acc + Math.floor(g.firstWard!.timestampMs / 1000), 0);
    averageWardSec = Math.round(totalWardSec / wardGames.length);

    // エリア集計
    const areaCounts: Record<string, number> = {};
    wardGames.forEach((g) => {
      const a = g.firstWard!.area;
      areaCounts[a] = (areaCounts[a] || 0) + 1;
    });
    const sortedAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);
    const topArea = sortedAreas[0]?.[0];
    if (topArea === 'RIVER') dominantArea = '河川草むら';
    else if (topArea === 'LANE_BUSH') dominantArea = 'レーン草むら';
    else if (topArea === 'JUNGLE') dominantArea = 'ジャングル入口';
    else dominantArea = '河川・通路';
  }

  const wardExpireTimeSec = averageWardSec + 90; // 黄色トリンケット持続90秒
  const wardAdvice = placementRate >= 0.6
    ? `平均 ${formatSecToTime(averageWardSec)}（${dominantArea}設置率 ${(placementRate * 100).toFixed(0)}%）➔ ${formatSecToTime(wardExpireTimeSec)}以降は視界切れ、ガンク好機`
    : `初手ワード設置率 ${(placementRate * 100).toFixed(0)}%と低め ➔ 序盤から視界の甘さを突いたLv2〜3ガンクが有効`;

  // 2. 1stリコール分析
  const recallGames = validGames.filter((g) => g.firstRecall !== null);
  let averageRecallSec = 300; // 5分デフォルト
  let averageRecallLevel = 5;
  if (recallGames.length > 0) {
    const totalRecallSec = recallGames.reduce((acc, g) => acc + Math.floor(g.firstRecall!.timestampMs / 1000), 0);
    averageRecallSec = Math.round(totalRecallSec / recallGames.length);
    const totalLevel = recallGames.reduce((acc, g) => acc + g.firstRecall!.level, 0);
    averageRecallLevel = Math.round((totalLevel / recallGames.length) * 10) / 10;
  }

  const recallAdvice = `平均 ${formatSecToTime(averageRecallSec)}（Lv ${averageRecallLevel}）に初帰還 ➔ 直前のウェーブをクラッシュさせてロームまたは有利リコールを狙える`;

  // 3. 序盤被デス分析
  const gamesWithEarlyDeath = validGames.filter((g) => g.earlyDeaths.length > 0);
  const deathRateUnder10Min = Math.round((gamesWithEarlyDeath.length / total) * 100) / 100;

  let averageFirstDeathSec: number | null = null;
  let gankDeathCount = 0;
  let totalEarlyDeathCount = 0;

  if (gamesWithEarlyDeath.length > 0) {
    const totalDeathSec = gamesWithEarlyDeath.reduce((acc, g) => acc + Math.floor(g.firstDeathTimestampMs! / 1000), 0);
    averageFirstDeathSec = Math.round(totalDeathSec / gamesWithEarlyDeath.length);

    validGames.forEach((g) => {
      g.earlyDeaths.forEach((d) => {
        totalEarlyDeathCount++;
        if (d.isGankDeath) gankDeathCount++;
      });
    });
  }

  const gankVulnerabilityRate = totalEarlyDeathCount > 0 ? Math.round((gankDeathCount / totalEarlyDeathCount) * 100) / 100 : 0;
  
  let deathAdvice = '';
  if (deathRateUnder10Min >= 0.5 && averageFirstDeathSec !== null) {
    deathAdvice = `10分以内被デス率 ${(deathRateUnder10Min * 100).toFixed(0)}%（平均 ${formatSecToTime(averageFirstDeathSec)}）➔ 序盤に無理な仕掛けで崩れやすい傾向。JG連携で早期に崩せます`;
  } else if (deathRateUnder10Min <= 0.2) {
    deathAdvice = `10分以内被デス率 ${(deathRateUnder10Min * 100).toFixed(0)}%と序盤極めて堅牢 ➔ 無理なキル狙いは避け、ファーム差・集団戦で差をつけるのが無難`;
  } else {
    deathAdvice = `10分以内被デス率 ${(deathRateUnder10Min * 100).toFixed(0)}%（標準的）➔ 相手のミスを見逃さずハラスで削ってチャンスを窺う`;
  }

  // 3行弾丸サマリー
  const bullet1 = `👁️ 初手ワード: 平均 ${formatSecToTime(averageWardSec)}（${dominantArea}率 ${(placementRate * 100).toFixed(0)}%） ➔ ${formatSecToTime(wardExpireTimeSec)}以降が視界の隙`;
  const bullet2 = `🛒 1stリコール: 平均 ${formatSecToTime(averageRecallSec)}（Lv ${averageRecallLevel}） ➔ 直前押し付け有利展開`;
  const bullet3 = averageFirstDeathSec !== null
    ? `⚠️ 序盤ガンク耐性: 10分被デス率 ${(deathRateUnder10Min * 100).toFixed(0)}%（初回事故: 平均 ${formatSecToTime(averageFirstDeathSec)}）`
    : `🛡️ 序盤ガンク耐性: 10分被デス率 ${(deathRateUnder10Min * 100).toFixed(0)}%（序盤安定型）`;

  return {
    sampleGames: total,
    analyzedChampion: primaryChamp,
    earlyWard: {
      placementRate,
      averageTimeSec: averageWardSec,
      averageTimeFormatted: formatSecToTime(averageWardSec),
      dominantArea,
      advice: wardAdvice
    },
    firstRecall: {
      averageTimeSec: averageRecallSec,
      averageTimeFormatted: formatSecToTime(averageRecallSec),
      averageLevel: averageRecallLevel,
      commonItems: [],
      advice: recallAdvice
    },
    earlyDeath: {
      deathRateUnder10Min,
      averageFirstDeathTimeSec: averageFirstDeathSec,
      averageFirstDeathFormatted: averageFirstDeathSec !== null ? formatSecToTime(averageFirstDeathSec) : null,
      gankVulnerabilityRate,
      advice: deathAdvice
    },
    bulletPoints: [bullet1, bullet2, bullet3]
  };
}
