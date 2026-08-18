import { CHAMPION_NAME_MAP, normalizeChampionName } from './championNames';

export interface DetectedChampion {
  champion: string;     // 英語正規名 (例: "Aatrox", "Darius")
  matchedAlias: string; // マッチした表記 (例: "エイトロックス", "ダリウス")
  count: number;        // 出現回数
  inTitle: boolean;     // タイトルに含まれていたか
}

// 誤爆しやすい短い単語や一般英単語（境界マッチを厳格にする）
const SHORT_OR_COMMON_WORDS = new Set([
  'vi', 'yi', 'tf', 'zed', 'vex', 'zac', 'zoe', 'sett', 'shen', 'nami', 'ryze', 'kayn',
  'jhin', 'kled', 'sion', 'vayn', 'milio', 'ashe', 'braum', 'corki', 'annie'
]);

/**
 * タイトルと本文から登場するチャンピオンを高速に自動検出する。
 * 日本語カタカナ名、英語名、表記揺れに対応し、タイトル含有度や出現頻度でスコアリングする。
 *
 * @param title 記事タイトル
 * @param content 記事本文（文字起こしや要約）
 * @param alreadySelected 既に選択済みのチャンピオンリスト（除外用）
 * @returns スコア降順にソートされた検出チャンピオン情報
 */
export function detectChampionsFromText(
  title: string = '',
  content: string = '',
  alreadySelected: string[] = []
): DetectedChampion[] {
  const selectedSet = new Set(alreadySelected.map(c => normalizeChampionName(c).toLowerCase()));
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();

  // マップのエントリ（エイリアス -> 正規名）
  const aliasEntries = Object.entries(CHAMPION_NAME_MAP);

  // 一意の正規チャンピオンごとに集計
  const resultsByChamp = new Map<string, {
    champion: string;
    matchedAliases: Set<string>;
    count: number;
    inTitle: boolean;
  }>();

  for (const [alias, canonicalChamp] of aliasEntries) {
    const canonicalKey = canonicalChamp.toLowerCase();
    if (selectedSet.has(canonicalKey)) continue;

    const lowerAlias = alias.toLowerCase();
    if (!lowerAlias || lowerAlias.length < 2) continue;

    let inTitle = false;
    let occurrences = 0;

    // 日本語（カタカナ・ひらがな）の場合は単純なincludesで十分
    const isJapanese = /[\u3040-\u30ff]/.test(alias);

    if (isJapanese) {
      if (title.includes(alias)) {
        inTitle = true;
        occurrences += 3; // タイトル内は重み付け
      }
      // 本文内でのカウント（簡易検索）
      let pos = 0;
      while ((pos = content.indexOf(alias, pos)) !== -1) {
        occurrences++;
        pos += alias.length;
        if (occurrences > 20) break; // 上限キャップ
      }
    } else {
      // 英語の場合は単語境界を考慮
      const isShortWord = SHORT_OR_COMMON_WORDS.has(lowerAlias) || lowerAlias.length <= 3;
      const regexStr = isShortWord
        ? `(^|[^a-zA-Z0-9])${escapeRegExp(lowerAlias)}([^a-zA-Z0-9]|$)`
        : escapeRegExp(lowerAlias);
      
      if (new RegExp(regexStr, 'i').test(lowerTitle)) {
        inTitle = true;
        occurrences += 3;
      }
      const regexGlobal = new RegExp(regexStr, 'gi');
      const matches = lowerContent.match(regexGlobal);
      if (matches) {
        occurrences += Math.min(matches.length, 20);
      }
    }

    if (occurrences > 0 || inTitle) {
      const existing = resultsByChamp.get(canonicalChamp);
      if (!existing) {
        resultsByChamp.set(canonicalChamp, {
          champion: canonicalChamp,
          matchedAliases: new Set([alias]),
          count: occurrences,
          inTitle,
        });
      } else {
        existing.matchedAliases.add(alias);
        existing.count += occurrences;
        if (inTitle) existing.inTitle = true;
      }
    }
  }

  // スコアリングしてソート
  const list: DetectedChampion[] = Array.from(resultsByChamp.values()).map(item => ({
    champion: item.champion,
    matchedAlias: Array.from(item.matchedAliases)[0],
    count: item.count,
    inTitle: item.inTitle,
  }));

  list.sort((a, b) => {
    // タイトルに含まれているものを最優先
    if (a.inTitle && !b.inTitle) return -1;
    if (!a.inTitle && b.inTitle) return 1;
    // 次に出現頻度
    return b.count - a.count;
  });

  return list;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
