/**
 * JG向けリアルタイム レーン主導権 (Lane Priority / Prio) ＆ パワースパイク計算エンジン
 * Live Client Data API から取得した全10人のデータをもとに、
 * 各レーン（TOP, MID, BOT）の有利・不利、パワースパイク、およびJGの最適行動を算出する。
 */

export type PrioStatus = 'ally_prio' | 'enemy_prio' | 'even';

export interface LanePrioInfo {
  lane: 'TOP' | 'MID' | 'BOT';
  laneLabel: string;
  allyChamp: string;
  enemyChamp: string;
  allyLevel: number;
  enemyLevel: number;
  csDiff: number; // 味方 - 敵
  prio: PrioStatus;
  spike: string | null; // 例: "Lv6先行", "1コア完成", "ウルト解禁"
  advice: string; // JG向け1行判断
}

export interface MacroPriorityReport {
  lanes: LanePrioInfo[];
  overallAdvice: string;
  topSidePrio: boolean; // 幼虫・ヘラルド・上スカトルに行けるか
  botSidePrio: boolean; // ドラゴン・下スカトルに行けるか
}

export interface PlayerData {
  championName: string;
  team: string; // 'ORDER' | 'CHAOS'
  position: string; // 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | 'NONE'
  level?: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  items?: number[];
  isDead?: boolean;
}

export function calculateLanePriority(
  allPlayers: PlayerData[],
  myTeam: string,
  gameTimeSec: number = 0
): MacroPriorityReport {
  const lanesConfig: Array<{ key: 'TOP' | 'MID' | 'BOT'; label: string; pos: string[] }> = [
    { key: 'TOP', label: 'TOP', pos: ['TOP'] },
    { key: 'MID', label: 'MID', pos: ['MIDDLE', 'MID'] },
    { key: 'BOT', label: 'BOT', pos: ['BOTTOM', 'BOT', 'UTILITY'] },
  ];

  const laneResults: LanePrioInfo[] = [];

  for (const cfg of lanesConfig) {
    const allies = allPlayers.filter((p) => p.team === myTeam && cfg.pos.includes(p.position));
    const enemies = allPlayers.filter((p) => p.team !== myTeam && cfg.pos.includes(p.position));

    if (allies.length === 0 || enemies.length === 0) continue;

    // BOTレーンはADCメインまたは2人の合計で判定
    const allyMain = allies[0];
    const enemyMain = enemies[0];

    const allyLevel = allyMain.level || 1;
    const enemyLevel = enemyMain.level || 1;
    const csDiff = allyMain.cs - enemyMain.cs;

    // 生存状況
    const allyDead = allies.some((p) => p.isDead);
    const enemyDead = enemies.some((p) => p.isDead);

    // 主導権 (Prio) 判定
    let prio: PrioStatus = 'even';
    let spike: string | null = null;
    let advice = 'リバー戦・ガンクは慎重に';

    // 1. パワースパイク判定
    if (allyLevel >= 6 && enemyLevel < 6) {
      spike = '味方Lv6先行⚡';
    } else if (enemyLevel >= 6 && allyLevel < 6) {
      spike = '⚠️敵Lv6到達';
    } else if (gameTimeSec < 180 && allyLevel >= 2 && enemyLevel === 1) {
      spike = 'Lv2先行';
    }

    // 2. 主導権ロジック
    if (enemyDead && !allyDead) {
      prio = 'ally_prio';
      advice = cfg.key === 'TOP' || cfg.key === 'MID' ? '🐛 幼虫/上スカトル即フリー' : '🐉 ドラゴン即フリー';
    } else if (allyDead && !enemyDead) {
      prio = 'enemy_prio';
      advice = '🛑 オブジェクト禁止・自陣防衛';
    } else if (csDiff >= 7 || allyLevel > enemyLevel) {
      prio = 'ally_prio';
      if (cfg.key === 'TOP') advice = '🐛 幼虫・上リバー優位';
      else if (cfg.key === 'MID') advice = '👑 センター主導権あり・両サイド寄り可';
      else advice = '🐉 ドラゴン側主導権あり';
    } else if (csDiff <= -7 || enemyLevel > allyLevel) {
      prio = 'enemy_prio';
      advice = '🎯 敵がプッシュ中（ガンク狙い目）';
    } else {
      prio = 'even';
      advice = '互角・ウェーブ状況を見て寄りを判断';
    }

    laneResults.push({
      lane: cfg.key,
      laneLabel: cfg.label,
      allyChamp: allyMain.championName,
      enemyChamp: enemyMain.championName,
      allyLevel,
      enemyLevel,
      csDiff,
      prio,
      spike,
      advice,
    });
  }

  // 全体マクロ判断
  const topPrio = laneResults.find((l) => l.lane === 'TOP')?.prio === 'ally_prio';
  const midPrio = laneResults.find((l) => l.lane === 'MID')?.prio === 'ally_prio';
  const botPrio = laneResults.find((l) => l.lane === 'BOT')?.prio === 'ally_prio';

  const topSideOk = (topPrio && midPrio) || (topPrio && !botPrio);
  const botSideOk = (botPrio && midPrio) || (botPrio && !topPrio);

  let overallAdvice = '各レーン互角: 敵JGの位置確認を最優先';
  if (topPrio && midPrio) {
    overallAdvice = '🔥 上半分制圧: ヴォイドグラブ・上スカトル独占可能';
  } else if (botPrio && midPrio) {
    overallAdvice = '🔥 下半分制圧: ドラゴン・下スカトル優先ルート';
  } else if (!topPrio && !midPrio && !botPrio) {
    overallAdvice = '⚠️ 全レーン劣勢: カウンターガンク警戒・逆サイドファーム徹底';
  } else if (topPrio) {
    overallAdvice = 'Top有利: 幼虫触れます（Midの寄り注意）';
  } else if (botPrio) {
    overallAdvice = 'Bot有利: ドラゴン触れます（Midの寄り注意）';
  }

  return {
    lanes: laneResults,
    overallAdvice,
    topSidePrio: topSideOk,
    botSidePrio: botSideOk,
  };
}
