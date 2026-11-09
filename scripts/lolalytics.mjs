#!/usr/bin/env node
/**
 * scripts/lolalytics.mjs
 * Lolalytics (ロラリティクス) 実測データ照会 CLI
 * 
 * 過去30日間（または最新パッチ）の全世界エメラルド+数百万〜数千万戦の実戦統計を
 * リアルタイムに引いて、日本語でわかりやすく出力する。
 * 
 * 使用例:
 *   node scripts/lolalytics.mjs champ aatrox top
 *   node scripts/lolalytics.mjs champ エイトロックス
 *   node scripts/lolalytics.mjs tier top
 *   node scripts/lolalytics.mjs matchup aatrox darius top
 */

const LOLALYTICS_BASE = "https://a1.lolalytics.com/mega/";
const DEFAULT_PATCH = "30"; // 過去30日
const DEFAULT_TIER = "emerald_plus";

const LANE_MAP = {
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
  3006, 3009, 3047, 3111, 3117, 3158, 3020, 2422, // Berzerker, Swiftness, Plated, Merc, Mobi, Ionian, Sorc, Slightly Magical
]);

// 1. DataDragon から最新のチャンピオン・アイテム・ルーン情報を取得
let ddragonCache = null;
async function getDDragonData() {
  if (ddragonCache) return ddragonCache;
  try {
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

    const champById = new Map(); // "Aatrox" -> data
    const champByKey = new Map(); // 266 -> data
    const champBySlug = new Map(); // "aatrox" -> data
    const champByName = new Map(); // "エイトロックス" -> data

    for (const [id, c] of Object.entries(cJson.data)) {
      const numKey = parseInt(c.key, 10);
      const slug = c.id.toLowerCase().replace(/[^a-z0-9]/g, "");
      const entry = { id: c.id, key: numKey, name: c.name, slug };
      champById.set(c.id, entry);
      champByKey.set(numKey, entry);
      champBySlug.set(slug, entry);
      champByName.set(c.name.toLowerCase(), entry);
    }

    const itemById = new Map();
    for (const [id, item] of Object.entries(iJson.data)) {
      itemById.set(parseInt(id, 10), item.name);
    }

    const runeById = new Map();
    for (const tree of rJson) {
      runeById.set(tree.id, tree.name);
      for (const slot of tree.slots) {
        for (const rune of slot.runes) {
          runeById.set(rune.id, rune.name);
        }
      }
    }

    ddragonCache = { version, champById, champByKey, champBySlug, champByName, itemById, runeById };
    return ddragonCache;
  } catch (e) {
    console.error("DataDragon取得失敗:", e.message);
    throw e;
  }
}

// チャンピオン名/IDの曖昧解決
async function resolveChampion(input) {
  const { champById, champByKey, champBySlug, champByName } = await getDDragonData();
  const clean = String(input).trim().toLowerCase();

  // 数値ID
  if (/^\d+$/.test(clean)) {
    const entry = champByKey.get(parseInt(clean, 10));
    if (entry) return entry;
  }

  // slug完全一致
  const noSymbol = clean.replace(/[^a-z0-9]/g, "");
  if (champBySlug.has(noSymbol)) return champBySlug.get(noSymbol);

  // 日本語完全一致
  if (champByName.has(clean)) return champByName.get(clean);

  // 部分一致
  for (const [name, entry] of champByName.entries()) {
    if (name.includes(clean)) return entry;
  }
  for (const [slug, entry] of champBySlug.entries()) {
    if (slug.includes(noSymbol)) return entry;
  }

  throw new Error(`チャンピオンが見つかりません: "${input}"`);
}

// Lolalytics API 呼び出し
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

// ----------------- コマンド実装 -----------------

