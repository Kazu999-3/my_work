/**
 * KTMカスタムの試合種別（Match Types）定義と判定ヘルパー
 * 
 * - NORMAL: 通常の真剣勝負カスタム戦（MMR変動、レーン別勝率、リーダーボード等の全集計対象）
 * - EVENT: お祭りカスタム、出欠確認ダミー、特殊ミニゲーム戦（レート非干渉、勝率ノーカウント保護）
 * - TOURNAMENT: 大会・スクリム戦（別枠の大会用スタッツ等として管理可能）
 */

export type MatchType = 'NORMAL' | 'EVENT' | 'TOURNAMENT';

export interface MatchLike {
  match_type?: string | null;
  riot_match_id?: string | null;
  winning_team?: string | null;
  [key: string]: any;
}

/**
 * 試合データから match_type を判定・取得する。
 * DBに match_type カラムが存在すればそれを最優先し、
 * 未設定または古いレコードの場合は riot_match_id や winning_team から安全に導出する。
 */
export function getMatchType(match?: MatchLike | null): MatchType {
  if (!match) return 'NORMAL';

  // 1. DBに明示的な match_type が保存されている場合
  if (match.match_type) {
    const upper = String(match.match_type).toUpperCase();
    if (upper === 'EVENT' || upper === 'TOURNAMENT' || upper === 'NORMAL') {
      return upper as MatchType;
    }
  }

  // 2. 過去のフラグ・ステータスからのフォールバック判定
  const isExhibition =
    match.riot_match_id === 'EXHIBITION' ||
    String(match.riot_match_id || '').startsWith('FESTIVAL') ||
    match.winning_team === 'DRAW';

  if (isExhibition) {
    return 'EVENT';
  }

  return 'NORMAL';
}

/**
 * 公式戦績・MMR変動・勝率集計に反映すべき通常の真剣勝負かどうかを判定する。
 */
export function isNormalMatch(match?: MatchLike | null): boolean {
  return getMatchType(match) === 'NORMAL';
}

/**
 * レート非干渉のお祭り・イベントマッチかどうかを判定する。
 */
export function isEventMatch(match?: MatchLike | null): boolean {
  return getMatchType(match) === 'EVENT';
}
