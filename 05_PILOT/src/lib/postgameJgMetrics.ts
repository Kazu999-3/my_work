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

export interface JgBenchmark {
  firstClearTimeSec: number | null; // 1周目フルクリア完了秒（例: 205秒 = 3:25）
  firstClearTimeStr: string | null;
  firstClearGrade: 'S' | 'A' | 'SLOW' | null;
  firstClearTargetStr: string; // "3:15〜3:30 (プロ/OTP基準)"
  tenMinCsTarget: {
    actual: number;
    target: number; // 72 CS (FORESTER 10分0/0/0 勝率50.9%維持ライン)
    ratioPercent: number; // actual / target * 100
    isMaintained: boolean; // actual >= 72
  };
  tenMinGoldBorder: {
    diff: number;
    tier: 'SUPER_DOMINANT' | 'DOMINANT' | 'LEAD' | 'SLIGHT_LEAD' | 'EVEN' | 'BEHIND';
    expectedWinRate: string; // "72.01%" etc
    title: string;
    description: string;
  };
  farmComebackLead: {
    enemyEarlyKpLead: boolean; // 敵が先にK+A獲得
    myCsDiff: number;
    comebackAchieved: boolean; // CS差 +11以上 (勝率53.0%)
    highComebackAchieved: boolean; // CS差 +21以上 (勝率65.2%)
    message: string | null;
  };
}

export interface VodReviewPoint {
  id: string;
  timestampMs: number;
  timeStr: string;
  type: 'OBJECTIVE_DEATH' | 'KILL_TO_OBJECTIVE' | 'RAPID_DEATH' | 'HEAVY_GOLD_SWING' | 'FARM_LOSS_GANK';
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
  benchmark: JgBenchmark | null;
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
      benchmark: null,
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

  // 3. プロ・OTP直接比較 ＆ 10分ベンチマーク算出
  const skillLevelUps = allEvents.filter(
    (ev) => ev.type === 'SKILL_LEVEL_UP' && ev.participantId === myPIdx,
  );
  // 4回目 = Lv4到達（1周目フルクリアの指標）
  const level4Ev = skillLevelUps[3];
  let firstClearTimeSec: number | null = null;
  let firstClearTimeStr: string | null = null;
  let firstClearGrade: 'S' | 'A' | 'SLOW' | null = null;

  if (level4Ev && level4Ev.timestamp <= 300_000) {
    firstClearTimeSec = Math.floor(level4Ev.timestamp / 1000);
    firstClearTimeStr = fmtMs(level4Ev.timestamp);
    if (firstClearTimeSec <= 205) {
      firstClearGrade = 'S'; // 3:25以内
    } else if (firstClearTimeSec <= 215) {
      firstClearGrade = 'A'; // 3:35以内（スカトル3:30に間に合う）
    } else {
      firstClearGrade = 'SLOW'; // 3:35超
    }
  }

  // 10分ファーム目標 (72〜80CS = FORESTER 10分0/0/0 勝率50.9%維持)
  const tenCs = tenMinSnapshot?.me.cs || 0;
  const tenMinCsTarget = {
    actual: tenCs,
    target: 72,
    ratioPercent: Math.round((tenCs / 72) * 100),
    isMaintained: tenCs >= 72,
  };

  // 10分ゴールド格差ボーダー (FORESTER 3.7万試合データ)
  const goldDiff10 = tenMinSnapshot?.diff.goldDiff || 0;
  let gTier: JgBenchmark['tenMinGoldBorder']['tier'] = 'EVEN';
  let gExpectedWinRate = '51.85%';
  let gTitle = 'ゴールド均衡（ほぼ五分）';
  let gDescription = '200G未満の差は統計上ほぼ五分(51.85%)です。焦る必要はありません。';

  if (goldDiff10 >= 1000) {
    gTier = 'SUPER_DOMINANT';
    gExpectedWinRate = '72.01%';
    gTitle = '勝率72.01% 最高勝利ボーダー';
    gDescription = '10分時点で+1,000G以上の圧倒的リード。3.7万試合実証で勝率72%を超える支配的状況です。';
  } else if (goldDiff10 >= 600) {
    gTier = 'DOMINANT';
    gExpectedWinRate = '63.53%';
    gTitle = '勝率63.53% 主導権掌握ゾーン';
    gDescription = '10分時点で+600G以上のリード。装備先行によりドラゴン・交戦権を握っています。';
  } else if (goldDiff10 >= 400) {
    gTier = 'LEAD';
    gExpectedWinRate = '59.17%';
    gTitle = '勝率59.17% 安定リード';
    gDescription = 'キル1個分(+400G)の差を構築。手堅い進行です。';
  } else if (goldDiff10 >= 200) {
    gTier = 'SLIGHT_LEAD';
    gExpectedWinRate = '54.99%';
    gTitle = '勝率54.99% わずかなリード';
    gDescription = 'わずかにリードしていますが、1回の交戦で逆転されうる僅差です。';
  } else if (goldDiff10 <= -1000) {
    gTier = 'BEHIND';
    gExpectedWinRate = '27.99%';
    gTitle = '勝率27.99% 重度ビハインド';
    gDescription = '敵JGに1,000G以上のリードを許しています。無理なファイトを避け、味方の受けに回りましょう。';
  } else if (goldDiff10 < -200) {
    gTier = 'BEHIND';
    gExpectedWinRate = '40.83%';
    gTitle = 'ゴールド劣勢';
    gDescription = '敵JGがゴールド先行しています。カウンタージャングル警戒と確実な自陣ファームが必要です。';
  }