// 1. チャンピオン詳細
async function commandChamp(champQuery, laneInput, options = {}) {
  const champ = await resolveChampion(champQuery);
  const { itemById, runeById } = await getDDragonData();
  const patch = options.patch || DEFAULT_PATCH;

  // ルーン＆概要取得
  const runeData = await fetchLolalytics("rune", { c: champ.slug, lane: laneInput ? LANE_MAP[laneInput.toLowerCase()] : undefined, patch });
  const lane = laneInput ? LANE_MAP[laneInput.toLowerCase()] : (runeData.header?.defaultLane || runeData.header?.lane || "top");

  // Tier一覧からレーン戦績取得
  const tierData = await fetchLolalytics("tier", { lane, patch });
  let stats = null;
  for (const t of Object.values(tierData?.tier ?? {})) {
    const c = t.lane?.[lane]?.cid?.[String(champ.key)];
    if (c) { stats = c; break; }
  }

  // ビルド取得
  let buildData = null;
  try {
    buildData = await fetchLolalytics("build-itemset", { c: champ.slug, lane, patch });
  } catch (e) {}

  // カウンター取得
  let counterData = null;
  try {
    counterData = await fetchLolalytics("counter", { c: champ.slug, lane, patch });
  } catch (e) {}

  console.log(`\n======================================================`);
  console.log(`📊 【Lolalytics 実測統計】 ${champ.name} (${champ.id}) - レーン: ${lane.toUpperCase()}`);
  console.log(`期間: ${patch === "30" ? "過去30日間実測" : `パッチ ${patch}`} ｜ ランク: エメラルド以上 ｜ 世界ランク戦`);
  console.log(`======================================================`);

  if (stats) {
    console.log(`\n【🏆 基本戦績】`);
    console.log(`- 順位: ${stats.rank}位 / レーン内`);
    console.log(`- 勝率: ${stats.wr}%  (全体平均: ${tierData.avgWr || "50.0"}%)`);
    console.log(`- ピック率: ${stats.pr}% ｜ バン率: ${stats.br}% ｜ 試合数: ${stats.games.toLocaleString()}戦`);
    console.log(`- レーン専任率: ${stats.pctLane}% (${champ.name}の全ピック中${stats.pctLane}%が${lane.toUpperCase()})`);
    console.log(`- 上位プレイヤー勝率 (OTP/Top WR): ${stats.topWr}% (Elo: ${stats.topElo})`);
  }

  // ルーン
  const pickRune = runeData?.summary?.runes?.pick;
  const winRune = runeData?.summary?.runes?.win;
  if (pickRune?.set) {
    const priPerks = (pickRune.set.pri || []).map(id => runeById.get(id) || id).join(" > ");
    const secPerks = (pickRune.set.sec || []).map(id => runeById.get(id) || id).join(" + ");
    console.log(`\n【⚡ 推奨ルーン（最多ピック）】 勝率: ${pickRune.wr}% (${pickRune.n?.toLocaleString()}戦)`);
    console.log(`- メイン: ${priPerks}`);
    console.log(`- サブ: ${secPerks}`);
  }
  if (winRune?.set && winRune !== pickRune && winRune.wr > (pickRune?.wr || 0)) {
    const priPerks = (winRune.set.pri || []).map(id => runeById.get(id) || id).join(" > ");
    const secPerks = (winRune.set.sec || []).map(id => runeById.get(id) || id).join(" + ");
    console.log(`【⚡ 最高勝率ルーン】 勝率: ${winRune.wr}% (${winRune.n?.toLocaleString()}戦)`);
    console.log(`- メイン: ${priPerks}`);
    console.log(`- サブ: ${secPerks}`);
  }

  // ビルド
  if (buildData?.itemSets) {
    console.log(`\n【🛡️ アイテムビルド統計】`);
    const parseSet = (arr, label) => {
      if (!arr || !arr.length) return;
      console.log(`\n◆ ${label}:`);
      const top = arr.slice(0, 4);
      for (const entry of top) {
        const ids = String(entry[0]).split("_").map(s => parseInt(s, 10));
        const picks = Number(entry[1]) || 0;
        const wins = Number(entry[2]) || 0;
        const wr = picks > 0 ? ((wins / picks) * 100).toFixed(2) : "0.00";
        const names = ids.map(id => itemById.get(id) || `#${id}`).join(" ➔ ");
        console.log(`  - ${names.padEnd(28)} 勝率: ${wr}% (${picks.toLocaleString()}戦)`);
      }
    };

    parseSet(buildData.itemSets.itemSet1, "1手目 (1st Core)");
    parseSet(buildData.itemSets.itemSet2, "2手目コンボ (1st + 2nd Core)");
    parseSet(buildData.itemSets.itemBootSet1?.filter(e => BOOT_IDS.has(parseInt(String(e[0]).split("_")[0], 10))), "採用ブーツ");
  }

  // カウンター
  if (counterData?.counters) {
    const { champByKey } = await getDDragonData();
    const counters = Object.values(counterData.counters)
      .filter(c => c && Number.isFinite(c.vsWr) && c.n >= 100 && c.defaultLane === lane);

    const strongAgainst = [...counters].sort((a, b) => b.vsWr - a.vsWr).slice(0, 5);
    const weakAgainst = [...counters].sort((a, b) => a.vsWr - b.vsWr).slice(0, 5);

    console.log(`\n【⚔️ 有利な対面 TOP 5 (自勝率が高い)】`);
    for (const c of strongAgainst) {
      const opp = champByKey.get(c.cid) || { name: `ID:${c.cid}` };
      console.log(`  - vs ${opp.name.padEnd(14)} 対面勝率: ${c.vsWr.toFixed(2)}% (${c.n.toLocaleString()}戦)`);
    }

    console.log(`\n【⚠️ 苦手な対面 TOP 5 (自勝率が低い / カウンター)】`);
    for (const c of weakAgainst) {
      const opp = champByKey.get(c.cid) || { name: `ID:${c.cid}` };
      console.log(`  - vs ${opp.name.padEnd(14)} 対面勝率: ${c.vsWr.toFixed(2)}% (${c.n.toLocaleString()}戦)`);
    }
  }

  console.log(`\n======================================================\n`);
}

