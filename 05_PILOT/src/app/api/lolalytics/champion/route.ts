import { NextResponse } from 'next/server';

const LOLALYTICS_BASE = "https://a1.lolalytics.com/mega/";
const DEFAULT_PATCH = "30"; // 過去30日
const DEFAULT_TIER = "emerald_plus";

const LANE_MAP: Record<string, string> = {
  top: "top",
  jg: "jungle",
  jungle: "jungle",
  mid: "middle",
  middle: "middle",
  bot: "bottom",
  adc: "bottom",
  bottom: "bottom",
  sup: "support",
  supp: "support",
  support: "support",
};

const BOOT_IDS = new Set([
  3006, 3009, 3047, 3111, 3117, 3158, 3020, 2422,
]);

// サーバーインメモリキャッシュ（TTL: 1時間）
const CACHE_TTL_MS = 60 * 60 * 1000;
const memoryCache = new Map<string, { at: number; data: any }>();

// DataDragon キャッシュ
let ddragonCache: {
  version: string;
  champById: Map<string, any>;
  champByKey: Map<number, any>;
  champBySlug: Map<string, any>;
  itemById: Map<number, string>;
  runeById: Map<number, string>;
} | null = null;

async function getDDragonData() {
  if (ddragonCache) return ddragonCache;
  const vRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await vRes.json();
  const version = versions[0];

  const [cRes, iRes, rRes] = await Promise.all([
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/champion.json`),
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/item.json`),
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/runesReforged.json`),
  ]);

  const cJson = await cRes.json();
  const iJson = await iRes.json();
  const rJson = await rRes.json();

  const champById = new Map<string, any>();
  const champByKey = new Map<number, any>();
  const champBySlug = new Map<string, any>();

  for (const c of Object.values(cJson.data) as any[]) {
    const numKey = parseInt(c.key, 10);
    const slug = c.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const entry = { id: c.id, key: numKey, name: c.name, slug };
    champById.set(c.id, entry);
    champByKey.set(numKey, entry);
    champBySlug.set(slug, entry);
  }

  const itemById = new Map<number, string>();
  for (const [id, item] of Object.entries(iJson.data) as any[]) {
    itemById.set(parseInt(id, 10), item.name);
  }

  const runeById = new Map<number, string>();
  for (const tree of rJson as any[]) {
    runeById.set(tree.id, tree.name);
    for (const slot of tree.slots) {
      for (const rune of slot.runes) {
        runeById.set(rune.id, rune.name);
      }
    }
  }

  ddragonCache = { version, champById, champByKey, champBySlug, itemById, runeById };
  return ddragonCache;
}

async function fetchLolalytics(endpoint: string, params: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams({
    ep: endpoint,
    v: "1",
    patch: params.patch || DEFAULT_PATCH,
    tier: params.tier || DEFAULT_TIER,
    queue: "ranked",
    region: "all",
  });
  if (params.c) q.append("c", params.c);
  if (params.lane) q.append("lane", params.lane);

  const url = `${LOLALYTICS_BASE}?${q.toString()}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Lolalytics API error (${res.status}): ${url}`);
  return await res.json();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawChamp = searchParams.get('c') || searchParams.get('champion');
    const rawLane = searchParams.get('lane') || 'top';

    if (!rawChamp) {
      return NextResponse.json({ error: 'Champion parameter is required' }, { status: 400 });
    }

    const { champById, champByKey, champBySlug, itemById, runeById } = await getDDragonData();
    const cleanChamp = rawChamp.trim();
    const cleanSlug = cleanChamp.toLowerCase().replace(/[^a-z0-9]/g, "");

    const champ = champById.get(cleanChamp) || champBySlug.get(cleanSlug);
    if (!champ) {
      return NextResponse.json({ error: `Champion not found: ${rawChamp}` }, { status: 404 });
    }

    const lane = LANE_MAP[rawLane.toLowerCase()] || "top";
    const cacheKey = `${champ.id}:${lane}`;

    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Lolalytics から rune, build-itemset, counter, tier を並行取得
    const [runeData, buildData, counterData, tierData] = await Promise.all([
      fetchLolalytics("rune", { c: champ.slug, lane }).catch(() => null),
      fetchLolalytics("build-itemset", { c: champ.slug, lane }).catch(() => null),
      fetchLolalytics("counter", { c: champ.slug, lane }).catch(() => null),
      fetchLolalytics("tier", { lane }).catch(() => null),
    ]);

    // 1. 基本戦績
    let stats: any = null;
    if (tierData) {
      for (const t of Object.values(tierData.tier ?? {}) as any[]) {
        const c = t.lane?.[lane]?.cid?.[String(champ.key)];
        if (c) {
          stats = {
            rank: c.rank,
            winRate: Number(c.wr) || 0,
            pickRate: Number(c.pr) || 0,
            banRate: Number(c.br) || 0,
            games: Number(c.games) || 0,
            topWr: Number(c.topWr) || 0,
            pctLane: Number(c.pctLane) || 0,
          };
          break;
        }
      }
    }

    // 2. ルーン
    const parseRuneSet = (setObj: any) => {
      if (!setObj?.set) return null;
      const pri = (setObj.set.pri || []).map((id: number) => ({ id, name: runeById.get(id) || `Rune#${id}` }));
      const sec = (setObj.set.sec || []).map((id: number) => ({ id, name: runeById.get(id) || `Rune#${id}` }));
      return {
        winRate: Number(setObj.wr) || 0,
        games: Number(setObj.n) || 0,
        primaryPerks: pri,
        subPerks: sec,
      };
    };

    const runes = {
      pick: parseRuneSet(runeData?.summary?.runes?.pick),
      win: parseRuneSet(runeData?.summary?.runes?.win),
    };

    // 3. ビルド
    const parseItemSet = (arr: any[], isBoot = false) => {
      if (!arr || !Array.isArray(arr)) return [];
      const list = isBoot
        ? arr.filter(e => BOOT_IDS.has(parseInt(String(e[0]).split("_")[0], 10)))
        : arr;

      return list.slice(0, 5).map(entry => {
        const ids = String(entry[0]).split("_").map(s => parseInt(s, 10));
        const picks = Number(entry[1]) || 0;
        const wins = Number(entry[2]) || 0;
        const wr = picks > 0 ? Number(((wins / picks) * 100).toFixed(2)) : 0;
        const items = ids.map(id => ({ id, name: itemById.get(id) || `Item#${id}` }));
        return { items, winRate: wr, games: picks };
      });
    };

    const builds = {
      core1: parseItemSet(buildData?.itemSets?.itemSet1),
      core2: parseItemSet(buildData?.itemSets?.itemSet2),
      boots: parseItemSet(buildData?.itemSets?.itemBootSet1, true),
    };

    // 4. カウンター・対面相性
    let favorable: any[] = [];
    let difficult: any[] = [];

    if (counterData?.counters) {
      const counters = Object.values(counterData.counters)
        .filter((c: any) => c && Number.isFinite(c.vsWr) && c.n >= 80 && c.defaultLane === lane);

      const strong = [...counters].sort((a: any, b: any) => b.vsWr - a.vsWr).slice(0, 5);
      const weak = [...counters].sort((a: any, b: any) => a.vsWr - b.vsWr).slice(0, 5);

      const mapOpponent = (c: any) => {
        const opp = champByKey.get(c.cid) || { id: String(c.cid), name: `ID:${c.cid}` };
        return {
          id: opp.id,
          name: opp.name,
          winRate: Number(c.vsWr.toFixed(2)),
          games: Number(c.n) || 0,
        };
      };

      favorable = strong.map(mapOpponent);
      difficult = weak.map(mapOpponent);
    }

    const result = {
      success: true,
      source: "Lolalytics",
      period: "Past 30 Days (Emerald+ Global Ranked)",
      fetchedAt: new Date().toISOString(),
      champion: {
        id: champ.id,
        name: champ.name,
        lane: lane.toUpperCase(),
      },
      stats,
      runes,
      builds,
      matchups: {
        favorable,
        difficult,
      },
    };

    memoryCache.set(cacheKey, { at: Date.now(), data: result });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Lolalytics champion API error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch Lolalytics data" }, { status: 500 });
  }
}
