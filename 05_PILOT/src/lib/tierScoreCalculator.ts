import type { ChampionSummary } from "@/app/_champions/types";

// チャンピオン辞典の一覧で使う、OP.GG レーンメタからの Tier・順位・勝率の取得と並び替え用スコア。
// 2026-10-07 app/page.tsx から分離（計算内容は分離前と同じ）。

/** OP.GG レーンメタのキーに正規化する (TOP, JG, MID, ADC, SUP) */
export function normalizeLaneKey(role: string): string {
  if (!role) return "TOP";
  const upper = role.toUpperCase();
  if (upper === "JUNGLE") return "JG";
  if (upper === "BOT") return "ADC";
  if (upper === "SUPPORT") return "SUP";
  return upper;
}

export interface ChampTierMeta {
  tier: string | undefined;
  tierNum: number;
  rank: number;
  winRate: number;
  tierScore: number;
}

/**
 * 該当レーン（ロール絞り込み時）または第1ロールの Tier・勝率を取得する。
 * 全ロール表示で第1ロールのデータが無い時は、他レーンのうち最も Tier が高いものを使う。
 * tierScore: OP(0) → 60000点台, Tier 1 → 50000点台 … 圏外 → 0点
 */
export function getChampTierMeta(c: ChampionSummary, opggMeta: any, roleFilter: string): ChampTierMeta {
  if (!opggMeta?.lanes) return { tier: undefined, tierNum: 99, rank: 999, winRate: 0, tierScore: 0 };

  let m: any = null;
  if (roleFilter !== "ALL") {
    m = opggMeta.lanes[normalizeLaneKey(roleFilter)]?.[c.id];
  } else {
    m = opggMeta.lanes[normalizeLaneKey(c.roles[0] || "TOP")]?.[c.id];
    if (!m) {
      for (const lane of ["TOP", "JG", "MID", "ADC", "SUP"]) {
        const candidate = opggMeta.lanes[lane]?.[c.id];
        if (candidate && (!m || (candidate.tierNum ?? 5) < (m.tierNum ?? 5))) m = candidate;
      }
    }
  }

  if (!m) return { tier: undefined, tierNum: 99, rank: 999, winRate: 0, tierScore: 0 };

  let tierNum = typeof m.tierNum === "number" ? m.tierNum : 5;
  const tierStr = String(m.tier || "").toUpperCase();
  if (tierStr === "OP" || tierStr.includes("OP")) {
    tierNum = 0;
  } else {
    const match = tierStr.match(/\d+/);
    if (match) tierNum = parseInt(match[0], 10);
  }

  const rank = typeof m.rank === "number" ? m.rank : 999;
  const winRate = typeof m.winRate === "number" ? m.winRate : 0;
  const tierScore = (6 - Math.min(6, tierNum)) * 10000 + Math.max(0, 1000 - rank * 10) + winRate;
  return { tier: m.tier, tierNum, rank, winRate, tierScore };
}


/**
 * 一覧の絞り込み（名前・通称・ロール・お気に入り）と並び替え（Tier・名前・勝率・ナレッジ数）。
 * 2026-10-07 app/page.tsx から分離（処理は分離前と同じ）。
 */
export function filterAndSortChampions(
  displayChampions: ChampionSummary[],
  opts: { search: string; roleFilter: string; showFavoritesOnly: boolean; favorites: string[]; champSort: string; opggMeta: any; aliases: Record<string, string[]> },
): ChampionSummary[] {
  const { search, roleFilter, showFavoritesOnly, favorites, champSort, opggMeta, aliases: CHAMP_ALIASES } = opts;
  const list = displayChampions.filter((c) => {
    const q = search.trim().toLowerCase();
    
    // 通称・エイリアス判定
    const aliases = CHAMP_ALIASES[c.id] || [];
    const matchAlias = aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));

    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.jpName.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      matchAlias;

    const targetRoles = roleFilter === "ADC" ? ["ADC", "BOT"] : [roleFilter];
    const matchRole =
      roleFilter === "ALL" ||
      c.roles.some((r) => targetRoles.includes(r));

    const matchFav = !showFavoritesOnly || favorites.includes(c.id);

    return matchSearch && matchRole && matchFav;
  });

  const getChampMeta = (c: ChampionSummary) => getChampTierMeta(c, opggMeta, roleFilter);

  list.sort((a, b) => {
    if (champSort === "tier") {
      const metaA = getChampMeta(a);
      const metaB = getChampMeta(b);
      if (metaB.tierScore !== metaA.tierScore) {
        return metaB.tierScore - metaA.tierScore;
      }
      return a.jpName.localeCompare(b.jpName, "ja");
    } else if (champSort === "name_ja") {
      return a.jpName.localeCompare(b.jpName, "ja");
    } else if (champSort === "name_en") {
      return a.id.localeCompare(b.id);
    } else if (champSort === "win_rate") {
      const metaA = getChampMeta(a);
      const metaB = getChampMeta(b);
      const wrA = metaA.winRate || 0;
      const wrB = metaB.winRate || 0;
      if (wrB !== wrA) return wrB - wrA;
      return a.jpName.localeCompare(b.jpName, "ja");
    } else if (champSort === "knowledge") {
      const countA = (a.videoBibleCount || 0) + (a.libraryKnowledgeCount || 0);
      const countB = (b.videoBibleCount || 0) + (b.libraryKnowledgeCount || 0);
      return countB - countA;
    }
    return 0;
  });

  return list;
}