// 2. Tierリスト
async function commandTier(laneInput, options = {}) {
  const lane = LANE_MAP[(laneInput || "top").toLowerCase()] || "top";
  const patch = options.patch || DEFAULT_PATCH;
  const { champByKey } = await getDDragonData();

  const data = await fetchLolalytics("tier", { lane, patch });
  const flat = [];

  for (const [tierKey, bucket] of Object.entries(data?.tier ?? {})) {
    const cidMap = bucket?.lane?.[lane]?.cid ?? {};
    for (const [cidStr, c] of Object.entries(cidMap)) {
      const champ = champByKey.get(parseInt(cidStr, 10)) || { name: cidStr, id: cidStr };
      flat.push({
        id: champ.id,
        name: champ.name,
        rank: c.rank,
        wr: c.wr,
        pr: c.pr,
        br: c.br,
        games: c.games,
        topWr: c.topWr,
        pctLane: c.pctLane,
      });
    }
  }

  flat.sort((a, b) => a.rank - b.rank);
  const total = flat.length;

  console.log(`\n======================================================`);
  console.log(`🏆 【Lolalytics Tierランキング】 レーン: ${lane.toUpperCase()}`);
  console.log(`期間: ${patch === "30" ? "過去30日間実測" : `パッチ ${patch}`} ｜ 対象: エメラルド以上 ｜ 分析試合数: ${data.analysed?.toLocaleString()}戦`);
  console.log(`======================================================\n`);

  console.log(`Rank ｜ Champion          ｜ 勝率   ｜ Pick率 ｜ Ban率  ｜ 試合数   ｜ OTP勝率`);
  console.log(`-------------------------------------------------------------------------`);
  const displayList = flat.filter(c => c.pr >= 0.5).slice(0, 25);
  for (const c of displayList) {
    const rankStr = String(c.rank).padStart(4);
    const nameStr = c.name.padEnd(16);
    const wrStr = `${c.wr}%`.padStart(7);
    const prStr = `${c.pr}%`.padStart(7);
    const brStr = `${c.br}%`.padStart(7);
    const gamesStr = c.games.toLocaleString().padStart(9);
    const topWrStr = `${c.topWr}%`.padStart(8);
    console.log(`${rankStr} ｜ ${nameStr} ｜ ${wrStr} ｜ ${prStr} ｜ ${brStr} ｜ ${gamesStr} ｜ ${topWrStr}`);
  }

  console.log(`\n(全${flat.length}体中、ピック率0.5%以上の主要メタ上位25体を表示)\n`);
}

