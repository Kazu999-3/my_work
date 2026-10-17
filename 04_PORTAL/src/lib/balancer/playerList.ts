import { getGroup } from "../../app/balancer/_parts/helpers";

// 内戦バランサーの参加者リストの並び替え・絞り込み。2026-10-07 app/balancer/page.tsx から分離（処理は分離前と同じ）。

/** グループ優先ソート（固定 > 通常参加 > 見学固定 > 不参加）→ 指定列 */
// ソロQランクは文字の順ではなく強さの順（以前は GOLD → PLATINUM → SILVER の文字順になっていた。2026-10-17）
const RANK_ORDER = ['UNRANKED', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
// 第1希望はレーン順（TOP → JG → MID → ADC → SUP → ALL）
const LANE_ORDER = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'];

function sortValue(p: any, key: string): any {
  if (key === 'highest_rank') return RANK_ORDER.indexOf(String(p.highest_rank || 'UNRANKED').split(' ')[0].toUpperCase());
  if (key === 'primary_lane') {
    const i = LANE_ORDER.indexOf(String(p.role_preferences?.primary || 'ALL').toUpperCase());
    return i < 0 ? LANE_ORDER.length : i;
  }
  return p[key];
}

export function sortPlayers(players: any[], sortConfig: { key: string; direction: string }): any[] {
  return [...players].sort((a, b) => {
    const ga = getGroup(a), gb = getGroup(b);
    if (ga !== gb) return ga - gb;
    let aVal = sortValue(a, sortConfig.key);
    let bVal = sortValue(b, sortConfig.key);
    const numericKeys = ["mmr", "no", "pity", "off_role_pity", "spectator_pity", "weight", "highest_rank", "primary_lane"];
    if (numericKeys.includes(sortConfig.key)) { aVal = Number(aVal)||0; bVal = Number(bVal)||0; }
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });
}

/** 名前検索・希望ロール・参加状態で絞り込む */
export function filterPlayers(sortedPlayers: any[], { searchQuery, roleFilter, statusFilter }: { searchQuery: string; roleFilter: string | null; statusFilter: string | null }): any[] {
  return sortedPlayers.filter(p => {
    if (!p) return false;
    const pName = (p.name || p.ign || '').toLowerCase();
    const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
    if (searchQuery && !pName.includes(searchQuery.trim().toLowerCase())) {
      return false;
    }
    if (roleFilter && prefs.primary !== roleFilter) {
      return false;
    }
    if (statusFilter) {
      if (statusFilter === 'active' && (!p.is_active || p.is_spectator_fixed)) return false;
      if (statusFilter === 'spectator' && !p.is_spectator_fixed) return false;
      if (statusFilter === 'inactive' && p.is_active) return false;
    }
    return true;
  });
}
