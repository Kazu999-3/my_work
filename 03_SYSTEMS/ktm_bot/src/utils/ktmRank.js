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

// 大分類ランク名 → 表示用の色付き絵文字（戦績板のMMRバー等で使用）。
// ⬜シルバー以下 / 🟨ゴールド / 🟦プラチナ / 🟩エメラルド以上
const TIER_EMOJI = {
  CHALLENGER: '🟩', GRANDMASTER: '🟩', MASTER: '🟩', DIAMOND: '🟩', EMERALD: '🟩',
  PLATINUM: '🟦',
  GOLD: '🟨',
  SILVER: '⬜', BRONZE: '⬜', IRON: '⬜', UNRANKED: '⬜',
};

/** MMR値を、そのランク帯を表す色付き絵文字1つに変換する（ktm_tiers.json追従） */
export function getTierEmoji(mmr) {
  const tier = getKtmRank(mmr);
  return TIER_EMOJI[tier.name] || '⬜';
}

/** プレイヤーレコードから一番高いレーンのMMR（最高レーンMMR）を取得する */
export function getHighestLaneMmr(player) {
  if (!player) return 0;
  const laneMmrs = [
    player.mmr_top,
    player.mmr_jg,
    player.mmr_mid,
    player.mmr_adc,
    player.mmr_sup,
  ].map((v) => (v != null ? Number(v) : null)).filter((v) => v !== null && !isNaN(v));

  if (laneMmrs.length > 0) {
    return Math.max(...laneMmrs);
  }
  // 全レーンMMRが未設定の場合は代表MMR(mmr)、それも無ければ0
  return player.mmr != null ? Number(player.mmr) : 0;
}

/**
 * プレイヤーの経験度（初参加・ライト・復帰勢・常連）を判定してバッジオブジェクトを返す
 * ポータル（/balancer, /ktm-admin）と同一の判定基準
 * @param {object} p - プレイヤーオブジェクト (total_games, recent_games_30d, days_since_last_match 等)
 */
export function getPlayerExperienceBadge(p) {
  if (!p) {
    return { tier: 'new', label: '🔰 初参加', short: '🔰初参加', tip: '通算0戦：初参加のプレイヤーです！大歓迎✨' };
  }
  const totalG = p.total_games ?? p.games ?? p.metadata?.games ?? 0;
  const recent30d = p.recent_games_30d ?? (p.days_since_last_match !== null && p.days_since_last_match !== undefined && p.days_since_last_match <= 30 ? 1 : 0);
  const daysAgo = p.days_since_last_match !== undefined ? p.days_since_last_match : null;

  // 1. 初参加（通算0戦）
  if (totalG === 0) {
    return {
      tier: 'new',
      label: '🔰 初参加',
      short: '🔰初参加',
      tip: '通算0戦：初参加のプレイヤーです！大歓迎✨'
    };
  }
  // 2. ライト層（通算1〜4戦）
  if (totalG <= 4) {
    return {
      tier: 'light',
      label: '🌱 ライト',
      short: '🌱ライト',
      tip: `通算${totalG}戦：参加回数がまだ浅いライトプレイヤーです`
    };
  }
  // 3. 通算5戦以上だが直近参加がない（30日以上ブランク）
  if (daysAgo !== null && daysAgo > 30) {
    if (daysAgo >= 60) {
      return {
        tier: 'returning',
        label: '⏳ 復帰勢',
        short: '⏳復帰勢',
        tip: `通算${totalG}戦（最終参加: ${daysAgo}日前）：久しぶりの参加となる復帰プレイヤーです！大歓迎✨`
      };
    }
    return {
      tier: 'returning',
      label: '🎖️ 経験者',
      short: '🎖️経験者',
      tip: `通算${totalG}戦（最終参加: ${daysAgo}日前）：久しぶりに参加の経験者プレイヤーです`
    };
  }
  // 4. 直近も定期参加している現役常連
  return {
    tier: 'regular',
    label: '👑 常連',
    short: '👑常連',
    tip: `通算${totalG}戦（直近30日: ${recent30d}戦）：定期的に参加しているアクティブ常連メンバーです`
  };
}

export { KTM_TIERS };

