/**
 * ==============================================================================
 * KTM 「もしもの世界（What-If）」タイムライン逆再生アナライザー (whatIfAnalyzer.ts)
 * ==============================================================================
 *
 * 【設計思想】
 * 1. 敗因の分岐点を客観特定:
 *    試合全体のチームゴールド差推移から、最も急激に試合が傾いた「1〜2分（致命的ターン）」を
 *    微分値（ゴールド差の最大落差）から機械的に特定する。
 *
 * 2. トレードオフ（代償）の可視化:
 *    その瞬間に「自分が得たもの（プッシュ、タワー、ファーム等）」と
 *    「チーム・味方が失ったもの（集団戦デス、オブジェクト献上等）」を数値で並べて対比し、
 *    感情論・他責・自己否定を排除した客観的な教訓を言語化する。
 */

export interface TurningPointEvent {
  timestampMs: number;
  timeFormatted: string; // "17:30"
  type: 'KILL' | 'DEATH' | 'TOWER' | 'DRAGON' | 'BARON' | 'HERALD' | 'FARM';
  description: string;
  goldImpact: number; // プラスまたはマイナスのゴールド概算
  isSelfInvolved: boolean; // 自分が関与していたか
}

export interface WhatIfTurningPoint {
  minuteStart: number; // 例: 17
  minuteEnd: number;   // 例: 18
  timeFormatted: string; // "17:00 〜 18:00"
  goldSwing: number;   // この1分間のチームゴールド落差 (例: -2400)
  
  // トレードオフ対比
  selfGained: {
    totalGold: number;
    actions: string[]; // 例: ["Bot 1stタワー破壊 (+300G)", "ミニオン2ウェーブ (+210G)"]
  };
  teamLost: {
    totalGoldLoss: number;
    actions: string[]; // 例: ["バロン付近で3デッド (-900G)", "ドラゴン献上 (-450G)"]
  };

  // 結論・教訓
  tradeoffVerdict: 'CRITICAL_SPLIT_FAULT' | 'UNAVOIDABLE_COLLAPSE' | 'WORTHWHILE_TRADE' | 'BALANCED';
  verdictTitle: string;
  verdictAdvice: string;
}

export interface WhatIfAnalysisReport {
  analyzedMatchId: string;
  isLoss: boolean;
  gameDurationMinutes: number;
  turningPoint: WhatIfTurningPoint | null;
  goldHistoryByMinute: { minute: number; myTeamGold: number; enemyTeamGold: number; goldDiff: number }[];
}

/** ミリ秒を "分:秒" 表記にフォーマット */
function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * タイムラインから「もしもの世界（What-If）」敗因分岐点を解析
 */