// 3. マッチアップ直接比較
async function commandMatchup(champ1Query, champ2Query, laneInput, options = {}) {
  const c1 = await resolveChampion(champ1Query);
  const c2 = await resolveChampion(champ2Query);
  const patch = options.patch || DEFAULT_PATCH;
  const lane = LANE_MAP[(laneInput || "top").toLowerCase()] || "top";

  const counterData = await fetchLolalytics("counter", { c: c1.slug, lane, patch });
  const match = Object.values(counterData?.counters ?? {}).find(c => c && c.cid === c2.key);

  console.log(`\n======================================================`);
  console.log(`⚔️ 【直接対決 実測統計】 ${c1.name} vs ${c2.name} (${lane.toUpperCase()})`);
  console.log(`期間: ${patch === "30" ? "過去30日間実測" : `パッチ ${patch}`} ｜ エメラルド以上`);
  console.log(`======================================================`);

  if (!match) {
    console.log(`\nデータ不足: 十分なサンプル数（100試合以上）の直接マッチアップデータが存在しません。`);
  } else {
    const c1Wr = match.vsWr.toFixed(2);
    const c2Wr = (100 - match.vsWr).toFixed(2);
    console.log(`\n- 総対戦数: ${match.n.toLocaleString()} 試合`);
    console.log(`- ${c1.name} 側の勝率: ${c1Wr}%`);
    console.log(`- ${c2.name} 側の勝率: ${c2Wr}%`);
    if (match.vsWr >= 52) {
      console.log(`👉 結論: 【${c1.name} 大幅有利】 (勝率差 +${(match.vsWr - 50).toFixed(1)}%)`);
    } else if (match.vsWr <= 48) {
      console.log(`👉 結論: 【${c2.name} 大幅有利 / カウンター】 (${c1.name}不利: ${(match.vsWr - 50).toFixed(1)}%)`);
    } else {
      console.log(`👉 結論: 【互角・腕前勝負】 (勝率差 ${(match.vsWr - 50).toFixed(1)}%)`);
    }
  }
  console.log(`\n======================================================\n`);
}

// ----------------- メインルーチン -----------------
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0]?.toLowerCase();

  try {
    if (cmd === "champ" || cmd === "c") {
      const champ = args[1];
      const lane = args[2];
      if (!champ) throw new Error("チャンピオン名を指定してください。例: node scripts/lolalytics.mjs champ aatrox top");
      await commandChamp(champ, lane);
    } else if (cmd === "tier" || cmd === "t") {
      const lane = args[1] || "top";
      await commandTier(lane);
    } else if (cmd === "matchup" || cmd === "vs") {
      const c1 = args[1];
      const c2 = args[2];
      const lane = args[3] || "top";
      if (!c1 || !c2) throw new Error("2体のチャンピオンを指定してください。例: node scripts/lolalytics.mjs matchup aatrox darius top");
      await commandMatchup(c1, c2, lane);
    } else {
      console.log(`
Lolalytics CLI 使用法:
  node scripts/lolalytics.mjs champ <チャンピオン名> [レーン]
    例: node scripts/lolalytics.mjs champ aatrox top
    例: node scripts/lolalytics.mjs champ ヤスオ mid

  node scripts/lolalytics.mjs tier [レーン]
    例: node scripts/lolalytics.mjs tier top
    例: node scripts/lolalytics.mjs tier adc

  node scripts/lolalytics.mjs matchup <チャンプ1> <チャンプ2> [レーン]
    例: node scripts/lolalytics.mjs matchup aatrox darius top
`);
    }
  } catch (e) {
    console.error("\n❌ エラー:", e.message, "\n");
    process.exit(1);
  }
}

main();
