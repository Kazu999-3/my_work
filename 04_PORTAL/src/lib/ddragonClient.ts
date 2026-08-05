let cachedLatestPatch = "14.24.1"; // 確実に実在するDDragon安定パッチバージョン（フェッチ失敗時のフォールバック）

export async function initLatestPatch() {
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    if (res.ok) {
      const versions = await res.json();
      if (Array.isArray(versions) && versions.length > 0 && versions[0]) {
        cachedLatestPatch = versions[0];
      }
    }
  } catch (e) {
    console.error("Failed to fetch latest patch version", e);
  }
}

// 起動時に非同期で実行。以前はブラウザ限定のガードがあり、サーバー側(SSR/APIルート)の
// warm instanceではgetChampIcon()等の同期関数が更新前のcachedLatestPatch(フォールバック値)
// を参照し続けていた。initLatestPatch()はfetchのみで安全なため、環境を問わず起動時に開始する。
initLatestPatch().catch(console.error);

// サーバー側(APIルート等)は上記の起動時フックが効かず、Zaahen/Yunara/Locke等の
// 新チャンピオンがずっと未追加の14.24.1データのまま扱われ続けるバグがあった
// (2026-08-04発覚)。getAllChampionIds/getChampionAbilityNamesの初回呼び出し時に
// 一度だけ最新パッチを取得するようにする(以降はモジュールキャッシュを再利用)。
let patchInitPromise: Promise<void> | null = null;
async function ensureLatestPatch(): Promise<void> {
  if (!patchInitPromise) patchInitPromise = initLatestPatch();
  await patchInitPromise;
}

// DDragon の特殊ID・表記揺れ・スペース削除マッピングテーブル
const ID_CORRECTION_MAP: Record<string, string> = {
  "wukong": "MonkeyKing",
  "ksante": "KSante",
  "k'sante": "KSante",
  "belveth": "Belveth",
  "bel'veth": "Belveth",
  "kaisa": "Kaisa",
  "kai'sa": "Kaisa",
  "chogath": "Chogath",
  "cho'gath": "Chogath",
  "khazix": "Khazix",
  "kha'zix": "Khazix",
  "velkoz": "Velkoz",
  "vel'koz": "Velkoz",
  "renata": "Renata",
  "renata glasc": "Renata",
  "renataglasc": "Renata",
  "nunu": "Nunu",
  "nunu & willump": "Nunu",
  "nunuwillump": "Nunu",
  "drmundo": "DrMundo",
  "dr. mundo": "DrMundo",
  "doctormundo": "DrMundo",
  "leblanc": "Leblanc",
  "le blanc": "Leblanc",
  "jarvan iv": "JarvanIV",
  "jarvaniv": "JarvanIV",
  "master yi": "MasterYi",
  "masteryi": "MasterYi",
  "miss fortune": "MissFortune",
  "missfortune": "MissFortune",
  "tahm kench": "TahmKench",
  "tahmkench": "TahmKench",
  "twisted fate": "TwistedFate",
  "twistedfate": "TwistedFate",
  "xin zhao": "XinZhao",
  "xinzhao": "XinZhao",
  "aurelion sol": "AurelionSol",
  "aurelionsol": "AurelionSol",
  "kog'maw": "KogMaw",
  "kogmaw": "KogMaw",
  "rek'sai": "RekSai",
  "reksai": "RekSai"
};

export function formatChampId(champId: string): string {
  if (!champId) return "Aatrox";
  const cleanId = champId.trim();
  const key = cleanId.toLowerCase();
  if (ID_CORRECTION_MAP[key]) {
    return ID_CORRECTION_MAP[key];
  }
  // スペースやクォートを取り除き、単語の頭文字を大文字化
  return cleanId
    .replace(/['.\s]/g, '')
    .replace(/^(.)/, match => match.toUpperCase());
}

/**
 * チャンピオンIDからアイコン画像のURLを取得します (404 割れ対策完了版)
 */
export function getChampIcon(champId: string): string {
  if (!champId || champId === "Unknown") return "https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/29.png";
  const formattedId = formatChampId(champId);
  return `https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/img/champion/${formattedId}.png`;
}

/**
 * チャンピオンIDからスプラッシュアート(背景画像)のURLを取得します
 */
export function getChampSplash(champId: string): string {
  if (!champId) return "";
  const formattedId = formatChampId(champId);
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${formattedId}_0.jpg`;
}

// チャンピオンIDとNameのキャッシュ
let champDataCache: Record<string, string> | null = null;

/**
 * チャンピオンID(数値)からチャンピオン名(英字)を取得します
 */
export async function getChampNameById(id: number): Promise<string> {
  if (!champDataCache) {
    try {
      await ensureLatestPatch();
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/data/en_US/champion.json`);
      if (res.ok) {
        const data = await res.json();
        const champDict: Record<string, string> = {};
        for (const key in data.data) {
          const champ = data.data[key];
          champDict[champ.key] = champ.id; // key="103", id="Ahri"
        }
        champDataCache = champDict;
      }
    } catch (e) {
      console.error("Failed to fetch DDragon champion data", e);
      return "Unknown";
    }
  }
  
  if (champDataCache && champDataCache[id.toString()]) {
    return champDataCache[id.toString()];
  }
  return "Unknown";
}

// 実在するチャンピオンIDの全件セット（表記揺れ・ゴミ値の検出用）
let championIdSetCache: Set<string> | null = null;

export async function getAllChampionIds(): Promise<Set<string>> {
  if (championIdSetCache) return championIdSetCache;
  try {
    await ensureLatestPatch();
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/data/en_US/champion.json`);
    if (res.ok) {
      const data = await res.json();
      championIdSetCache = new Set(Object.keys(data.data || {}));
    }
  } catch (e) {
    console.error("Failed to fetch DDragon champion id list", e);
  }
  return championIdSetCache || new Set();
}

// チャンピオンのスキル名一覧（パッシブ＋QWER）。ファクトチェックでAIに公式情報として渡す。
const abilityNameCache = new Map<string, string[]>();

export async function getChampionAbilityNames(champId: string): Promise<string[]> {
  const formatted = formatChampId(champId);
  if (abilityNameCache.has(formatted)) return abilityNameCache.get(formatted)!;
  try {
    await ensureLatestPatch();
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/data/en_US/champion/${formatted}.json`);
    if (res.ok) {
      const data = await res.json();
      const champ = data.data?.[formatted];
      const names: string[] = [];
      if (champ?.passive?.name) names.push(`Passive: ${champ.passive.name}`);
      const keys = ['Q', 'W', 'E', 'R'];
      (champ?.spells || []).forEach((s: any, i: number) => {
        if (s?.name) names.push(`${keys[i] || '?'}: ${s.name}`);
      });
      abilityNameCache.set(formatted, names);
      return names;
    }
  } catch (e) {
    console.error(`Failed to fetch DDragon ability names for ${formatted}`, e);
  }
  abilityNameCache.set(formatted, []);
  return [];
}
