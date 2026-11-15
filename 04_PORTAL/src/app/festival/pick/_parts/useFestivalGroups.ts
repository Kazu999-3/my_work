import { useMemo } from 'react';
import {
  ALL_METADATA_CHAMPIONS,
  ROLES_LIST,
  RegionKey,
  ChampionRole,
  ChampionClass,
  ChampionMeta,
} from '../../../../lib/championMetadata';
import { getRoleChampionsBreakdown } from '../../../../lib/laneMeta';

export function useFestivalGroups(searchQuery: string, excludedIds: Set<string>) {
  // 検索フィルタ済みの全チャンピオン
  const filteredChamps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_METADATA_CHAMPIONS.filter((meta) => {
      if (!q) return true;
      return (
        meta.name.toLowerCase().includes(q) ||
        meta.ruby.toLowerCase().includes(q) ||
        meta.id.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  // 残り有効チャンピオン数
  const activeCount = useMemo(() => {
    return filteredChamps.filter((c) => !excludedIds.has(c.id)).length;
  }, [filteredChamps, excludedIds]);

  // 地域別グループ
  const regionGroups = useMemo(() => {
    const map: Record<RegionKey, ChampionMeta[]> = {
      Ionia: [],
      Demacia: [],
      Noxus: [],
      Piltover: [],
      Zaun: [],
      Freljord: [],
      Shurima: [],
      Targon: [],
      Bilgewater: [],
      ShadowIsles: [],
      Ixtal: [],
      Void: [],
      BandleCity: [],
      Runeterra: [],
    };
    filteredChamps.forEach((c) => {
      if (map[c.region]) map[c.region].push(c);
      else map.Runeterra.push(c);
    });
    return map;
  }, [filteredChamps]);

  // ロール別グループ＆Lolalytics過去30日準拠の内訳（通常 / オフメタ）
  const roleBreakdowns = useMemo(() => {
    const filterSet = new Set(filteredChamps.map((c) => c.id));
    const result: Record<ChampionRole, { standard: ChampionMeta[]; offmeta: ChampionMeta[]; all: ChampionMeta[] }> = {
      TOP: { standard: [], offmeta: [], all: [] },
      JG: { standard: [], offmeta: [], all: [] },
      MID: { standard: [], offmeta: [], all: [] },
      ADC: { standard: [], offmeta: [], all: [] },
      SUP: { standard: [], offmeta: [], all: [] },
    };

    ROLES_LIST.forEach((role) => {
      const b = getRoleChampionsBreakdown(role);
      const std = b.standard.filter((c) => filterSet.has(c.id));
      const off = b.offmeta.filter((c) => filterSet.has(c.id));
      result[role] = {
        standard: std,
        offmeta: off,
        all: [...std, ...off],
      };
    });

    return result;
  }, [filteredChamps]);

  const roleGroups = useMemo(() => {
    const map: Record<ChampionRole, ChampionMeta[]> = {
      TOP: roleBreakdowns.TOP.all,
      JG: roleBreakdowns.JG.all,
      MID: roleBreakdowns.MID.all,
      ADC: roleBreakdowns.ADC.all,
      SUP: roleBreakdowns.SUP.all,
    };
    return map;
  }, [roleBreakdowns]);

  // クラス別グループ
  const classGroups = useMemo(() => {
    const map: Record<ChampionClass, ChampionMeta[]> = {
      Fighter: [],
      Mage: [],
      Assassin: [],
      Marksman: [],
      Tank: [],
      Support: [],
    };
    filteredChamps.forEach((c) => {
      if (map[c.class]) map[c.class].push(c);
      else map.Fighter.push(c);
    });
    return map;
  }, [filteredChamps]);

  return {
    filteredChamps,
    activeCount,
    regionGroups,
    roleBreakdowns,
    roleGroups,
    classGroups,
  };
}
