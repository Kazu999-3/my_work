/**
 * チャンピオン名の表記揺れ正規化（DataDragon準拠のIDに寄せる）。
 * 元々 src/app/api/coach/analyze/route.ts にだけローカル定義されていたため、
 * champion_power_spikes 等の新しいテーブルを検索する別の場所を書くたびに
 * 同じマップを再実装するリスクがあった。共通化してここに一本化する。
 */
export const CHAMPION_NAME_MAP: Record<string, string> = {
  'khazix': 'KhaZix',
  'kha\'zix': 'KhaZix',
  'kha zix': 'KhaZix',
  'leesin': 'LeeSin',
  'lee sin': 'LeeSin',
  'xin zhao': 'XinZhao',
  'xinzhao': 'XinZhao',
  'jarvan': 'JarvanIV',
  'jarvan iv': 'JarvanIV',
  'jarvaniv': 'JarvanIV',
  'drmundo': 'DrMundo',
  'dr. mundo': 'DrMundo',
  'dr mundo': 'DrMundo',
  'nunu': 'Nunu',
  'nunu & willump': 'Nunu',
  'nunu and willump': 'Nunu',
  'wukong': 'MonkeyKing',
  'monkey king': 'MonkeyKing',
  'tahm kench': 'TahmKench',
  'tahmkench': 'TahmKench',
  'twisted fate': 'TwistedFate',
  'twistedfate': 'TwistedFate',
  'tf': 'TwistedFate',
};

export function normalizeChampionName(name: string): string {
  if (!name) return '';
  const key = name.toLowerCase().trim();
  if (CHAMPION_NAME_MAP[key]) return CHAMPION_NAME_MAP[key];

  // 先頭を大文字、それ以降を小文字に（例: graves -> Graves）
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** 検索タグやDB比較用に表記揺れリストを展開する */
export function getChampionSearchVariations(name: string): string[] {
  const normalized = normalizeChampionName(name);
  const variations = [normalized];

  if (normalized === 'KhaZix') variations.push("Kha'Zix", "Kha Zix");
  if (normalized === 'LeeSin') variations.push("Lee Sin");
  if (normalized === 'XinZhao') variations.push("Xin Zhao");
  if (normalized === 'JarvanIV') variations.push("Jarvan IV", "Jarvan");
  if (normalized === 'DrMundo') variations.push("Dr. Mundo", "Dr Mundo", "Mundo");
  if (normalized === 'MonkeyKing') variations.push("Wukong", "Monkey King");
  if (normalized === 'TahmKench') variations.push("Tahm Kench");
  if (normalized === 'TwistedFate') variations.push("Twisted Fate", "TF");
  if (normalized === 'Nunu') variations.push("Nunu & Willump", "Nunu and Willump");

  return variations;
}
