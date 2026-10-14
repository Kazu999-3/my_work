/**
 * ==============================================================================
 * 🛡️ ソロQ 味方トロール・事故マッチ検知エンジン (trollDetector.ts)
 * ==============================================================================
 *
 * 【目的】
 * Riot Match-V5 の実測データに基づき、味方チーム（自分以外の4人）の中に
 * 「明らかな意図的利敵（Inting）」「放置・AFK」「トロールビルド」などの
 * 不可抗力な敗北要因が存在したかを客観的に判定する。
 *
 * 【設計思想】
 * - 敗因を「自分の責任」と「味方の事故（防ぎようのない試合）」に切り分け、
 *   無用な自己否定によるティルトを防ぐ（アンチティルト・メンタル保護）。
 * - 単なる「初心者・不調」と「明らかな利敵・AFK」を厳密に区別する。
 */

export interface TrollDetectedPlayer {
  championName: string;
  lane: string;
  kills: number;
  deaths: number;
  assists: number;
  kdaStr: string;
  damageDealt: number;
  damageShare: number;
  killParticipation: number;
  cs: number;
  champLevel: number;
}

export interface TrollAnalysisResult {
  detected: boolean;
  severity: 'severe' | 'moderate' | 'none';
  trollPlayer: TrollDetectedPlayer | null;
  reasons: string[];
  verdictTitle: string;
  verdictDescription: string;
  cheerMessage: string;
}

// 主な靴アイテムID一覧（通常靴・進化靴・特殊靴）
const BOOTS_ITEM_IDS = new Set([
  1001, // Boots
  3006, // Berserker's Greaves
  3009, // Boots of Swiftness
  3020, // Sorcerer's Shoes
  3047, // Plated Steelcaps
  3111, // Mercury's Treads
  3117, // Mobility Boots
  3158, // Ionian Boots of Lucidity
  2422, // Slightly Magical Footwear
  3005, // Symbiotic Soles
  3008, // Synchronized Souls
]);

export interface RawParticipant {
  puuid: string;
  teamId: number;
  championName: string;
  lane?: string;
  teamPosition?: string;
  kills: number;
  deaths: number;
  assists: number;
  totalDamageDealtToChampions?: number;
  damageDealtToChampions?: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  champLevel?: number;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  gameEndedInEarlySurrender?: boolean;
  gameEndedInSurrender?: boolean;
}

/**
 * 1試合内の味方チームを検査し、トロール・事故要因を検出する
 */
