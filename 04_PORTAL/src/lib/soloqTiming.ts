// ============================================================
// ソロQ試合履歴(soloq_match_history)から、指定時刻(既定は現在)の
// 曜日×時間帯における過去勝率を算出する。ティルト診断の「次の試合に
// 行くべきか」判定に、曜日・時間帯の勝率も加味するために追加。
//
// 該当時間帯ピンポイントのサンプルが少なすぎる場合は同じ曜日全体に
// フォールバックし、それでも足りなければ「データ不足」を返す。
// ============================================================

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export interface TimingContext {
  day: number; // 0=日〜6=土 (JST)
  hour: number; // 0-23 (JST)
  dayLabel: string;
  games: number;
  wins: number;
  winRate: number | null;
  scope: 'hour' | 'day' | 'none';
}

const MIN_HOUR_SAMPLES = 3;
const MIN_DAY_SAMPLES = 5;

export async function getTimingContext(supabase: any, puuid: string, at: Date = new Date()): Promise<TimingContext> {
  const jst = new Date(at.getTime() + 9 * 3600 * 1000);
  const day = jst.getUTCDay();
  const hour = jst.getUTCHours();
  const dayLabel = DAY_LABELS[day];

  const { data } = await supabase
    .from('soloq_match_history')
    .select('game_start_timestamp, win')
    .eq('puuid', puuid);
  const rows = data || [];

  const tally = (targetHour: number | null) => {
    let games = 0;
    let wins = 0;
    for (const row of rows) {
      const rowJst = new Date(new Date(row.game_start_timestamp).getTime() + 9 * 3600 * 1000);
      if (rowJst.getUTCDay() !== day) continue;
      if (targetHour !== null && rowJst.getUTCHours() !== targetHour) continue;
      games++;
      if (row.win) wins++;
    }
    return { games, wins };
  };

  const hourStats = tally(hour);
  if (hourStats.games >= MIN_HOUR_SAMPLES) {
    return { day, hour, dayLabel, games: hourStats.games, wins: hourStats.wins, winRate: Math.round((hourStats.wins / hourStats.games) * 100), scope: 'hour' };
  }

  const dayStats = tally(null);
  if (dayStats.games >= MIN_DAY_SAMPLES) {
    return { day, hour, dayLabel, games: dayStats.games, wins: dayStats.wins, winRate: Math.round((dayStats.wins / dayStats.games) * 100), scope: 'day' };
  }

  return { day, hour, dayLabel, games: hourStats.games, wins: hourStats.wins, winRate: null, scope: 'none' };
}

export interface PlayRecommendation {
  level: 'green' | 'yellow' | 'red';
  label: string;
  reasons: string[];
  cooldownMinutes?: number;
  expectedWinRate?: number | null;
  stopStreakTriggered?: boolean;
}

/** ティルト診断＋時間帯勝率＋連敗ストッパーを踏まえた「次の試合に行くべきか」の統合判定。 */
export function buildPlayRecommendation(
  tilt: { level: 'green' | 'yellow' | 'red'; score?: number },
  timing: TimingContext,
  streakInfo?: {
    currentStreak: number;
    streakType: 'win' | 'loss' | null;
    overallWinRate?: number;
    afterLossWinRate?: number | null;
  }
): PlayRecommendation {
  const reasons: string[] = [];
  let level: 'green' | 'yellow' | 'red' = 'green';
  let cooldownMinutes = 0;
  let stopStreakTriggered = false;

  const timingLabel = timing.scope === 'hour' ? `${timing.dayLabel}曜${timing.hour}時台` : `${timing.dayLabel}曜全体`;
  const lossStreak = streakInfo?.streakType === 'loss' ? streakInfo.currentStreak : 0;

  // 連敗ストッパー判定（最優先）
  if (lossStreak >= 3) {
    level = 'red';
    stopStreakTriggered = true;
    cooldownMinutes = 30;
    reasons.push(`現在${lossStreak}連敗中（ティルト・判断力低下リスク極大）`);
  } else if (lossStreak === 2) {
    level = 'yellow';
    stopStreakTriggered = true;
    cooldownMinutes = 15;
    reasons.push('現在2連敗中（連敗スパイラル警戒）');
  }

  if (streakInfo?.afterLossWinRate !== null && streakInfo?.afterLossWinRate !== undefined && streakInfo.afterLossWinRate < 40 && lossStreak >= 1) {
    if (level !== 'red' && lossStreak >= 2) level = 'red';
    reasons.push(`敗北直後の次戦勝率が ${streakInfo.afterLossWinRate}% と大幅に低下する傾向`);
  }

  if (tilt.level === 'red') {
    level = 'red';
    if (!cooldownMinutes) cooldownMinutes = 20;
    reasons.push('ティルト・他罰感情スコアが高い');
  }
  if (timing.winRate !== null && timing.winRate < 40) {
    level = 'red';
    reasons.push(`${timingLabel}の過去勝率が${timing.winRate}%と低い`);
  }

  if (level !== 'red') {
    if (tilt.level === 'yellow') {
      level = 'yellow';
      if (!cooldownMinutes) cooldownMinutes = 10;
      reasons.push('やや集中力・冷静度が低下');
    }
    if (timing.winRate !== null && timing.winRate < 50) {
      level = 'yellow';
      reasons.push(`${timingLabel}の過去勝率がやや低め(${timing.winRate}%)`);
    }
  }

  const expectedWinRate = streakInfo?.afterLossWinRate ?? timing.winRate ?? (level === 'red' ? 35 : level === 'yellow' ? 45 : 55);

  const label =
    level === 'red' ? '🛑 今は一旦離れてクールダウン推奨' :
    level === 'yellow' ? '⚠️ 10〜15分休憩を挟んでから再開推奨' :
    '✅ このまま続けてOK';

  return { level, label, reasons, cooldownMinutes, expectedWinRate, stopStreakTriggered };
}

