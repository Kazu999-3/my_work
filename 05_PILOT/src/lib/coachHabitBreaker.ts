/**
 * 2026年最新シーズン（Season 16）準拠 JG・悪癖診断エンジン (Habit Breaker Engine)
 * 試合タイムラインから、敗因に直結している「たった1つの致命的悪癖」を機械的に特定する。
 */

export interface ObjectiveWindow {
  name: string;
  spawnSec: number;
  dangerWindowStart: number; // 湧き45秒前
  importance: 'HIGH' | 'CRITICAL';
}

// 2026年（Season 16 / パッチ26.1〜）公式オブジェクトタイムライン
// ※スカトル初湧きが02:55に前倒し、幼虫は08:00に1回のみ、ヘラルド15:00、アタカンは完全削除
export const OBJECTIVES_2026: ObjectiveWindow[] = [
  { name: 'リフトスカトル(初湧き)', spawnSec: 175, dangerWindowStart: 145, importance: 'HIGH' }, // 02:55湧き (危険: 02:25〜)
  { name: '第1ドラゴン', spawnSec: 300, dangerWindowStart: 255, importance: 'HIGH' }, // 05:00湧き (危険: 04:15〜)
  { name: 'ヴォイドグラブ(幼虫・1回のみ)', spawnSec: 480, dangerWindowStart: 435, importance: 'CRITICAL' }, // 08:00湧き (危険: 07:15〜)
  { name: 'リフトヘラルド', spawnSec: 900, dangerWindowStart: 855, importance: 'CRITICAL' }, // 15:00湧き (危険: 14:15〜)
  { name: 'バロン・ナッシャー', spawnSec: 1200, dangerWindowStart: 1140, importance: 'CRITICAL' }, // 20:00湧き (危険: 19:15〜)
];

export interface DeathEvent {
  timestampSec: number;
  phase?: string;
  killer?: string;
  teamGoldDiffAtDeath?: number | null;
}

export interface HabitAuditResult {
  totalDeaths: number;
  objectiveThrowDeaths: Array<{
    deathSec: number;
    deathFormatted: string;
    objective: string;
    secondsBeforeSpawn: number;
  }>;
  primaryHabitTrap: {
    code: string;
    title: string;
    severity: 'CRITICAL' | 'WARNING' | 'CLEAN';
    description: string;
    nextGameActionRule: string; // 次戦のたった1つの合言葉
  };
}

export function auditPlayerHabits(
  deathTimeline: DeathEvent[],
  role: string = 'JUNGLE'
): HabitAuditResult {
  const isJg = role.toUpperCase().includes('JUNGLE') || role.toUpperCase().includes('JG');
  const objectiveThrows: HabitAuditResult['objectiveThrowDeaths'] = [];

  for (const d of deathTimeline) {
    const sec = d.timestampSec;
    for (const obj of OBJECTIVES_2026) {
      if (sec >= obj.dangerWindowStart && sec <= obj.spawnSec) {
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        objectiveThrows.push({
          deathSec: sec,
          deathFormatted: `${min}:${s.toString().padStart(2, '0')}`,
          objective: obj.name,
          secondsBeforeSpawn: obj.spawnSec - sec,
        });
        break;
      }
    }
  }

  // 悪癖の判定（優先度順）
  let primaryTrap: HabitAuditResult['primaryHabitTrap'] = {
    code: 'CLEAN_PLAY',
    title: '致命的悪癖なし（安定運用）',
    severity: 'CLEAN',
    description: 'オブジェクト前のデスや無謀な突入は抑えられています。',
    nextGameActionRule: '現状のルーティンを維持し、先手の仕掛け精度を磨く',
  };

  if (objectiveThrows.length >= 2) {
    primaryTrap = {
      code: 'OBJECTIVE_PRE_THROW',
      title: '【最悪癖】オブジェクト直前デッド（試合崩壊トリガー）',
      severity: 'CRITICAL',
      description: `2026年重要オブジェクト（カニ2:55・ドラ5:00・幼虫8:00・ヘラルド15:00・バロン20:00）の直前に ${objectiveThrows.length} 回デスしています。JGがオブジェクト直前に死ぬと、相手に完全無償で重要バフやリソースを献上します。`,
      nextGameActionRule: '『オブジェクト湧き45秒前になったら戦闘を即中断してリコール・視界確保』を絶対厳守',
    };
  } else if (objectiveThrows.length === 1) {
    const throwItem = objectiveThrows[0];
    primaryTrap = {
      code: 'CRITICAL_TIMING_DEATH',
      title: `【要改善】${throwItem.objective} 直前の孤立死`,
      severity: 'WARNING',
      description: `${throwItem.deathFormatted} にデスしたことで、直後の ${throwItem.objective} の主導権を失いました。`,
      nextGameActionRule: `${throwItem.objective} が湧く30秒前は視界なしエリアに絶対に入らない`,
    };
  } else if (isJg && deathTimeline.some((d) => d.timestampSec < 175)) {
    // 02:55カニ以前のデス
    primaryTrap = {
      code: 'EARLY_PATH_COLLAPSE',
      title: '【要改善】初動クリア崩壊デス',
      severity: 'WARNING',
      description: '02:55のカニ湧き以前にデスが発生しています。2026年はカニ湧きが02:55へ前倒しされたため、初動のデスはテンポ完全崩壊に繋がります。',
      nextGameActionRule: '敵JGとLv3で勝てない場合は、逆サイドスタートで確実に02:55スカトルを分ける',
    };
  }

  return {
    totalDeaths: deathTimeline.length,
    objectiveThrowDeaths: objectiveThrows,
    primaryHabitTrap: primaryTrap,
  };
}
