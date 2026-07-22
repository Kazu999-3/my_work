import rawKtmTiers from '../../../../04_PORTAL/src/shared/ktm_tiers.json';

// shared/ktm_tiers.json から大分類 (CHALLENGER 〜 UNRANKED) を自動構築
const tierMap = new Map();
for (const item of rawKtmTiers) {
  const mainName = item.name.split(' ')[0];
  const shortName = item.short ? item.short.split(' ')[0] : mainName;
  if (!tierMap.has(mainName)) {
    tierMap.set(mainName, { name: mainName, short: shortName, min: item.min });
  } else {
    const current = tierMap.get(mainName);
    if (item.min < current.min) {
      current.min = item.min;
    }
  }
}
const KTM_TIERS = Array.from(tierMap.values());

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
