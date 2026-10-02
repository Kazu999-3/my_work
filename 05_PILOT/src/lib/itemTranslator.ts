import defaultItemDict from '@/data/item_dictionary.json';

// 正規化キー生成関数（小文字化、スペース・記号・中黒を統一）
export function normalizeItemKey(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, '')
    .replace(/[・_\-\s]+/g, ' ');
}

// 高速ルックアップ用マップの作成（小文字化キー）
const normalizedBaseMap = new Map<string, string>();
for (const [k, v] of Object.entries(defaultItemDict as Record<string, string>)) {
  if (k && v) {
    normalizedBaseMap.set(k.toLowerCase().trim(), v);
    normalizedBaseMap.set(normalizeItemKey(k), v);
  }
}

/**
 * アイテム名を正しい日本語表記に変換する関数
 * @param rawName 変換対象のアイテム名（英語名、略称、誤訳など）
 * @param customDict ユーザーがカスタマイズした辞書オーバーライド（省略可）
 * @returns 変換後の正しい日本語アイテム名
 */
export function translateItem(rawName: string, customDict?: Record<string, string>): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  // 1. ユーザーカスタム辞書の照合（完全一致 ➔ 小文字 ➔ 正規化）
  if (customDict) {
    if (customDict[trimmed]) return customDict[trimmed];
    const lower = trimmed.toLowerCase();
    for (const [k, v] of Object.entries(customDict)) {
      if (k.toLowerCase() === lower || normalizeItemKey(k) === normalizeItemKey(trimmed)) {
        return v;
      }
    }
  }

  // 2. ベース辞書の完全一致
  const baseDict = defaultItemDict as Record<string, string>;
  if (baseDict[trimmed]) {
    return baseDict[trimmed];
  }

  // 3. ベース辞書の小文字一致
  const lowerTrimmed = trimmed.toLowerCase();
  const lowerMatch = normalizedBaseMap.get(lowerTrimmed);
  if (lowerMatch) {
    return lowerMatch;
  }

  // 4. ベース辞書の正規化一致
  const normKey = normalizeItemKey(trimmed);
  const normMatch = normalizedBaseMap.get(normKey);
  if (normMatch) {
    return normMatch;
  }

  // 5. 該当なしの場合は元の名称を返却
  return trimmed;
}
