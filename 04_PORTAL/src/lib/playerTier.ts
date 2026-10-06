/**
 * プレイヤーの経験度・参加頻度（Tier）判定ロジック
 * バランサー画面・戦績分析・Discordロール連携で共通利用する単一の真実（SSoT）。
 */

export type ExperienceTier = 'new' | 'light' | 'regular' | 'experienced' | 'returning';

export interface PlayerTierInfo {
  tier: ExperienceTier;
  label: string;
  tip: string;
  colorClass: string;
}

export interface PlayerStatsForTier {
  total_games?: number | null;
  games?: number | null;
  recent_games_30d?: number | null;
  days_since_last_match?: number | null;
  metadata?: {
    games?: number | null;
  } | null;
}

/**
 * プレイヤーの戦績情報から経験度Tierを判定する
 */
export function getPlayerTier(p: PlayerStatsForTier): PlayerTierInfo {
  const totalG = p.total_games ?? p.games ?? p.metadata?.games ?? 0;
  const daysAgo = p.days_since_last_match ?? null;
  const recent30d = p.recent_games_30d ?? (daysAgo !== null && daysAgo <= 30 ? 1 : 0);

  // 1. 初参加（通算0戦）
  if (totalG === 0) {
    return {
      tier: 'new',
      label: '🔰 初参加',
      colorClass: 'bg-success-100 text-success-900 border-success-edge',
      tip: '通算0戦：初参加のプレイヤーです！大歓迎✨',
    };
  }

  // 2. ライト層（通算1〜4戦）
  if (totalG <= 4) {
    return {
      tier: 'light',
      label: '🌱 ライト',
      colorClass: 'bg-secondary-100 text-secondary-900 border-secondary-edge',
      tip: `通算${totalG}戦：参加経験が浅いライトプレイヤーです`,
    };
  }

  // 3. 通算5戦以上だが直近参加がない（30日以上ブランク）
  if (daysAgo !== null && daysAgo > 30) {
    if (daysAgo >= 60) {
      return {
        tier: 'returning',
        label: '⏳ 復帰勢',
        colorClass: 'bg-primary-100 text-primary-900 border-primary-edge',
        tip: `通算${totalG}戦（最終参加: ${daysAgo}日前）：久しぶりの参加となる復帰プレイヤーです！大歓迎✨`,
      };
    }
    return {
      tier: 'experienced',
      label: '🎖️ 経験者',
      colorClass: 'bg-secondary-100 text-secondary-900 border-secondary-edge',
      tip: `通算${totalG}戦（最終参加: ${daysAgo}日前）：久しぶりに参加の経験者プレイヤーです`,
    };
  }

  // 4. 直近も定期参加している現役常連
  return {
    tier: 'regular',
    label: '👑 常連',
    colorClass: 'bg-primary-100 text-primary-900 border-primary-edge',
    tip: `通算${totalG}戦（直近30日: ${recent30d}戦）：定期的に参加しているアクティブ常連メンバーです`,
  };
}
