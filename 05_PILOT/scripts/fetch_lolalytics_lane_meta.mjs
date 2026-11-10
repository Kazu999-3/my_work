import fs from 'fs';
import path from 'path';

const LOLALYTICS_BASE = "https://a1.lolalytics.com/mega/";
const DEFAULT_PATCH = "30"; // 過去30日
const DEFAULT_TIER = "emerald_plus";

const LANES = [
  { key: "TOP", apiLane: "top" },
  { key: "JG", apiLane: "jungle" },
  { key: "MID", apiLane: "middle" },
  { key: "ADC", apiLane: "bottom" },
  { key: "SUP", apiLane: "support" },
];

async function fetchLolalytics(endpoint, params = {}) {
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Lolalytics APIエラー (${res.status}): ${url}`);
  return await res.json();
}

async function getDDragonChampions() {
  const vRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await vRes.json();
  const version = versions[0];

  const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/champion.json`);
  const cJson = await cRes.json();

  const champByKey = new Map();
  for (const c of Object.values(cJson.data)) {
    champByKey.set(parseInt(c.key, 10), {
      id: c.id,
      name: c.name,
      slug: c.id.toLowerCase().replace(/[^a-z0-9]/g, "")
    });
  }
  return { version, champByKey };
}

// Tier番号を判定（Lolalyticsのランク・勝率基準）
function getTierInfo(rank, totalInLane) {
  const pct = rank / totalInLane;
  if (rank <= 5 || pct <= 0.08) return { tier: "Tier 1", tierNum: 1 };
  if (rank <= 18 || pct <= 0.25) return { tier: "Tier 2", tierNum: 2 };
  if (rank <= 35 || pct <= 0.50) return { tier: "Tier 3", tierNum: 3 };
  if (rank <= 55 || pct <= 0.75) return { tier: "Tier 4", tierNum: 4 };
  return { tier: "Tier 5", tierNum: 5 };
}

async function main() {
  console.log("🚀 Lolalytics 全レーン実測メタデータ取得開始...");
  const { version, champByKey } = await getDDragonChampions();
  console.log(`- DataDragon バージョン: ${version}`);

  const output = {
    source: "Lolalytics",
    sourceUrl: "https://lolalytics.com/",
    period: "Past 30 Days (Emerald+ Global Ranked)",
    fetchedAt: new Date().toISOString(),
    patch: DEFAULT_PATCH,
    tier: DEFAULT_TIER,
    totalEntries: 0,
    lanes: {
      TOP: {},
      JG: {},
      MID: {},
      ADC: {},
      SUP: {}
    }
  };

  let totalCount = 0;

  for (const { key: laneKey, apiLane } of LANES) {
    console.log(`\n⏳ レーン取得中: ${laneKey} (${apiLane})...`);
    const tierData = await fetchLolalytics("tier", { lane: apiLane, patch: DEFAULT_PATCH });

    const champsList = [];
    for (const t of Object.values(tierData?.tier ?? {})) {
      const c = t.lane?.[apiLane]?.cid;
      if (c) {
        for (const [keyStr, val] of Object.entries(c)) {
          const numKey = parseInt(keyStr, 10);
          const champInfo = champByKey.get(numKey);
          if (!champInfo) continue;

          champsList.push({
            champKey: numKey,
            champId: champInfo.id,
            champName: champInfo.name,
            slug: champInfo.slug,
            rank: val.rank,
            winRate: Number(val.wr) || 0,
            pickRate: Number(val.pr) || 0,
            banRate: Number(val.br) || 0,
            games: Number(val.games) || 0,
            topWr: Number(val.topWr) || 0,
            pctLane: Number(val.pctLane) || 0
          });
        }
      }
    }

    champsList.sort((a, b) => a.rank - b.rank);
    const totalInLane = champsList.length;
    console.log(`  ➔ ${totalInLane} 体のチャンピオンデータを取得`);

    const laneMap = {};
    for (const c of champsList) {
      const { tier, tierNum } = getTierInfo(c.rank, totalInLane);
      laneMap[c.champId] = {
        championName: c.champName,
        championId: c.champId,
        slug: c.slug,
        winRate: c.winRate,
        pickRate: c.pickRate,
        banRate: c.banRate,
        tier: tier,
        tierNum: tierNum,
        rank: c.rank,
        games: c.games,
        topWr: c.topWr,
        pctLane: c.pctLane,
        isRip: false
      };
      totalCount++;
    }

    output.lanes[laneKey] = laneMap;
  }

  output.totalEntries = totalCount;

  const destPath = path.resolve("src/data/lolalytics_lane_meta.json");
  fs.writeFileSync(destPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n🎉 保存完了: ${destPath} (計 ${totalCount} レコード)`);
}

main().catch(console.error);
