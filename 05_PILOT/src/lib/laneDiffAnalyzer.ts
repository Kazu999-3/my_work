/**
 * ==============================================================================
 * KTM レーン戦の勝敗分岐点アナライザー (laneDiffAnalyzer.ts)
 * ==============================================================================
 *
 * 【設計思想】
 * 1. 序盤レーン戦（0〜14分）の決定打を特定:
 *    試合全体の勝敗だけでなく、「レーン戦で対面との差が開き始めた最初のきっかけ」
 *    （ファーストブラッド、被ガンク、リコールミス時のCSロスト、プレート献上など）を
 *    Riot Match-V5 Timelineから機械的に特定する。
 *
 * 2. 感情論の排除と客観的な教訓:
 *    「なんとなく負けた」ではなく、「5分40秒に被ガンクでデスし、ミニオン2ウェーブと
 *    プレート1枚（約550G差）を失ったことが最初の分岐点」と具体的に言語化する。
 */

export interface LaneMinuteSnapshot {
  minute: number;
  selfGold: number;
  enemyGold: number;
  goldDiff: number; // self - enemy
  selfCs: number;
  enemyCs: number;
  csDiff: number;   // self - enemy
  selfLevel: number;
  enemyLevel: number;
}

export type LaneTurningPointReason = 
  | 'SOLO_DEATH'       // 対面へのソロデス
  | 'GANK_DEATH'       // 敵のガンク被弾
  | 'SOLO_KILL'        // 対面ソロキル（有利起点）
  | 'GANK_KILL'        // 味方ガンクによるキル（有利起点）
  | 'PLATE_LOST'       // タワープレート献上
  | 'PLATE_TAKEN'      // タワープレート獲得
  | 'CS_LOST'          // ウェーブ管理/リコール起因のCSロスト
  | 'CS_DOMINANCE';    // ファーム圧倒

export interface LaneTurningPoint {
  minute: number;
  timeFormatted: string; // "05:30"
  reason: LaneTurningPointReason;
  isPositive: boolean;   // 自分が有利になった起点か
  title: string;
  goldDelta: number;     // この1分間でのゴールド落差
  csDelta: number;       // この1分間でのCS落差
  description: string;
  advice: string;
}

export interface LaneDiffReport {
  matchId: string;
  selfParticipantId: number;
  enemyParticipantId: number;
  selfRole: string;
  selfChampion: string;
  enemyChampion: string;
  timelineMinutes: LaneMinuteSnapshot[];
  diffAt10: { goldDiff: number; csDiff: number };
  diffAt14: { goldDiff: number; csDiff: number };
  verdict: 'LANE_WON' | 'LANE_LOST' | 'EVEN';
  turningPoint: LaneTurningPoint | null;
}

/** ミリ秒を "分:秒" 表記にフォーマット */
function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Match-V5 TimelineとMatch詳細からレーン戦の勝敗分岐点を解析
 */
