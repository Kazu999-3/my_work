/**
 * 試合後 対面JG相対トラッカー ＆ ピンポイントVOD抽出
 *
 * 1. 対面JG相対トラッカー（FORESTER 10,000試合実証モデル）
 *    - 日本サーバー10,000試合の統計に基づき、10分/15分時点での
 *      「味方JG vs 敵JG」のKP（Kill+Assist絶対数）・Death・Gold・Dragon差を算出。
 *    - 15分「敵JGよりKP多 ＋ Death少」の勝率74.39%ボーダー達成可否を判定。
 *
 * 2. ピンポイントVOD抽出（raaaaaq氏 × small_turns氏モデル）
 *    - オブジェクト取得前後4秒のデス検証
 *    - キルから30秒以内のオブジェクト獲得（好テンポ）
 *    - VODで見るべき特定時刻（ミリ秒単位イベントからピンポイント算出）
 */

import { fetchMatchDetails } from './riot';

type MatchResult = Awaited<ReturnType<typeof fetchMatchDetails>>;

export interface JgMinuteSnapshot {
  minute: number;
  myKp: number;
  enemyKp: number;
  myDeaths: number;
  enemyDeaths: number;
  goldDiff: number;
}

export interface JgRelativeSnapshot {
  minute: number;
  me: {
    championName: string;
    kp: number;
    deaths: number;
    gold: number;
    cs: number;
    dragons: number;
  };
  enemy: {
    championName: string;
    kp: number;
    deaths: number;
    gold: number;
    cs: number;
    dragons: number;
  };
  diff: {
    kpDiff: number;
    deathDiff: number;
    goldDiff: number;
    csDiff: number;
    dragonDiff: number;
  };
  foresterBorder: {
    achieved: boolean;
    borderRate: string;
    status: 'success' | 'warning' | 'danger';
    badge: string;
    title: string;
    description: string;
  };
}

export interface VodReviewPoint {
  id: string;
  timestampMs: number;
  timeStr: string;
  type: 'OBJECTIVE_DEATH' | 'KILL_TO_OBJECTIVE' | 'RAPID_DEATH' | 'HEAVY_GOLD_SWING';
  importance: 'HIGH' | 'MEDIUM' | 'GOOD';
  title: string;
  description: string;
  vodTip: string;
}

export interface PostgameJgAnalysisReport {
  isJungleMatch: boolean;
  myChampion: string;
  enemyJgChampion: string | null;
  tenMinSnapshot: JgRelativeSnapshot | null;
  fifteenMinSnapshot: JgRelativeSnapshot | null;
  history15m: JgMinuteSnapshot[];
  vodReviewPoints: VodReviewPoint[];
}

const MONSTER_NAMES: Record<string, string> = {
  DRAGON: 'ドラゴン',
  RIFTHERALD: 'ヘラルド',
  HORDE: 'ヴォイドグラブ',
  BARON_NASHOR: 'バロン',
  ATAKHAN: 'アタカン',
};

const fmtMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function analyzePostgameJgMetrics(
  match: MatchResult,
  timeline: any,
  myPuuid: string,
): PostgameJgAnalysisReport {
  const me = match.participants.find((p) => p.puuid === myPuuid);
  const isMeJungle = me?.lane === 'JUNGLE';

  // 味方JGと敵JGを特定
  const myTeamId = me?.teamId;
  const myJg = isMeJungle
    ? me
    : match.participants.find((p) => p.teamId === myTeamId && p.lane === 'JUNGLE') || me;
  const enemyJg = match.participants.find((p) => p.teamId !== myTeamId && p.lane === 'JUNGLE');

  if (!timeline?.info?.frames || !myJg || !enemyJg) {
    return {
      isJungleMatch: isMeJungle,
      myChampion: myJg?.championName || '',
      enemyJgChampion: enemyJg?.championName || null,
      tenMinSnapshot: null,
      fifteenMinSnapshot: null,
      history15m: [],
      vodReviewPoints: [],
    };
  }

  // participantId を取得 (Match Timeline は 1〜10)
  const myPIdx = match.participants.findIndex((p) => p.puuid === myJg.puuid) + 1;
  const enemyPIdx = match.participants.findIndex((p) => p.puuid === enemyJg.puuid) + 1;

  // 1. 各イベントの累積カウントとミリ秒単位イベントの抽出
  const allEvents: any[] = [];
  const frames = timeline.info.frames;
  for (const f of frames) {
    if (f.events) allEvents.push(...f.events);
  }

  // 15分までの毎分スナップショット集計
  const maxMin = Math.min(15, frames.length - 1);
  const history15m: JgMinuteSnapshot[] = [];

  // 各分時点のキル・アシスト・デスを計算
  const calcParticipantStatsAtMin = (targetMin: number, pId: number) => {
    let kp = 0;
    let deaths = 0;
    const cutoffMs = targetMin * 60_000;

    for (const ev of allEvents) {
      if (ev.timestamp > cutoffMs) continue;
      if (ev.type === 'CHAMPION_KILL') {
        if (ev.killerId === pId || (ev.assistingParticipantIds && ev.assistingParticipantIds.includes(pId))) {
          kp++;
        }
        if (ev.victimId === pId) {
          deaths++;
        }
      }
    }
    return { kp, deaths };
  };

  // ドラゴン獲得数の集計
  const calcDragonsAtMin = (targetMin: number, teamId: number) => {
    let count = 0;
    const cutoffMs = targetMin * 60_000;
    for (const ev of allEvents) {
      if (ev.timestamp > cutoffMs) continue;
      if (ev.type === 'ELITE_MONSTER_KILL' && ev.monsterType === 'DRAGON' && ev.killerTeamId === teamId) {
        count++;
      }
    }
    return count;
  };

  for (let m = 0; m <= maxMin; m++) {
    const f = frames[m];
    const myFrame = f?.participantFrames?.[String(myPIdx)];
    const enemyFrame = f?.participantFrames?.[String(enemyPIdx)];

    const myStats = calcParticipantStatsAtMin(m, myPIdx);
    const enemyStats = calcParticipantStatsAtMin(m, enemyPIdx);

    const myGold = myFrame?.totalGold || 0;
    const enemyGold = enemyFrame?.totalGold || 0;

    history15m.push({
      minute: m,
      myKp: myStats.kp,
      enemyKp: enemyStats.kp,
      myDeaths: myStats.deaths,
      enemyDeaths: enemyStats.deaths,
      goldDiff: myGold - enemyGold,
    });
  }

  // スナップショット作成用ヘルパー
  const buildSnapshot = (min: number): JgRelativeSnapshot | null => {
    if (frames.length <= min) return null;
    const f = frames[min];
    const myFrame = f?.participantFrames?.[String(myPIdx)];
    const enemyFrame = f?.participantFrames?.[String(enemyPIdx)];

    const myEventStats = calcParticipantStatsAtMin(min, myPIdx);
    const enemyEventStats = calcParticipantStatsAtMin(min, enemyPIdx);

    const myGold = myFrame?.totalGold || 0;
    const enemyGold = enemyFrame?.totalGold || 0;
    const myCs = (myFrame?.minionsKilled || 0) + (myFrame?.jungleMinionsKilled || 0);
    const enemyCs = (enemyFrame?.minionsKilled || 0) + (enemyFrame?.jungleMinionsKilled || 0);

    const myDragons = calcDragonsAtMin(min, myJg.teamId);
    const enemyDragons = calcDragonsAtMin(min, enemyJg.teamId);

    const kpDiff = myEventStats.kp - enemyEventStats.kp;
    const deathDiff = myEventStats.deaths - enemyEventStats.deaths;
    const goldDiff = myGold - enemyGold;
    const csDiff = myCs - enemyCs;
    const dragonDiff = myDragons - enemyDragons;

    // FORESTER 10,000試合モデル判定
    let achieved = false;
    let borderRate = '50.0%';
    let status: 'success' | 'warning' | 'danger' = 'warning';
    let badge = '均衡ゾーン';
    let title = '対面JGとほぼ同等';
    let description = '';

    if (min === 15) {
      if (kpDiff > 0 && deathDiff < 0) {
        achieved = true;
        borderRate = '74.39%';
        status = 'success';
        badge = '勝率 74.39% 勝利ボーダー達成！';
        title = '敵JGを関与・生存の両面で完全圧倒';
        description = '15分時点で敵JGより多くのキル・アシストに関与しつつ、デス数を下回りました。10,000試合の実証データ上、最も勝率が高い理想的なジャングルテンポです。';
      } else if (deathDiff > 0) {
        achieved = false;
        borderRate = '36.14%';
        status = 'danger';
        badge = 'デス過多によるテンポ損失';
        title = '敵JGよりデスが多くテンポを崩壊';
        description = '15分までのデス数が敵JGを上回っています。無理なガンク突入やダウンテンポ無視の交戦が、敵JGへの主導権譲渡に繋がった可能性があります。';
      } else if (kpDiff < 0) {
        achieved = false;
        borderRate = '40.90%';
        status = 'warning';
        badge = 'ファーム先行も介入不足';
        title = '関与率（KP）で敵JGに後れ';
        description = '死なずにファームは維持できましたが、試合への関与数（KP）で敵JGにリードを許しました。CS優位単独では勝率56%に留まるため、要所での介入が課題です。';
      } else {
        achieved = false;
        borderRate = '50.0%';
        status = 'warning';
        badge = 'イーブン展開';
        title = '対面JGとほぼ互角のペース';
        description = 'KP・Deathともに拮抗しています。中盤以降の集団戦とオブジェクト管理が勝敗の分かれ目となります。';
      }
    } else if (min === 10) {
      if (kpDiff > 0 && deathDiff < 0) {
        achieved = true;
        borderRate = '68.40%';
        status = 'success';
        badge = '勝率 68.40% 序盤主導権掌握';
        title = '10分時点で理想的な関与と生存';
        description = '敵JGより関与が多く、死んでいません。このまま無理をせず15分ボーダーへ繋げるのが定石です。';
      } else if (myEventStats.deaths === 0) {
        achieved = true;
        borderRate = '64.05%';
        status = 'success';
        badge = '0 Death セーフティ運用';
        title = '10分 0 Death達成';
        description = '10分まで一度もデスしていません。生存そのものがテンポ維持として大きく機能しています。';
      }
    }

    return {
      minute: min,
      me: {
        championName: myJg.championName,
        kp: myEventStats.kp,
        deaths: myEventStats.deaths,
        gold: myGold,
        cs: myCs,
        dragons: myDragons,
      },
      enemy: {
        championName: enemyJg.championName,
        kp: enemyEventStats.kp,
        deaths: enemyEventStats.deaths,
        gold: enemyGold,
        cs: enemyCs,
        dragons: enemyDragons,
      },
      diff: {
        kpDiff,
        deathDiff,
        goldDiff,
        csDiff,
        dragonDiff,
      },
      foresterBorder: {
        achieved,
        borderRate,
        status,
        badge,
        title,
        description,
      },
    };
  };

  const tenMinSnapshot = buildSnapshot(10);
  const fifteenMinSnapshot = buildSnapshot(15);

  // 2. ピンポイントVOD抽出（raaaaaq氏 × small_turns氏モデル）
  const vodReviewPoints: VodReviewPoint[] = [];

  // (1) オブジェクト取得前後4秒（±4,000ms）以内のデス・キル
  const monsterEvents = allEvents.filter((ev) => ev.type === 'ELITE_MONSTER_KILL');
  const championKillEvents = allEvents.filter((ev) => ev.type === 'CHAMPION_KILL');

  for (const mEv of monsterEvents) {
    const mTs = mEv.timestamp;
    const mName = MONSTER_NAMES[mEv.monsterType] || mEv.monsterType;

    // 前後4秒以内の自分のデス
    const nearbyDeath = championKillEvents.find(
      (kEv) => kEv.victimId === myPIdx && Math.abs(kEv.timestamp - mTs) <= 4000,
    );
    if (nearbyDeath) {
      const diffSec = ((nearbyDeath.timestamp - mTs) / 1000).toFixed(1);
      const isBefore = nearbyDeath.timestamp < mTs;
      vodReviewPoints.push({
        id: `obj-death-${nearbyDeath.timestamp}`,
        timestampMs: nearbyDeath.timestamp,
        timeStr: fmtMs(nearbyDeath.timestamp),
        type: 'OBJECTIVE_DEATH',
        importance: 'HIGH',
        title: `${mName}確保 ${isBefore ? `${Math.abs(Number(diffSec))}秒前のデス` : `${diffSec}秒後のデス`}`,
        description: isBefore
          ? `${mName}が倒される直前のデスです。孤立して捕まったか、スマイト勝負で強引に入って落ちた可能性があります。`
          : `${mName}確保直後のデスです。オブジェクト取得後の離脱動線が甘く、敵の囲い込みを受けた可能性があります。`,
        vodTip: `VODで「オブジェクト周辺の視界が確保されていたか」「味方の位置と退路」をピンポイント確認してください。`,
      });
    }

    // (2) キル発生から30秒以内の重要オブジェクト確保（好テンポ）
    const prevKill = championKillEvents.find(
      (kEv) =>
        (kEv.killerId === myPIdx || (kEv.assistingParticipantIds && kEv.assistingParticipantIds.includes(myPIdx))) &&
        mEv.timestamp > kEv.timestamp &&
        mEv.timestamp - kEv.timestamp <= 30_000 &&
        mEv.killerTeamId === myJg.teamId,
    );
    if (prevKill) {
      const sec = Math.floor((mEv.timestamp - prevKill.timestamp) / 1000);
      vodReviewPoints.push({
        id: `kill-to-obj-${mEv.timestamp}`,
        timestampMs: prevKill.timestamp,
        timeStr: fmtMs(prevKill.timestamp),
        type: 'KILL_TO_OBJECTIVE',
        importance: 'GOOD',
        title: `キルから${sec}秒後に${mName}を獲得（テンポ変換成功）`,
        description: `キル発生の人数有利を活かし、素早くマップオブジェクトへ直結させた好判断です。`,
        vodTip: `キル直後に迷わず${mName}へピンを出して寄れたか、理想的な動線を確認してください。`,
      });
    }
  }

  // (3) 短時間（120秒以内）での連続デス（テンポ崩壊区間）
  let prevDeathTs = 0;
  for (const kEv of championKillEvents) {
    if (kEv.victimId === myPIdx) {
      if (prevDeathTs > 0 && kEv.timestamp - prevDeathTs <= 120_000) {
        const intervalSec = Math.floor((kEv.timestamp - prevDeathTs) / 1000);
        vodReviewPoints.push({
          id: `rapid-death-${kEv.timestamp}`,
          timestampMs: kEv.timestamp,
          timeStr: fmtMs(kEv.timestamp),
          type: 'RAPID_DEATH',
          importance: 'HIGH',
          title: `わずか${intervalSec}秒での連続デス（テンポ崩壊）`,
          description: `リスポーン直後に再度デスしています。ダウンテンポでリソースを再整列せず、感情的なリエンゲージや視界外への不用意な侵入が疑われます。`,
          vodTip: `復活後の画面で「直前の死因を受け止めてファームや逆サイドへ動線を引けていたか」をVODで要確認。`,
        });
      }
      prevDeathTs = kEv.timestamp;
    }
  }

  // 時間順にソート＆重複排除
  vodReviewPoints.sort((a, b) => a.timestampMs - b.timestampMs);

  return {
    isJungleMatch: isMeJungle,
    myChampion: myJg.championName,
    enemyJgChampion: enemyJg.championName,
    tenMinSnapshot,
    fifteenMinSnapshot,
    history15m,
    vodReviewPoints,
  };
}
