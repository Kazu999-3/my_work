/**
 * 他罰型ティルト（味方へのイライラ・責任転嫁）および冷静さの検知・スコア算出ユーティリティ
 */

export type QuickChoiceOption = 'ally_fault' | 'self_fault' | 'comp_fault' | 'unknown';

export interface BlameCheckResult {
  isBlaming: boolean;
  blameScore: number;       // 他罰イライラ度 (0~100)
  calmScore: number;        // 冷静・客観度 (0~100)
  reasons: string[];
  suggestedAction: 'none' | 'detox_recommended' | 'detox_required';
  quickChoice?: QuickChoiceOption;
}

const BLAME_KEYWORDS = [
  '味方', 'jg', 'sup', 'top', 'mid', 'adc',
  'ゴミ', '下手', 'あいつ', 'まじで', '寄らない',
  'レーン崩壊', 'トロール', 'フィーダー', 'まともな',
  'ノックアップ', '放置', 'キャリーできない', '逆転',
  'マッチング', '当たり運', '対面育ち', 'カバーなし'
];

/**
 * 振り返り文や感想テキスト内の他罰（味方への批判）語彙率を解析
 */
export function analyzeBlameText(inputText: string): BlameCheckResult {
  if (!inputText || !inputText.trim()) {
    return { isBlaming: false, blameScore: 0, calmScore: 50, reasons: [], suggestedAction: 'none' };
  }

  const text = inputText.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const keyword of BLAME_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  // キーワードの検出数に応じたスコア算出（1ワード当たり25点、最大100点）
  const blameScore = Math.min(100, matchedKeywords.length * 25);
  const calmScore = Math.max(0, 100 - blameScore);
  const isBlaming = blameScore >= 50;

  const reasons: string[] = [];
  if (matchedKeywords.length > 0) {
    reasons.push(`他者批判ワード検知: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }

  let suggestedAction: 'none' | 'detox_recommended' | 'detox_required' = 'none';
  if (blameScore >= 75) {
    suggestedAction = 'detox_required';
    reasons.push('過度な他罰感情（アンガーデトックス必須）');
  } else if (blameScore >= 50) {
    suggestedAction = 'detox_recommended';
    reasons.push('味方への不満蓄積（アンガーデトックス推奨）');
  }

  return {
    isBlaming,
    blameScore,
    calmScore,
    reasons,
    suggestedAction,
  };
}

/**
 * 1秒直感チェック + AI感情トーン解析 + 戦績の統合スコアリング
 */
export function calculateIntegratedTiltScore({
  quickChoice,
  aiBlameScore = 0,
  aiCalmScore = 50,
  lossStreak = 0,
  text,
}: {
  quickChoice?: QuickChoiceOption;
  aiBlameScore?: number;
  aiCalmScore?: number;
  lossStreak?: number;
  text?: string;
}): BlameCheckResult {
  const reasons: string[] = [];

  // 1. 1秒直感チェックのスコア (30%重み付け)
  let choiceBlameScore = 0;
  let choiceCalmScore = 50;

  if (quickChoice === 'ally_fault') {
    choiceBlameScore = 90;
    choiceCalmScore = 10;
    reasons.push('直感判定: 味方のミス・判断が主因');
  } else if (quickChoice === 'self_fault') {
    choiceBlameScore = 10;
    choiceCalmScore = 90;
    reasons.push('直感判定: 自分のミス・判断が主因 (高い冷静度)');
  } else if (quickChoice === 'comp_fault') {
    choiceBlameScore = 20;
    choiceCalmScore = 80;
    reasons.push('直感判定: チーム構成・不可抗力が主因 (客観視)');
  } else if (quickChoice === 'unknown') {
    choiceBlameScore = 30;
    choiceCalmScore = 50;
  }

  // 2. 戦績・連敗数スコア (30%重み付け)
  let streakBlameScore = Math.min(100, lossStreak * 30);
  let streakCalmScore = Math.max(0, 100 - lossStreak * 25);
  if (lossStreak >= 2) {
    reasons.push(`直近戦績: ${lossStreak}連敗中 (メンタル圧迫)`);
  }

  // 3. テキストキーワード補充
  const textCheck = text ? analyzeBlameText(text) : null;
  const effectiveAiBlame = textCheck && textCheck.blameScore > aiBlameScore ? textCheck.blameScore : aiBlameScore;
  if (textCheck && textCheck.reasons.length > 0) {
    reasons.push(...textCheck.reasons);
  }

  // 4. 重み付け統合スコア (30% + 30% + 40%)
  const finalBlameScore = Math.round(choiceBlameScore * 0.3 + streakBlameScore * 0.3 + effectiveAiBlame * 0.4);
  const finalCalmScore = Math.round(choiceCalmScore * 0.3 + streakCalmScore * 0.3 + aiCalmScore * 0.4);

  const isBlaming = finalBlameScore >= 50;

  let suggestedAction: 'none' | 'detox_recommended' | 'detox_required' = 'none';
  if (finalBlameScore >= 70) {
    suggestedAction = 'detox_required';
    reasons.push('他罰イライラ度 70% 以上 ➔ アンガーデトックス必須');
  } else if (finalBlameScore >= 50) {
    suggestedAction = 'detox_recommended';
    reasons.push('他罰イライラ度 50% 以上 ➔ デトックス推奨');
  }

  return {
    isBlaming,
    blameScore: finalBlameScore,
    calmScore: finalCalmScore,
    reasons: Array.from(new Set(reasons)),
    suggestedAction,
    quickChoice,
  };
}