  // 敵先行K+A時のファーム逆転判定
  const enemyKp10 = tenMinSnapshot?.enemy.kp || 0;
  const myKp10 = tenMinSnapshot?.me.kp || 0;
  const csDiff10 = tenMinSnapshot?.diff.csDiff || 0;
  const enemyEarlyKpLead = enemyKp10 > myKp10;
  let comebackAchieved = false;
  let highComebackAchieved = false;
  let comebackMessage: string | null = null;

  if (enemyEarlyKpLead) {
    if (csDiff10 >= 21) {
      comebackAchieved = true;
      highComebackAchieved = true;
      comebackMessage = '【勝率65.2%逆転ゾーン達成】敵JGがキル先行しましたが、死なずに+21CS以上の差を広げて大幅逆転に成功しました！';
    } else if (csDiff10 >= 11) {
      comebackAchieved = true;
      comebackMessage = '【勝率53.0%逆転ゾーン達成】敵のキル有利を、自陣のファームリード(+11CS以上)で跳ね返しました。';
    } else if (csDiff10 >= 0) {
      comebackMessage = '敵のキル先行に対しファームで追従していますが、キル有利を覆すには+11CS以上の差が必要です。';
    } else {
      comebackMessage = '敵JGにキルもファームも先行されています。まずはデスせず自陣キャンプを回し切りましょう。';
    }
  }

  const benchmark: JgBenchmark = {
    firstClearTimeSec,
    firstClearTimeStr,
    firstClearGrade,
    firstClearTargetStr: '3:15〜3:30 (プロ/OTP基準)',
    tenMinCsTarget,
    tenMinGoldBorder: {
      diff: goldDiff10,
      tier: gTier,
      expectedWinRate: gExpectedWinRate,
      title: gTitle,
      description: gDescription,
    },
    farmComebackLead: {
      enemyEarlyKpLead,
      myCsDiff: csDiff10,
      comebackAchieved,
      highComebackAchieved,
      message: comebackMessage,
    },
  };

  // (4) Lv9未満キル後のファームロス・XP損失検証（FORESTER Lv9境界線モデル）
  const level9Ev = skillLevelUps[8];
  const lv9CutoffMs = level9Ev ? level9Ev.timestamp : 540_000; // Lv9未満 (最大9分)

  const getCsAtMs = (ms: number, pId: number) => {
    const m = Math.min(Math.max(0, Math.floor(ms / 60_000)), frames.length - 1);
    const pf = frames[m]?.participantFrames?.[String(pId)];
    return (pf?.minionsKilled || 0) + (pf?.jungleMinionsKilled || 0);
  };

  for (const kEv of championKillEvents) {
    if (kEv.timestamp < lv9CutoffMs) {
      const isMyInvolvement =
        kEv.killerId === myPIdx ||
        (kEv.assistingParticipantIds && kEv.assistingParticipantIds.includes(myPIdx));
      if (isMyInvolvement) {
        const myCsNow = getCsAtMs(kEv.timestamp, myPIdx);
        const myCsNext = getCsAtMs(kEv.timestamp + 60_000, myPIdx);
        const enemyCsNow = getCsAtMs(kEv.timestamp, enemyPIdx);
        const enemyCsNext = getCsAtMs(kEv.timestamp + 60_000, enemyPIdx);

        const myGained = myCsNext - myCsNow;
        const enemyGained = enemyCsNext - enemyCsNow;

        // 自分のCSが1以下かつ敵が4以上（1キャンプ以上）ファーム
        if (myGained <= 1 && enemyGained >= 4) {
          const kLv = skillLevelUps.filter((ev) => ev.timestamp <= kEv.timestamp).length + 1;
          vodReviewPoints.push({
            id: `farm-loss-${kEv.timestamp}`,
            timestampMs: kEv.timestamp,
            timeStr: fmtMs(kEv.timestamp),
            type: 'FARM_LOSS_GANK',
            importance: 'HIGH',
            title: `Lv${kLv} キル成功後のファームロス（XP逆転リスク）`,
            description: `キルに関与（+300G）しましたが、Lv9未満のためデスタイマーが短くウェーブを焼き切れませんでした。その間に対面JGがキャンプを回り続け(+${enemyGained}CS)、XPで差を詰められた・逆転された可能性があります。`,
            vodTip: `VODで「キル後に敵タワーへウェーブを押し込む余地があったか」「無理にガンクせずフルクリアを先行すべきだったか」を確認してください。`,
          });
        }
      }
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
    benchmark,
    vodReviewPoints,
  };
}
