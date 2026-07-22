// KTM内MMR → ランク表記の変換。
// Portal側 (04_PORTAL/src/lib/mmr.ts の KTM_TIERS) と必ず同じ閾値にすること。
// 片方だけ変えると、募集通知とサイトでランクが食い違う。

// 大分類だけを持つ（募集通知は "GOLD III" まで出すと細かすぎるので大枠で見せる）。
// min は各ティアの下限MMR。降順に並べる。
const KTM_TIERS = [
  { name: 'CHALLENGER',  short: 'Chall',   min: 2000 },
  { name: 'GRANDMASTER', short: 'GM',      min: 1900 },
  { name: 'MASTER',      short: 'Master',  min: 1850 },
  { name: 'DIAMOND',     short: 'Dia',     min: 1800 },
  { name: 'EMERALD',     short: 'Eme',     min: 1650 },
  { name: 'PLATINUM',    short: 'Plat',    min: 1500 },
  { name: 'GOLD',        short: 'Gold',    min: 1350 },
  { name: 'SILVER',      short: 'Silver',  min: 1200 },
  { name: 'BRONZE',      short: 'Bronze',  min: 1050 },
  { name: 'IRON',        short: 'Iron',    min: 900 },
  { name: 'UNRANKED',    short: 'Unrank',  min: 0 },
];

/** MMR値をKTMランク（大分類）に変換する */
export function getKtmRank(mmr) {
  const m = Number(mmr);
  if (!Number.isFinite(m)) return KTM_TIERS[KTM_TIERS.length - 1]; // UNRANKED
  return KTM_TIERS.find((t) => m >= t.min) || KTM_TIERS[KTM_TIERS.length - 1];
}

// ランク名（英語）→ 日本語表記。募集通知で「ゴールド相当」のように出す用。
const RANK_JP = {
  CHALLENGER: 'チャレンジャー', GRANDMASTER: 'グランドマスター', MASTER: 'マスター',
  DIAMOND: 'ダイヤ', EMERALD: 'エメラルド', PLATINUM: 'プラチナ',
  GOLD: 'ゴールド', SILVER: 'シルバー', BRONZE: 'ブロンズ', IRON: 'アイアン',
  UNRANKED: '未ランク',
};

/**
 * 個人のMMRを「1450（ゴールド相当）」の形にする。
 * mmr が数値でなければ「未登録」を返す。
 */
export function formatMmrWithRank(mmr) {
  const m = Number(mmr);
  if (!Number.isFinite(m)) return '未登録';
  const tier = getKtmRank(m);
  const jp = RANK_JP[tier.name] || tier.name;
  return tier.name === 'UNRANKED' ? `${m}（${jp}）` : `${m}（${jp}相当）`;
}

/**
 * MMRの配列から、ランクごとの人数分布を「高い順」で文字列にする。
 * 例: "Dia 1名 / Plat 3名 / Gold 2名"
 * unknown は名簿未登録（MMR不明）の人数。
 */
export function formatRankDistribution(mmrs, unknown = 0) {
  const counts = new Map(); // tier.name -> 人数
  for (const mmr of mmrs) {
    const tier = getKtmRank(mmr);
    counts.set(tier.name, (counts.get(tier.name) || 0) + 1);
  }
  // KTM_TIERS の並び（高→低）を維持して出す
  const parts = [];
  for (const t of KTM_TIERS) {
    const n = counts.get(t.name);
    if (n) parts.push(`${t.short} ${n}名`);
  }
  if (unknown > 0) parts.push(`未登録 ${unknown}名`);
  return parts.join(' / ');
}

export { KTM_TIERS };