export function analyzeWhatIfTimeline(params: {
  timelineData: any;
  targetPuuid: string;
  matchDetails?: any;
}): WhatIfAnalysisReport {
  const { timelineData, targetPuuid, matchDetails } = params;

  if (!timelineData?.info?.frames || !timelineData?.info?.participants) {
    return {
      analyzedMatchId: matchDetails?.matchId || 'unknown',
      isLoss: false,
      gameDurationMinutes: 0,
      turningPoint: null,
      goldHistoryByMinute: []
    };
  }

  // 1. 対象プレイヤーの特定と所属チーム（Blue 100 vs Red 200）
  const targetP = timelineData.info.participants.find((p: any) => p.puuid === targetPuuid);
  const targetParticipantId = targetP?.participantId || 1;
  
  let myTeamId = 100;
  let isLoss = false;
  if (matchDetails?.participants) {
    const pDetail = matchDetails.participants.find((p: any) => p.puuid === targetPuuid);
    if (pDetail) {
      myTeamId = pDetail.teamId;
      isLoss = !pDetail.win;
    }
  }

  // 自チームの participantId リスト（通常 1〜5 が Blue 100、6〜10 が Red 200）
  const myTeamParticipantIds = new Set<number>();
  const enemyTeamParticipantIds = new Set<number>();

  if (matchDetails?.participants) {
    matchDetails.participants.forEach((p: any) => {
      if (p.teamId === myTeamId) {
        myTeamParticipantIds.add(p.participantId);
      } else {
        enemyTeamParticipantIds.add(p.participantId);
      }
    });
  } else {
    // フォールバック: 1〜5 を自陣、6〜10 を敵陣と仮定
    if (targetParticipantId <= 5) {
      for (let i = 1; i <= 5; i++) myTeamParticipantIds.add(i);
      for (let i = 6; i <= 10; i++) enemyTeamParticipantIds.add(i);
    } else {
      for (let i = 6; i <= 10; i++) myTeamParticipantIds.add(i);
      for (let i = 1; i <= 5; i++) enemyTeamParticipantIds.add(i);
    }
  }

  // 2. 毎分のチームゴールド推移と急変点（デルタ）の算出
  const frames = timelineData.info.frames;
  const goldHistory: { minute: number; myTeamGold: number; enemyTeamGold: number; goldDiff: number }[] = [];

  let maxGoldDrop = 0;
  let turningPointMinute = -1;

  for (let m = 0; m < frames.length; m++) {
    const pFrames = frames[m].participantFrames || {};
    let myGold = 0;
    let enemyGold = 0;

    Object.keys(pFrames).forEach((idStr) => {
      const pid = Number(idStr);
      const totalGold = pFrames[pid]?.totalGold || 0;
      if (myTeamParticipantIds.has(pid)) {
        myGold += totalGold;
      } else {
        enemyGold += totalGold;
      }
    });

    const diff = myGold - enemyGold;
    goldHistory.push({ minute: m, myTeamGold: myGold, enemyTeamGold: enemyGold, goldDiff: diff });

    // 前の分からの落差を計測（自チーム視点でのマイナス変化量）
    if (m > 0) {
      const prevDiff = goldHistory[m - 1].goldDiff;
      const swing = diff - prevDiff; // マイナスなら自チームが損害

      // 序盤5分以降で最大のゴールド落差を特定
      if (m >= 5 && swing < maxGoldDrop) {
        maxGoldDrop = swing;
        turningPointMinute = m;
      }
    }
  }

  // 3. 分岐点（Turning Point）の詳細イベント解析
  let turningPoint: WhatIfTurningPoint | null = null;

  if (turningPointMinute > 0 && maxGoldDrop < -800) { // 1分間で800G以上の急落
    const targetFrame = frames[turningPointMinute];
    const prevFrame = frames[turningPointMinute - 1];
    const events = targetFrame?.events || [];

    const selfActions: string[] = [];
    const teamLossActions: string[] = [];
    let selfGoldGain = 0;
    let teamLossGold = 0;

    // 自プレイヤーのこの1分間のゴールド増加量
    const currentSelfGold = targetFrame?.participantFrames?.[targetParticipantId]?.totalGold || 0;
    const prevSelfGold = prevFrame?.participantFrames?.[targetParticipantId]?.totalGold || 0;
    const selfNetGain = Math.max(0, currentSelfGold - prevSelfGold);
    selfGoldGain = selfNetGain;

    // イベント走査
    for (const ev of events) {
      // 自チームのデス
      if (ev.type === 'CHAMPION_KILL' && myTeamParticipantIds.has(ev.victimId)) {
        const isSelf = ev.victimId === targetParticipantId;
        const victimName = isSelf ? 'あなた' : '味方';
        teamLossActions.push(`${victimName}がキルされる (${fmtMs(ev.timestamp)})`);
        teamLossGold += 300;
      }

      // 敵のタワー破壊
      if (ev.type === 'BUILDING_KILL' && ev.teamId === myTeamId) {
        teamLossActions.push(`自軍のタワーが破壊される (${fmtMs(ev.timestamp)})`);
        teamLossGold += 500;
      }

      // 自軍のタワー破壊（自分が関与）
      if (ev.type === 'BUILDING_KILL' && ev.teamId !== myTeamId) {
        if (ev.killerId === targetParticipantId || (ev.assistingParticipantIds || []).includes(targetParticipantId)) {
          selfActions.push(`タワー破壊に関与 (+300G) (${fmtMs(ev.timestamp)})`);
        }
      }

      // 敵のエピックモンスター獲得
      if (ev.type === 'ELITE_MONSTER_KILL' && enemyTeamParticipantIds.has(ev.killerId)) {
        const monster = ev.monsterType === 'BARON_NASHOR' ? 'バロン' : ev.monsterType === 'DRAGON' ? 'ドラゴン' : 'ヘラルド/ヴォイド';
        teamLossActions.push(`敵に${monster}を獲得される (${fmtMs(ev.timestamp)})`);
        teamLossGold += ev.monsterType === 'BARON_NASHOR' ? 1500 : 500;
      }
    }

    // 自アクションのフォールバック
    if (selfActions.length === 0) {
      selfActions.push(`レーンプッシュ＆ファーム継続 (+${selfGoldGain}G)`);
    }
    if (teamLossActions.length === 0) {
      teamLossActions.push(`集団戦またはマップコントロール喪失 (-${Math.abs(maxGoldDrop)}G)`);
    }

    // トレードオフの判定
    let verdict: WhatIfTurningPoint['tradeoffVerdict'] = 'UNAVOIDABLE_COLLAPSE';
    let verdictTitle = '不可抗力の集団戦崩壊';
    let verdictAdvice = 'チーム全体の判断ミスにより急激にリードを奪われました。';

    if (Math.abs(maxGoldDrop) >= 1500 && Math.abs(maxGoldDrop) > selfGoldGain * 2) {
      verdict = 'CRITICAL_SPLIT_FAULT';
      verdictTitle = '⚠️ スプリット判断の代償超過 (致命的分岐点)';
      verdictAdvice = `自身が得たゴールド(+${selfGoldGain}G)に対して、チームが失ったゴールド(${maxGoldDrop}G)が圧倒的に上回りました。味方が集団戦を避けられない配置だったため、事前のグループ寄りが勝敗を分けたポイントでした。`;
    } else if (selfGoldGain >= 600 && Math.abs(maxGoldDrop) <= 1200) {
      verdict = 'WORTHWHILE_TRADE';
      verdictTitle = '✅ トレードオフ成立 (価値あるトレード)';
      verdictAdvice = `味方の損害に対し、自身も施設破壊やファームで+${selfGoldGain}Gを獲得し、損害を最小限に抑える適切なクロススワップを行いました。`;
    } else {
      verdict = 'BALANCED';
      verdictTitle = '⚖️ 互角のダメージレース';
      verdictAdvice = `激しいトレードが発生した1分間でした。次回のオブジェクト出現前のウェーブ管理が鍵となります。`;
    }

    turningPoint = {
      minuteStart: turningPointMinute - 1,
      minuteEnd: turningPointMinute,
      timeFormatted: `${turningPointMinute - 1}:00 〜 ${turningPointMinute}:00`,
      goldSwing: maxGoldDrop,
      selfGained: {
        totalGold: selfGoldGain,
        actions: selfActions
      },
      teamLost: {
        totalGoldLoss: teamLossGold || Math.abs(maxGoldDrop),
        actions: teamLossActions
      },
      tradeoffVerdict: verdict,
      verdictTitle,
      verdictAdvice
    };
  }

  const durationMin = Math.floor((frames[frames.length - 1]?.events?.[0]?.timestamp || 1800000) / 60000);

  return {
    analyzedMatchId: matchDetails?.matchId || 'unknown',
    isLoss,
    gameDurationMinutes: durationMin,
    turningPoint,
    goldHistoryByMinute: goldHistory
  };
}
