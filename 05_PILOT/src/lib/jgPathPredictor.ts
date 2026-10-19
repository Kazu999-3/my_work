/**
 * ==============================================================================
 * KTM 敵JG行動予測 (Jungle Path Predictor) 解析エンジン (jgPathPredictor.ts)
 * ==============================================================================
 *
 * 【設計思想】
 * 1. ファクト重視（実測のみ・AI推測完全排除）:
 *    Riot Games API Match-V5 Timeline の実測イベント（ELITE_MONSTER_KILL, CHAMPION_KILL, participantFrames）から、
 *    敵JGの序盤初動ルート（赤/青スタート）と初ガンク（時刻・ターゲットレーン）を機械的に抽出する。
 *
 * 2. 序盤の被ガンク事故・レーン崩壊を防ぐ3大予測指標:
 *    - 初手バフ開始率 (First Buff Rate): 赤スタート vs 青スタート
 *    - 初ガンク時刻・傾向 (First Gank Time & Target Lane): 平均時刻と狙われやすいレーン
 *    - 初オブジェクト優先度 (First Objective Focus): 幼虫(Voidgrub) vs ドラゴン(Dragon)
 */

export interface SingleGameJgPath {
  matchId: string;
  championName: string;
  firstBuff: 'RED' | 'BLUE' | 'UNKNOWN';
  firstBuffTimeSec: number | null;
  firstGank: {
    timeSec: number;
    timeFormatted: string;
    lane: 'TOP' | 'MID' | 'BOT' | 'INVADE' | 'UNKNOWN';
    isKillOrAssist: boolean;
  } | null;
  firstObjective: {
    type: 'DRAGON' | 'VOIDGRUB' | 'HERALD' | 'NONE';
    timeSec: number;
    timeFormatted: string;
  } | null;
}

export interface JgPathSummary {
  sampleGames: number;
  analyzedChampion: string;

  // 1. 初手バフ傾向
  firstBuff: {
    redStartRate: number; // 0.0 - 1.0
    blueStartRate: number; // 0.0 - 1.0
    dominantBuff: 'RED' | 'BLUE' | 'FLEXIBLE';
    advice: string;
  };

  // 2. 初ガンク傾向
  firstGank: {
    averageTimeSec: number | null;
    averageTimeFormatted: string | null;
    topGankRate: number;
    midGankRate: number;
    botGankRate: number;
    dominantLane: 'TOP' | 'MID' | 'BOT' | 'LOW_ACTIVITY';
    advice: string;
  };

  // 3. 初オブジェクト傾向
  firstObjective: {
    dominantType: 'DRAGON' | 'VOIDGRUB' | 'BALANCED' | 'NONE';
    grubRate: number;
    dragonRate: number;
    advice: string;
  };

  // 3行スカウター弾丸サマリー（画面・HUDでそのまま表示する用）
  bulletPoints: [string, string, string];
}

