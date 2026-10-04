// DDragon クライアントヘルパー（公式アセットURL解決）
export const DDRAGON_FALLBACK_PATCH = "16.19.1";

let cachedLatestPatch = DDRAGON_FALLBACK_PATCH;

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
    console.warn("Failed to fetch latest patch version, using fallback", e);
  }
}

initLatestPatch().catch(() => {});

let patchInitPromise: Promise<void> | null = null;
async function ensureLatestPatch(): Promise<void> {
  if (!patchInitPromise) patchInitPromise = initLatestPatch();
  await patchInitPromise;
}

export async function getLatestPatch(): Promise<string> {
  await ensureLatestPatch();
  return cachedLatestPatch;
}

export async function getCalendarPatch(): Promise<string> {
  const patch = await getLatestPatch();
  const [rawMajor, rawMinor] = patch.split('.');
  const majorNum = parseInt(rawMajor, 10);
  if (isNaN(majorNum)) return '26.19';
  return `${majorNum + 10}.${rawMinor || '1'}`;
}

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
  "reksai": "RekSai",
  "ambessa": "Ambessa",
  "aurora": "Aurora",
  "smolder": "Smolder",
  "hwei": "Hwei",
  "briar": "Briar",
  "naafiri": "Naafiri",
  "milio": "Milio",
  "mel": "Mel"
};

export function formatChampId(champId: string): string {
  if (!champId) return "Aatrox";
  const cleanId = champId.trim();
  const key = cleanId.toLowerCase();
  if (ID_CORRECTION_MAP[key]) {
    return ID_CORRECTION_MAP[key];
  }
  return cleanId
    .replace(/['.\s]/g, '')
    .replace(/^(.)/, match => match.toUpperCase());
}

export function getChampIcon(champId: string): string {
  if (!champId || champId === "Unknown" || champId === "未選択") {
    return `https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/img/profileicon/29.png`;
  }
  const formattedId = formatChampId(champId);
  return `https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/img/champion/${formattedId}.png`;
}

export function getChampSplash(champId: string): string {
  if (!champId) return "";
  const formattedId = formatChampId(champId);
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${formattedId}_0.jpg`;
}

export function getSpellIcon(spellImageFull: string): string {
  if (!spellImageFull) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/img/spell/${spellImageFull}`;
}

export function getPassiveIcon(passiveImageFull: string): string {
  if (!passiveImageFull) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${cachedLatestPatch}/img/passive/${passiveImageFull}`;
}

// 数値のチャンピオンキー（例: 103）→ 英語ID（例: "Ahri"）。ライブ偵察（Spectator API はキーしか返さない）用。
// 旧ポータル lib/ddragonClient.ts からの移植（2026-10-04）。
let champKeyToIdCache: Record<string, string> | null = null;
export async function getChampNameById(id: number): Promise<string> {
  if (!champKeyToIdCache) {
    try {
      const patch = await getLatestPatch();
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/champion.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()).data || {};
      const dict: Record<string, string> = {};
      for (const key in data) dict[data[key].key] = data[key].id;
      champKeyToIdCache = dict;
    } catch (e) {
      console.error('[ddragonClient] champion.json の取得に失敗:', e);
      return 'Unknown';
    }
  }
  return champKeyToIdCache[String(id)] || 'Unknown';
}
