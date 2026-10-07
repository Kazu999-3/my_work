import { getGroup } from "../../app/balancer/_parts/helpers";

// 内戦バランサーの参加者リストの並び替え・絞り込み。2026-10-07 app/balancer/page.tsx から分離（処理は分離前と同じ）。

/** グループ優先ソート（固定 > 通常参加 > 見学固定 > 不参加）→ 指定列 */
export function sortPlayers(players: any[], sortConfig: { key: string; direction: string }): any[] {
  return [...players].sort((a, b) => {
    const ga = getGroup(a), gb = getGroup(b);
    if (ga !== gb) return ga - gb;
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    const numericKeys = ["mmr", "no", "pity", "off_role_pity", "spectator_pity", "weight"];
    if (numericKeys.includes(sortConfig.key)) { aVal = parseInt(aVal)||0; bVal = parseInt(bVal)||0; }
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
