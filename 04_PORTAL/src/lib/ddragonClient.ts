export const LATEST_PATCH = "14.1.1"; // 必要に応じて自動取得にできますが、フェールセーフのため固定値か適宜更新

/**
 * チャンピオンIDからアイコン画像のURLを取得します
 */
export function getChampIcon(champId: string): string {
  if (!champId) return "";
  // Wukong(MonkeyKing) などの例外処理
  let formattedId = champId;
  if (formattedId.toLowerCase() === "wukong") formattedId = "MonkeyKing";
  // 基本は先頭大文字、以降小文字（Nunu等例外あり）
  return `https://ddragon.leagueoflegends.com/cdn/${LATEST_PATCH}/img/champion/${formattedId}.png`;
}

/**
 * チャンピオンIDからスプラッシュアート(背景画像)のURLを取得します
 */
export function getChampSplash(champId: string): string {
  if (!champId) return "";
  let formattedId = champId;
  if (formattedId.toLowerCase() === "wukong") formattedId = "MonkeyKing";
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
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${LATEST_PATCH}/data/en_US/champion.json`);
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
