/**
 * サモナーズリフトの空間座標（X, Y: 0〜15000）の解析ユーティリティ
 * - エリア判定（自陣/敵陣ジャングル、ピット、リバー、レーン）
 * - 最寄り味方距離、孤立度判定
 * - 周囲2500ユニット以内の敵味方人数判定（数的優勢/劣勢）
 * - ミニマップ描画用パーセント座標変換
 */

export interface MapPosition {
  x: number;
  y: number;
}

export interface SpatialEvent {
  min: number;
  sec: number;
  timestamp: number;
  type: 'KILL' | 'DEATH' | 'OBJECTIVE';
  position: MapPosition;
  areaName: string;
  isolationLevel: 'ISOLATED' | 'FAR' | 'CLOSE';
  closestAllyDistance: number | null;
  alliesCountNearby: number;
  enemiesCountNearby: number;
  summary: string;
  killer?: string;
  victim?: string;
  objName?: string;
}

/**
 * 2点間のユークリッド距離を計算
 */
export function calculateDistance(p1: MapPosition, p2: MapPosition): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/**
 * 座標からサモナーズリフトのエリア名を特定する
 * teamId: 100 (Blue, 左下) / 200 (Red, 右上)
 */
export function getAreaName(pos: MapPosition, myTeamId: number = 100): string {
  const { x, y } = pos;

  // 1. 重要オブジェクトピット周辺
  // ドラゴンピット (x: 9800, y: 4400 付近)
  if (x >= 8500 && x <= 11000 && y >= 3200 && y <= 5600) {
    return '🐉 ドラゴンピット周辺';
  }
  // バロン / ヴォイドグラブピット (x: 5000, y: 10400 付近)
  if (x >= 3800 && x <= 6200 && y >= 9200 && y <= 11600) {
    return '👾 バロン/グラブピット周辺';
  }

  // 2. リバー（河川）帯 (左上〜右下の対角線帯)
  const sum = x + y;
  const isRiver = sum >= 12500 && sum <= 17500;

  if (isRiver) {
    if (y > 9000) return '🌊 トップ側リバー（上側スカトル地点）';
    if (y < 6000) return '🌊 ボット側リバー（下側スカトル地点）';
    return '🌊 ミッド周辺リバー';
  }

  // 3. レーン判定
  // TOPレーン (左上外周)
  if (x <= 3500 && y >= 7000) return '🛡️ TOPレーン沿い';
  if (x <= 7000 && y >= 11500) return '🛡️ TOPレーン沿い';

  // BOTレーン (右下外周)
  if (x >= 11500 && y <= 8000) return '🏹 BOTレーン沿い';
  if (x >= 8000 && y <= 3500) return '🏹 BOTレーン沿い';

  // MIDレーン (中央対角線 y ≈ x 付近)
  const diff = Math.abs(y - x);
  if (diff <= 1600 && x >= 4000 && x <= 11000) {
    return '⚔️ MIDレーン中央';
  }

  // 4. ジャングル判定（自陣 vs 敵陣）
  const isBlueSideTerritory = sum < 14000;
  const isMyTerritory = (myTeamId === 100 && isBlueSideTerritory) || (myTeamId === 200 && !isBlueSideTerritory);

  if (isBlueSideTerritory) {
    if (x < y) {
      return isMyTerritory ? '🌲 自陣青バフ側ジャングル' : '⚠️ 敵陣青バフ側ジャングル (侵入深部)';
    } else {
      return isMyTerritory ? '🌲 自陣赤バフ側ジャングル' : '⚠️ 敵陣赤バフ側ジャングル (侵入深部)';
    }
  } else {
    if (x > y) {
      return isMyTerritory ? '🌲 自陣青バフ側ジャングル' : '⚠️ 敵陣青バフ側ジャングル (侵入深部)';
    } else {
      return isMyTerritory ? '🌲 自陣赤バフ側ジャングル' : '⚠️ 敵陣赤バフ側ジャングル (侵入深部)';
    }
  }
}

/**
 * 孤立度と周囲人数を解析
 */
export function analyzeSpatialContext({
  eventPos,
  myParticipantId,
  myTeamId,
  allParticipantsPositions,
}: {
  eventPos: MapPosition;
  myParticipantId: number;
  myTeamId: number;
  allParticipantsPositions: { participantId: number; teamId: number; pos: MapPosition }[];
}) {
  let closestAllyDistance: number | null = null;
  let alliesCountNearby = 0;
  let enemiesCountNearby = 0;
  const NEARBY_RADIUS = 2800;

  for (const p of allParticipantsPositions) {
    if (p.participantId === myParticipantId) continue;
    const dist = calculateDistance(eventPos, p.pos);

    if (p.teamId === myTeamId) {
      if (closestAllyDistance === null || dist < closestAllyDistance) {
        closestAllyDistance = dist;
      }
      if (dist <= NEARBY_RADIUS) alliesCountNearby++;
    } else {
      if (dist <= NEARBY_RADIUS) enemiesCountNearby++;
    }
  }

  let isolationLevel: 'ISOLATED' | 'FAR' | 'CLOSE' = 'CLOSE';
  if (closestAllyDistance === null || closestAllyDistance >= 3500) {
    isolationLevel = 'ISOLATED';
  } else if (closestAllyDistance >= 2200) {
    isolationLevel = 'FAR';
  }

  const areaName = getAreaName(eventPos, myTeamId);

  return {
    areaName,
    isolationLevel,
    closestAllyDistance,
    alliesCountNearby,
    enemiesCountNearby,
  };
}

/**
 * サモナーズリフト座標(0〜15000)を、ミニマップCSS用パーセンテージに変換
 * LoL座標系は Y=0 が下、Y=15000 が上。CSSは top=0% が上、top=100% が下なので反転。
 */
export function posToPercent(pos: MapPosition): { left: string; top: string } {
  const left = Math.max(0, Math.min(100, (pos.x / 15000) * 100));
  const top = Math.max(0, Math.min(100, (1 - pos.y / 15000) * 100));
  return {
    left: `${left.toFixed(1)}%`,
    top: `${top.toFixed(1)}%`,
  };
}
