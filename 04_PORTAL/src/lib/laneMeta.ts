import { ChampionRole, ChampionMeta, CHAMPION_METADATA } from './championMetadata';
import { LOLALYTICS_LANE_META, ChampionLaneStats } from './data/lolalyticsLaneMeta';

export type { ChampionLaneStats };

export interface RoleChampionsBreakdown {
  standard: ChampionMeta[];
  offmeta: ChampionMeta[];
  all: ChampionMeta[];
}

/**
 * 指定したロールの「通常ピック」と「オフメタ枠」のチャンピオン一覧を取得する（Lolalytics過去30日統計準拠）
 */
export function getRoleChampionsBreakdown(role: ChampionRole): RoleChampionsBreakdown {
  const laneData = LOLALYTICS_LANE_META.lanes[role];

  if (!laneData) {
    return { standard: [], offmeta: [], all: [] };
  }

  const standard: ChampionMeta[] = [];
  const offmeta: ChampionMeta[] = [];

  // 通常枠
  laneData.standard.forEach((id) => {
    const meta = CHAMPION_METADATA[id];
    if (meta) standard.push(meta);
  });

  // オフメタ枠
  laneData.offmeta.forEach((id) => {
    const meta = CHAMPION_METADATA[id];
    if (meta) offmeta.push(meta);
  });

  return {
    standard,
    offmeta,
    all: [...standard, ...offmeta],
  };
}

/**
 * そのチャンピオンが指定ロールでオフメタ枠（PR < 0.5%）かどうかを判定
 */
export function isChampOffmetaInRole(role: ChampionRole, champId: string): boolean {
  const laneData = LOLALYTICS_LANE_META.lanes[role];
  if (!laneData || !laneData.details[champId]) return false;
  return laneData.details[champId].isOffmeta;
}

/**
 * そのチャンピオンの指定ロールでのLolalytics統計（PR/WR/ゲーム数）を取得
 */
export function getChampLaneStats(role: ChampionRole, champId: string): ChampionLaneStats | null {
  const laneData = LOLALYTICS_LANE_META.lanes[role];
  if (!laneData || !laneData.details[champId]) return null;
  return laneData.details[champId];
}