/** 秒数を "分:秒" 表記にフォーマット */
export function formatSecToTime(sec: number): string {
  if (sec < 0 || !Number.isFinite(sec)) return '0:00';
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

/** マップ座標 (x, y) からガンク先のレーンを判定 (Summoner's Rift: 0〜15000) */
export function classifyGankLane(x?: number, y?: number): 'TOP' | 'MID' | 'BOT' | 'INVADE' | 'UNKNOWN' {
  if (x === undefined || y === undefined) return 'UNKNOWN';

  // TOP レーン付近 (左上側: x < 4500 かつ y > 8000、または x < 2500)
  if ((x < 4500 && y > 8000) || (x < 2500 && y > 5000)) {
    return 'TOP';
  }

  // BOT レーン付近 (右下側: x > 8000 かつ y < 4500、または y < 2500)
  if ((x > 8000 && y < 4500) || (x > 5000 && y < 2500)) {
    return 'BOT';
  }

  // MID レーン付近 (対角線上の中央帯: |x - y| < 2000 かつ 4200 <= x <= 10000 かつ 4200 <= y <= 10000)
  const diagDiff = Math.abs(x - y);
  if (diagDiff < 2000 && x >= 4200 && x <= 10000 && y >= 4200 && y <= 10000) {
    return 'MID';
  }

  // 敵ジャングル内のインベード
  return 'INVADE';
}

/**
 * 1試合のタイムラインデータからJGプレイヤーの初動行動を抽出
 */
export function extractSingleGameJgPath(
  timelineData: any,
  targetPuuid: string,
  matchDetails?: any
): SingleGameJgPath | null {
  if (!timelineData?.info?.frames || !timelineData?.info?.participants) {
    return null;
  }

  // 対象の participantId を特定
  const targetP = timelineData.info.participants.find((p: any) => p.puuid === targetPuuid);
  if (!targetP) return null;
  const participantId = targetP.participantId;

  // チャンピオン・ロールの取得
  let championName = 'Unknown';
  if (matchDetails?.participants) {
    const pDetail = matchDetails.participants.find((p: any) => p.puuid === targetPuuid);
    if (pDetail) {
      championName = pDetail.championName;
    }
  }

  let firstBuff: 'RED' | 'BLUE' | 'UNKNOWN' = 'UNKNOWN';
  let firstBuffTimeSec: number | null = null;
  let firstGank: SingleGameJgPath['firstGank'] = null;
  let firstObjective: SingleGameJgPath['firstObjective'] = null;

  const frames = timelineData.info.frames || [];

  for (const frame of frames) {
    const events = frame.events || [];
    for (const event of events) {
      const timeSec = Math.floor((event.timestamp || 0) / 1000);

      // 1. 初手バフ判定 (序盤 1:30 〜 3:00 に討伐された RED / BLUE バフ)
      if (firstBuff === 'UNKNOWN' && timeSec >= 80 && timeSec <= 180) {
        if (event.type === 'ELITE_MONSTER_KILL' && event.killerId === participantId) {
          if (event.monsterType === 'RED_BUFF') {
            firstBuff = 'RED';
            firstBuffTimeSec = timeSec;
          } else if (event.monsterType === 'BLUE_BUFF') {
            firstBuff = 'BLUE';
            firstBuffTimeSec = timeSec;
          }
        }
      }

      // 2. 初ガンク判定 (序盤 1:30 〜 6:00 に発生したキル/アシスト)
      if (!firstGank && timeSec >= 90 && timeSec <= 360) {
        if (event.type === 'CHAMPION_KILL') {
          const isKiller = event.killerId === participantId;
          const isAssist = Array.isArray(event.assistingParticipantIds) && event.assistingParticipantIds.includes(participantId);
          if (isKiller || isAssist) {
            const lane = classifyGankLane(event.position?.x, event.position?.y);
            firstGank = {
              timeSec,
              timeFormatted: formatSecToTime(timeSec),
              lane,
              isKillOrAssist: true,
            };
          }
        }
      }

      // 3. 初オブジェクト判定 (10分以内)
      if (!firstObjective && timeSec <= 600) {
        if (event.type === 'ELITE_MONSTER_KILL' && event.killerId === participantId) {
          if (event.monsterType === 'HORDE') {
            firstObjective = { type: 'VOIDGRUB', timeSec, timeFormatted: formatSecToTime(timeSec) };
          } else if (event.monsterType === 'DRAGON') {
            firstObjective = { type: 'DRAGON', timeSec, timeFormatted: formatSecToTime(timeSec) };
          } else if (event.monsterType === 'RIFTHERALD') {
            firstObjective = { type: 'HERALD', timeSec, timeFormatted: formatSecToTime(timeSec) };
          }
        }
      }
    }
  }

  // バフ討伐イベントが欠落している場合、2分時点のフレーム位置から推定フォールバック
  if (firstBuff === 'UNKNOWN' && frames.length >= 3) {
    const frame2Min = frames[2]; // 2分時点のフレーム
    const pFrame = frame2Min?.participantFrames?.[participantId] || frame2Min?.participantFrames?.[String(participantId)];
    if (pFrame?.position) {
      const { x, y } = pFrame.position;
      // 青チーム側赤バフ(7800, 4000) または 赤チーム側赤バフ(7000, 10800)
      const distRed1 = Math.hypot(x - 7800, y - 4000);
      const distRed2 = Math.hypot(x - 7000, y - 10800);
      // 青チーム側青バフ(3800, 8000) または 赤チーム側青バフ(11000, 7000)
      const distBlue1 = Math.hypot(x - 3800, y - 8000);
      const distBlue2 = Math.hypot(x - 11000, y - 7000);

      const minRed = Math.min(distRed1, distRed2);
      const minBlue = Math.min(distBlue1, distBlue2);

      if (minRed < 2000 && minRed < minBlue) {
        firstBuff = 'RED';
        firstBuffTimeSec = 110;
      } else if (minBlue < 2000 && minBlue < minRed) {
        firstBuff = 'BLUE';
        firstBuffTimeSec = 110;
      }
    }
  }

  return {
    matchId: timelineData.metadata?.matchId || 'unknown',
    championName,
    firstBuff,
    firstBuffTimeSec,
    firstGank,
    firstObjective,
  };
}

/**
 * 複数試合のJG行動データを集計し、スカウター用の要約とアドバイスを生成
 */
export function aggregateJgPath(paths: SingleGameJgPath[]): JgPathSummary {
  const sampleGames = paths.length;
  const analyzedChampion = paths[0]?.championName || 'Unknown';

  if (sampleGames === 0) {
    return {
      sampleGames: 0,
      analyzedChampion: 'Unknown',
      firstBuff: {
        redStartRate: 0.5,
        blueStartRate: 0.5,
        dominantBuff: 'FLEXIBLE',
        advice: '実戦データがまだありません。周囲の視界を確保して初動を索敵してください。',
      },
      firstGank: {
        averageTimeSec: null,
        averageTimeFormatted: null,
        topGankRate: 0,
        midGankRate: 0,
        botGankRate: 0,
        dominantLane: 'LOW_ACTIVITY',
        advice: 'ガンクデータなし。3:30前後の最初のリバー視界切れに注意してください。',
      },
      firstObjective: {
        dominantType: 'BALANCED',
        grubRate: 0,
        dragonRate: 0,
        advice: 'オブジェクトデータなし。',
      },
      bulletPoints: [
        '🌲 敵JGデータなし: 3:30前後の河川視界を警戒',
        '👁️ レーン戦序盤は両サイドの視界を均等に確保',
        '⚔️ 初手オブジェクト(5:00)の寄りに注意',
      ],
    };
  }

  // 1. 初手バフ集計
  let redCount = 0;
  let blueCount = 0;
  for (const p of paths) {
    if (p.firstBuff === 'RED') redCount++;
    else if (p.firstBuff === 'BLUE') blueCount++;
  }
  const knownBuffs = redCount + blueCount;
  const redStartRate = knownBuffs > 0 ? Number((redCount / knownBuffs).toFixed(2)) : 0.5;
  const blueStartRate = knownBuffs > 0 ? Number((blueCount / knownBuffs).toFixed(2)) : 0.5;

  let dominantBuff: 'RED' | 'BLUE' | 'FLEXIBLE' = 'FLEXIBLE';
  let buffAdvice = '初手ルートは柔軟です。敵JGのレーン出現位置をミニマップで注視してください。';
  if (redStartRate >= 0.65) {
    dominantBuff = 'RED';
    buffAdvice = `🔴 赤バフ開始が顕著(${Math.round(redStartRate * 100)}%)。反対側レーン（青バフ側）へ向かうフルクリアまたはLv3逆サイドガンクを警戒！`;
  } else if (blueStartRate >= 0.65) {
    dominantBuff = 'BLUE';
    buffAdvice = `🔵 青バフ開始が顕著(${Math.round(blueStartRate * 100)}%)。赤バフ側レーンへ抜ける展開を意識し、3:15〜3:30の仕掛けに注意！`;
  }

  // 2. 初ガンク集計
  const gankedPaths = paths.filter((p) => p.firstGank !== null);
  let totalGankSec = 0;
  let topGanks = 0;
  let midGanks = 0;
  let botGanks = 0;

  for (const p of gankedPaths) {
    const g = p.firstGank!;
    totalGankSec += g.timeSec;
    if (g.lane === 'TOP') topGanks++;
    else if (g.lane === 'MID') midGanks++;
    else if (g.lane === 'BOT') botGanks++;
  }

  const avgGankSec = gankedPaths.length > 0 ? Math.round(totalGankSec / gankedPaths.length) : null;
  const topGankRate = gankedPaths.length > 0 ? Number((topGanks / gankedPaths.length).toFixed(2)) : 0;
  const midGankRate = gankedPaths.length > 0 ? Number((midGanks / gankedPaths.length).toFixed(2)) : 0;
  const botGankRate = gankedPaths.length > 0 ? Number((botGanks / gankedPaths.length).toFixed(2)) : 0;

  let dominantLane: 'TOP' | 'MID' | 'BOT' | 'LOW_ACTIVITY' = 'LOW_ACTIVITY';
  let gankAdvice = '序盤ガンク頻度は低め（ファーム寄り）。自身のレーン主導権を握りやすい傾向です。';

  if (gankedPaths.length > 0) {
    const maxRate = Math.max(topGankRate, midGankRate, botGankRate);
    if (maxRate === topGankRate && topGankRate >= 0.4) {
      dominantLane = 'TOP';
      gankAdvice = `🛡️ TOP偏重ガンク(${Math.round(topGankRate * 100)}%)。平均初動 ${formatSecToTime(avgGankSec || 210)} 付近でTOPレーンへの介入確率が極めて高いです。`;
    } else if (maxRate === botGankRate && botGankRate >= 0.4) {
      dominantLane = 'BOT';
      gankAdvice = `🏹 BOT偏重ガンク(${Math.round(botGankRate * 100)}%)。3:30前後のBOTリバー視界確保とタワー下ダイブ警戒が必須です。`;
    } else if (maxRate === midGankRate && midGankRate >= 0.35) {
      dominantLane = 'MID';
      gankAdvice = `⚡ MID介入率高(${Math.round(midGankRate * 100)}%)。サイドからのハサミ込みやリバーでの小競り合い合流を警戒してください。`;
    }
  }

  // 3. 初オブジェクト集計
  let grubCount = 0;
  let dragonCount = 0;
  for (const p of paths) {
    if (p.firstObjective?.type === 'VOIDGRUB') grubCount++;
    else if (p.firstObjective?.type === 'DRAGON') dragonCount++;
  }
  const totalObj = grubCount + dragonCount;
  const grubRate = totalObj > 0 ? Number((grubCount / totalObj).toFixed(2)) : 0;
  const dragonRate = totalObj > 0 ? Number((dragonCount / totalObj).toFixed(2)) : 0;

  let dominantType: 'DRAGON' | 'VOIDGRUB' | 'BALANCED' | 'NONE' = 'NONE';
  let objAdvice = '初手オブジェクトの明確な偏りはありません。';
  if (grubRate >= 0.65) {
    dominantType = 'VOIDGRUB';
    objAdvice = `🐛 幼虫(Voidgrub)最優先(${Math.round(grubRate * 100)}%)。5:00以降のトップサイド主導権争いに味方JGと連携して寄りを合わせましょう。`;
  } else if (dragonRate >= 0.65) {
    dominantType = 'DRAGON';
    objAdvice = `🐉 ドラゴン最優先(${Math.round(dragonRate * 100)}%)。ボットレーンのプライオリティを確保し、5〜7分のドラゴン周辺視界を奪還しましょう。`;
  } else if (totalObj > 0) {
    dominantType = 'BALANCED';
    objAdvice = '幼虫・ドラゴンを状況に応じて柔軟に選択するバランス型です。';
  }

  // 弾丸サマリー（3行ピル）
  const buffPill = dominantBuff === 'RED'
    ? `🔴 初手赤バフ開始率 ${Math.round(redStartRate * 100)}% (逆サイド警戒)`
    : dominantBuff === 'BLUE'
    ? `🔵 初手青バフ開始率 ${Math.round(blueStartRate * 100)}% (赤バフ側へ進行)`
    : `🌲 初動バフ: 赤/青 柔軟展開 (${sampleGames}戦実測)`;

  const gankPill = avgGankSec
    ? `🎯 初ガンク目安 ${formatSecToTime(avgGankSec)} (${dominantLane !== 'LOW_ACTIVITY' ? `${dominantLane}優先` : 'レーン分散'})`
    : `🎯 序盤ガンク頻度: 低（フルファーム傾向）`;

  const objPill = dominantType === 'VOIDGRUB'
    ? `🐛 5:00 幼虫(ヴォイドグラブ)重視傾向`
    : dominantType === 'DRAGON'
    ? `🐉 序盤ドラゴン確保重視傾向`
    : `⚖️ 初手オブジェクト: 臨機応変型`;

  return {
    sampleGames,
    analyzedChampion,
    firstBuff: {
      redStartRate,
      blueStartRate,
      dominantBuff,
      advice: buffAdvice,
    },
    firstGank: {
      averageTimeSec: avgGankSec,
      averageTimeFormatted: avgGankSec ? formatSecToTime(avgGankSec) : null,
      topGankRate,
      midGankRate,
      botGankRate,
      dominantLane,
      advice: gankAdvice,
    },
    firstObjective: {
      dominantType,
      grubRate,
      dragonRate,
      advice: objAdvice,
    },
    bulletPoints: [buffPill, gankPill, objPill],
  };
}