export function detectAlliesTroll(
  participants: RawParticipant[],
  myPuuid: string,
  gameDurationSec: number,
): TrollAnalysisResult {
  const me = participants.find((p) => p.puuid === myPuuid);
  if (!me) {
    return {
      detected: false,
      severity: 'none',
      trollPlayer: null,
      reasons: [],
      verdictTitle: '判定対象外',
      verdictDescription: '自身のアカウント情報が見つかりませんでした。',
      cheerMessage: '',
    };
  }

  const durationMin = Math.max(1, gameDurationSec / 60);
  const myTeam = participants.filter((p) => p.teamId === me.teamId);
  const allies = myTeam.filter((p) => p.puuid !== me.puuid);

  // チーム全体の合計値（ダメージ、キル数）
  const teamTotalDamage = myTeam.reduce(
    (sum, p) => sum + (p.damageDealtToChampions || p.totalDamageDealtToChampions || 0),
    0,
  );
  const teamTotalKills = myTeam.reduce((sum, p) => sum + p.kills, 0);

  let worstResult: {
    player: RawParticipant;
    severity: 'severe' | 'moderate';
    reasons: string[];
    damageShare: number;
    kp: number;
  } | null = null;

  for (const p of allies) {
    const reasons: string[] = [];
    const dmg = p.damageDealtToChampions || p.totalDamageDealtToChampions || 0;
    const damageShare = teamTotalDamage > 0 ? Math.round((dmg / teamTotalDamage) * 100) : 0;
    const kp = teamTotalKills > 0 ? Math.round(((p.kills + p.assists) / teamTotalKills) * 100) : 0;
    const deathsPerMin = p.deaths / durationMin;
    const isSupport = (p.teamPosition || p.lane || '').toUpperCase().includes('UTILITY') || (p.teamPosition || p.lane || '').toUpperCase().includes('SUP');
    const isEarlySurrender = Boolean(p.gameEndedInEarlySurrender);

    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(
      (id): id is number => typeof id === 'number' && id > 0,
    );

    // ---- 1. トロールビルドの判定（靴の複数購入など） ----
    const bootsCount = items.filter((id) => BOOTS_ITEM_IDS.has(id)).length;
    if (bootsCount >= 2) {
      reasons.push(`靴を${bootsCount}足購入する利敵ビルド`);
    }

    // 同一未進化素材（涙3003、ルビー400、ダガー300等）の4個以上重複買い
    const itemFreq: Record<number, number> = {};
    for (const it of items) itemFreq[it] = (itemFreq[it] || 0) + 1;
    for (const [itId, cnt] of Object.entries(itemFreq)) {
      if (cnt >= 4 && Number(itId) !== 2055) { // コントロールワード(2055)除く
        reasons.push(`同アイテム(${cnt}個)の大量重複購入`);
        break;
      }
    }

    // ---- 2. 放置・実質AFKの判定 ----
    const champLevel = p.champLevel || 1;
    if (!isEarlySurrender && durationMin >= 15) {
      // 15分以上経過しているのにLv6以下
      if (champLevel <= 6) {
        reasons.push(`15分超の試合でLv${champLevel}（実質AFK・長期放置）`);
      }
      // 通常レーナー/JGで与ダメが異常に低い（1,200未満）かつKP 10%未満
      else if (!isSupport && dmg < 1200 && kp <= 10) {
        reasons.push(`与ダメージ${dmg} / KP ${kp}%（交戦への完全な不参加）`);
      }
    }

    // ---- 3. 意図的利敵・暴走フィーディング（Inting） ----
    // 条件A: 分間0.55デス以上（約1.8分に1回死亡）かつ10デス以上、KP 20%以下
    if (p.deaths >= 10 && deathsPerMin >= 0.55 && kp <= 20) {
      reasons.push(`異常なデス頻度（${p.deaths}デス / 分間${deathsPerMin.toFixed(2)}回）かつ関与率${kp}%`);
    }
    // 条件B: 0〜1キルで12デス以上、KP 15%以下
    else if (p.kills <= 1 && p.deaths >= 12 && kp <= 15) {
      reasons.push(`極端な大量デス（${p.kills}/${p.deaths}/${p.assists} / 関与率${kp}%）`);
    }

    // ---- 4. 著しい大崩壊（Moderate判定） ----
    if (reasons.length === 0) {
      if (p.deaths >= 10 && p.kills === 0 && kp <= 10) {
        reasons.push(`0キル${p.deaths}デス（キル関与率${kp}%の大敗）`);
      } else if (durationMin >= 20 && damageShare <= 4 && kp <= 10 && !isSupport) {
        reasons.push(`チーム与ダメシェア${damageShare}%（深刻な稼働停止）`);
      }
    }

    if (reasons.length > 0) {
      const isSevere =
        bootsCount >= 2 ||
        reasons.some((r) => r.includes('利敵ビルド') || r.includes('AFK') || r.includes('異常なデス頻度') || r.includes('極端な大量デス'));
      const severity: 'severe' | 'moderate' = isSevere ? 'severe' : 'moderate';

      if (!worstResult || (severity === 'severe' && worstResult.severity !== 'severe') || reasons.length > worstResult.reasons.length) {
        worstResult = {
          player: p,
          severity,
          reasons,
          damageShare,
          kp,
        };
      }
    }
  }

  if (!worstResult) {
    return {
      detected: false,
      severity: 'none',
      trollPlayer: null,
      reasons: [],
      verdictTitle: '通常試合',
      verdictDescription: '味方に明らかな意図的利敵やAFK等のシグナルは検出されませんでした。',
      cheerMessage: '',
    };
  }

  const tp = worstResult.player;
  const laneDisplay = tp.teamPosition || tp.lane || 'UNKNOWN';

  const verdictTitle =
    worstResult.severity === 'severe'
      ? '⚠️ 味方トロール・事故マッチ検知'
      : '⚠️ 味方の大崩壊・事故マッチ検知';

  const verdictDescription = `味方の ${tp.championName} (${laneDisplay}) に明らかな事故・トロール要因が検知されました: ${worstResult.reasons.join('、')}。`;

  const cheerMessage =
    worstResult.severity === 'severe'
      ? 'この試合の敗北はあなたの立ち回りによるものではありません。反省ポイントを探しすぎて自信を失わないようにし、気持ちを切り替えて次の試合へ向かいましょう！'
      : '味方レーンの著しい大崩壊による不可抗力の試合です。個人の反省に悩みすぎず、次の試合で実力を発揮しましょう！';

  return {
    detected: true,
    severity: worstResult.severity,
    trollPlayer: {
      championName: tp.championName,
      lane: laneDisplay,
      kills: tp.kills,
      deaths: tp.deaths,
      assists: tp.assists,
      kdaStr: `${tp.kills}/${tp.deaths}/${tp.assists}`,
      damageDealt: tp.damageDealtToChampions || tp.totalDamageDealtToChampions || 0,
      damageShare: worstResult.damageShare,
      killParticipation: worstResult.kp,
      cs: tp.totalMinionsKilled + tp.neutralMinionsKilled,
      champLevel: tp.champLevel || 1,
    },
    reasons: worstResult.reasons,
    verdictTitle,
    verdictDescription,
    cheerMessage,
  };
}