export function analyzeLaneBreakdown(
  matchDetails: any,
  timelineData: any,
  targetPuuid: string
): LaneDiffReport | null {
  if (!matchDetails?.info?.participants || !timelineData?.info?.frames) {
    return null;
  }

  const participants: any[] = matchDetails.info.participants;
  const self = participants.find((p: any) => p.puuid === targetPuuid);
  if (!self) return null;

  const selfId = self.participantId;
  const selfTeamId = self.teamId;
  const selfRole = self.teamPosition || self.individualPosition || 'UNKNOWN';

  // 対面プレイヤーの特定 (同じレーン・ロールの敵チームプレイヤー)
  let enemy = participants.find(
    (p: any) => p.teamId !== selfTeamId && (p.teamPosition === selfRole || p.individualPosition === selfRole)
  );

  // ポジション一致で見つからない場合は、敵チームの同じインデックス（1〜5 vs 6〜10）でフォールバック
  if (!enemy) {
    const selfIdxInTeam = participants.filter((p: any) => p.teamId === selfTeamId).findIndex((p: any) => p.participantId === selfId);
    const enemies = participants.filter((p: any) => p.teamId !== selfTeamId);
    enemy = enemies[selfIdxInTeam] || enemies[0];
  }

  if (!enemy) return null;
  const enemyId = enemy.participantId;

  // 0〜14分（最大15フレーム）の毎分スナップショットを抽出
  const frames: any[] = timelineData.info.frames;
  const timelineMinutes: LaneMinuteSnapshot[] = [];

  const maxMinute = Math.min(14, frames.length - 1);
  for (let m = 0; m <= maxMinute; m++) {
    const frame = frames[m];
    const sFrame = frame.participantFrames?.[String(selfId)] || frame.participantFrames?.[selfId];
    const eFrame = frame.participantFrames?.[String(enemyId)] || frame.participantFrames?.[enemyId];

    if (sFrame && eFrame) {
      const sCs = (sFrame.minionsKilled || 0) + (sFrame.jungleMinionsKilled || 0);
      const eCs = (eFrame.minionsKilled || 0) + (eFrame.jungleMinionsKilled || 0);
      const sGold = sFrame.totalGold || 0;
      const eGold = eFrame.totalGold || 0;
      const sLvl = sFrame.level || 1;
      const eLvl = eFrame.level || 1;

      timelineMinutes.push({
        minute: m,
        selfGold: sGold,
        enemyGold: eGold,
        goldDiff: sGold - eGold,
        selfCs: sCs,
        enemyCs: eCs,
        csDiff: sCs - eCs,
        selfLevel: sLvl,
        enemyLevel: eLvl,
      });
    }
  }

  if (timelineMinutes.length < 5) {
    return null; // データ不足
  }

  // 10分および14分時点の差分
  const snap10 = timelineMinutes.find((s) => s.minute === 10) || timelineMinutes[timelineMinutes.length - 1];
  const snap14 = timelineMinutes[timelineMinutes.length - 1];

  const diffAt10 = { goldDiff: snap10.goldDiff, csDiff: snap10.csDiff };
  const diffAt14 = { goldDiff: snap14.goldDiff, csDiff: snap14.csDiff };

  let verdict: 'LANE_WON' | 'LANE_LOST' | 'EVEN' = 'EVEN';
  if (diffAt14.goldDiff >= 600 || (diffAt14.goldDiff >= 300 && diffAt14.csDiff >= 15)) {
    verdict = 'LANE_WON';
  } else if (diffAt14.goldDiff <= -600 || (diffAt14.goldDiff <= -300 && diffAt14.csDiff <= -15)) {
    verdict = 'LANE_LOST';
  }

  // 0〜14分の全イベント（キル、プレート破壊等）を平坦化
  const earlyEvents: any[] = [];
  frames.slice(0, maxMinute + 1).forEach((f) => {
    (f.events || []).forEach((e: any) => earlyEvents.push(e));
  });

  // 分岐点の探索: 1〜14分の間で「前分からのゴールド差・CS差の急激な変化」を検出
  let maxNegativeSwing = 0; // 自分が不利になった最大スイング
  let maxPositiveSwing = 0; // 自分が有利になった最大スイング
  let negTurnMinute = -1;
  let posTurnMinute = -1;

  for (let m = 1; m < timelineMinutes.length; m++) {
    const prev = timelineMinutes[m - 1];
    const curr = timelineMinutes[m];
    const deltaGold = curr.goldDiff - prev.goldDiff;

    if (deltaGold < maxNegativeSwing) {
      maxNegativeSwing = deltaGold;
      negTurnMinute = m;
    }
    if (deltaGold > maxPositiveSwing) {
      maxPositiveSwing = deltaGold;
      posTurnMinute = m;
    }
  }

  // 勝敗または優劣に応じて着目する分岐点を選択
  let turningPoint: LaneTurningPoint | null = null;
  const isLossFocus = verdict === 'LANE_LOST' || (verdict === 'EVEN' && Math.abs(maxNegativeSwing) > maxPositiveSwing);
  const targetMinute = isLossFocus ? negTurnMinute : posTurnMinute;

  if (targetMinute > 0) {
    const prevSnap = timelineMinutes[targetMinute - 1];
    const currSnap = timelineMinutes[targetMinute];
    const goldDelta = currSnap.goldDiff - prevSnap.goldDiff;
    const csDelta = currSnap.csDiff - prevSnap.csDiff;

    // 対象の分（targetMinute-1分〜targetMinute分）のイベントを調査
    const windowStartMs = (targetMinute - 1) * 60 * 1000;
    const windowEndMs = targetMinute * 60 * 1000;
    const windowEvents = earlyEvents.filter(
      (e: any) => e.timestamp >= windowStartMs && e.timestamp <= windowEndMs
    );

    // 1. 自分が死亡したか
    const deathEvent = windowEvents.find(
      (e: any) => e.type === 'CHAMPION_KILL' && e.victimId === selfId
    );
    // 2. 自分がキルしたか
    const killEvent = windowEvents.find(
      (e: any) => e.type === 'CHAMPION_KILL' && e.killerId === selfId
    );
    // 3. プレートが折られた/折ったか
    const plateEvent = windowEvents.find(
      (e: any) => e.type === 'BUILDING_KILL' && e.buildingType === 'TOWER_BUILDING'
    );

    if (isLossFocus) {
      // 負け・劣勢の分岐点
      if (deathEvent) {
        const isGank = (deathEvent.assistingParticipantIds || []).length > 0 || deathEvent.killerId !== enemyId;
        const timeStr = fmtMs(deathEvent.timestamp);
        if (isGank) {
          turningPoint = {
            minute: targetMinute,
            timeFormatted: timeStr,
            reason: 'GANK_DEATH',
            isPositive: false,
            title: `🚨 ${timeStr} 敵の複数ガンク被弾`,
            goldDelta,
            csDelta,
            description: `${timeStr}付近に敵JG・他レーナーのガンクでデスし、レーンゴールド差が【${goldDelta}G】急落しました。`,
            advice: '敵JGの1stガンク警戒時刻や川草むらのワードが切れるタイミング（2:45〜3:30）にレーンを不用意に押し込みすぎていないか確認しましょう。',
          };
        } else {
          turningPoint = {
            minute: targetMinute,
            timeFormatted: timeStr,
            reason: 'SOLO_DEATH',
            isPositive: false,
            title: `💥 ${timeStr} 対面へのソロデス被弾`,
            goldDelta,
            csDelta,
            description: `${timeStr}に対面【${enemy.championName}】にソロデスを喫し、ゴールド落差【${goldDelta}G】とウェーブ喪失が発生しました。`,
            advice: '相手の主要スキル（CCやブリンク）が上がっている状態での無謀なトレード、またはLv先行（Lv2/Lv3/Lv6スパイク）の確認を徹底しましょう。',
          };
        }
      } else if (plateEvent && plateEvent.teamId === selfTeamId) {
        turningPoint = {
          minute: targetMinute,
          timeFormatted: `${targetMinute}:00`,
          reason: 'PLATE_LOST',
          isPositive: false,
          title: `🛡️ ${targetMinute}分 タワープレート喪失`,
          goldDelta,
          csDelta,
          description: `リコール中またはローム中に対面にフリーでタワーを殴られ、プレートゴールド（1枚125G+）を献上しました。`,
          advice: '敵タワー下にウェーブを押し切り切らない中途半端なタイミングでのリコールは、プレートとミニオンの2重ロストを招きます。',
        };
      } else {
        turningPoint = {
          minute: targetMinute,
          timeFormatted: `${targetMinute}:00`,
          reason: 'CS_LOST',
          isPositive: false,
          title: `📉 ${targetMinute}分 ファーム・トレード差の拡大`,
          goldDelta,
          csDelta,
          description: `デスはしていないものの、対面とのCS差がこの1分で【${csDelta}CS】開き、ゴールド差が【${goldDelta}G】拡大しました。`,
          advice: '不用意な被ハラスでHPを削られ、ミニオンに近づけない「ゾーンアウト」状態に追い込まれていないかリプレイで見直しましょう。',
        };
      }
    } else {
      // 勝ち・優勢の分岐点（スノーボール起点）
      if (killEvent) {
        const timeStr = fmtMs(killEvent.timestamp);
        const isSolo = (killEvent.assistingParticipantIds || []).length === 0;
        turningPoint = {
          minute: targetMinute,
          timeFormatted: timeStr,
          reason: isSolo ? 'SOLO_KILL' : 'GANK_KILL',
          isPositive: true,
          title: isSolo ? `👑 ${timeStr} 対面ソロキル奪取！` : `🤝 ${timeStr} ガンク合わせ成功！`,
          goldDelta,
          csDelta,
          description: `${timeStr}に対面をキルして一気に主導権を掌握し、ゴールド差【+${goldDelta}G】を創出しました。`,
          advice: '得たリードを活かして即座にウェーブを押し込み、敵タワープレート破壊や敵ジャングルへのワード設置へ繋げられた好プレイです！',
        };
      } else {
        turningPoint = {
          minute: targetMinute,
          timeFormatted: `${targetMinute}:00`,
          reason: 'CS_DOMINANCE',
          isPositive: true,
          title: `🔥 ${targetMinute}分 ファーム圧倒＆プレッシャー`,
          goldDelta,
          csDelta,
          description: `対面を強烈にハラス・ゾーンアウトし、この1分でCS差【+${csDelta}CS】・ゴールド差【+${goldDelta}G】を突き放しました。`,
          advice: '相手にファームを許さず完璧なウェーブ主導権を維持できています。この有利をオブジェクト（幼虫・ドラゴン）へ波及させましょう。',
        };
      }
    }
  }

  return {
    matchId: matchDetails.metadata?.matchId || matchDetails.info?.gameId || 'unknown',
    selfParticipantId: selfId,
    enemyParticipantId: enemyId,
    selfRole,
    selfChampion: self.championName || 'Unknown',
    enemyChampion: enemy.championName || 'Unknown',
    timelineMinutes,
    diffAt10,
    diffAt14,
    verdict,
    turningPoint,
  };
}
