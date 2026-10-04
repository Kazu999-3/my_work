// ============================================================
// 「次の試合に行くべきか」の判定に使う純粋関数群。
//
// 2026-09-30: これらは /api/coach/analyze の中にローカル関数として埋まっており、
// 同じ判定を別の入口（試合前タブ）から使えなかった。実際、算出した
// playRecommendation はレスポンスに入っていたがどのUIからも参照されておらず、
// 「計算しているのに誰も見ていない」状態だった。
// 共通化して /api/coach/play-recommendation からも使えるようにする。
//
// いずれもLLMもRiot APIも使わない純粋計算。入力は「新しい順」の試合配列。
// ============================================================

export interface MatchLite {
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  champion?: string;
}

export interface TiltDiagnosis {
  level: 'green' | 'yellow' | 'red';
  label: string;
  score: number;
  reasons: string[];
}

/** 直近5試合からティルト（負荷）を判定する。matches は新しい順。 */
export function diagnoseTilt(matches: MatchLite[]): TiltDiagnosis {
  if (matches.length === 0) return { level: 'green', label: '正常', score: 0, reasons: [] };

  const recent = matches.slice(0, 5);
  const losses = recent.filter((m) => !m.win).length;
  const reasons: string[] = [];
  let score = 0;

  // 連敗チェック
  let streak = 0;
  for (const m of recent) {
    if (!m.win) streak++;
    else break;
  }
  if (streak >= 3) { score += 40; reasons.push(`${streak}連敗中`); }
  else if (streak === 2) { score += 20; reasons.push('2連敗中'); }

  // 直近5試合の負け率
  if (losses >= 4) { score += 30; reasons.push(`直近5試合で${losses}敗`); }
  else if (losses >= 3) { score += 15; reasons.push(`直近5試合で${losses}敗`); }

  // デス数が多い試合
  const highDeathGames = recent.filter((m) => m.deaths >= 7).length;
  if (highDeathGames >= 2) { score += 15; reasons.push(`デス7以上の試合が${highDeathGames}件`); }

  // KDA悪化チェック
  const avgKda = recent.reduce((s, m) => s + (m.kills + m.assists) / Math.max(m.deaths, 1), 0) / recent.length;
  if (avgKda < 1.5) { score += 15; reasons.push(`平均KDA ${avgKda.toFixed(1)} (低下傾向)`); }

  const level: 'green' | 'yellow' | 'red' =
    score >= 50 ? 'red' : score >= 25 ? 'yellow' : 'green';
  const label =
    level === 'red' ? '🔴 要休憩（ティルト高）' :
    level === 'yellow' ? '🟡 注意（やや負荷あり）' : '🟢 良好（続けてOK）';

  return { level, label, score, reasons };
}

export interface StreakAnalysis {
  currentStreak: number;
  streakType: 'win' | 'loss' | null;
  overallWinRate: number;
  afterLossWinRate: number | null;
  afterLossStreakWinRate: number | null;
  stopRecommended: boolean;
}

/**
 * 連敗と「連敗後の勝率」の相関から“やめどき”を判定する。matches は新しい順。
 */
export function analyzeStreak(matches: MatchLite[]): StreakAnalysis {
  const chrono = [...matches].reverse(); // 古い→新しい

  // 現在の連続記録（最新から同じ結果が何連続か）
  let currentStreak = 0;
  let streakType: 'win' | 'loss' | null = null;
  if (matches.length > 0) {
    streakType = matches[0].win ? 'win' : 'loss';
    for (const m of matches) {
      if ((m.win ? 'win' : 'loss') === streakType) currentStreak++;
      else break;
    }
  }

  // 「直前が負け」の次の試合の勝率 vs 全体勝率
  let afterLossGames = 0, afterLossWins = 0;
  let afterLossStreakGames = 0, afterLossStreakWins = 0; // 2連敗以上の直後
  let lossRun = 0;
  for (let i = 0; i < chrono.length; i++) {
    if (i > 0) {
      const prevLoss = !chrono[i - 1].win;
      if (prevLoss) { afterLossGames++; if (chrono[i].win) afterLossWins++; }
      if (lossRun >= 2) { afterLossStreakGames++; if (chrono[i].win) afterLossStreakWins++; }
    }
    lossRun = chrono[i].win ? 0 : lossRun + 1;
  }

  const overallWins = matches.filter((m) => m.win).length;
  return {
    currentStreak,
    streakType,
    overallWinRate: matches.length ? Math.round((overallWins / matches.length) * 100) : 0,
    afterLossWinRate: afterLossGames ? Math.round((afterLossWins / afterLossGames) * 100) : null,
    afterLossStreakWinRate: afterLossStreakGames ? Math.round((afterLossStreakWins / afterLossStreakGames) * 100) : null,
    // “やめどき”判定: 現在2連敗以上
    stopRecommended: streakType === 'loss' && currentStreak >= 2,
  };
}
