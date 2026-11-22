import { isNormalMatch } from '../matchType';

export interface TodayPlayerStat {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface CustomDayWindow {
  dateLabel: string;
  startIso: string;
  endIso: string;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_BOUNDARY_HOUR_JST = 5;

/**
 * JST 5:00 を1日の起点とした「本日のカスタム開催日」ウィンドウを算出する。
 * 深夜 0:00〜4:59 は前日の開催日として扱う（例: 11/22 01:30 JST -> 11/21 05:00 〜 11/22 04:59:59）。
 */
export function getCustomDayWindowJst5(now: Date = new Date()): CustomDayWindow {
  const jstMs = now.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstMs);

  // JST 5:00 より前なら 1日戻す
  if (jstDate.getUTCHours() < DAY_BOUNDARY_HOUR_JST) {
    jstDate.setUTCDate(jstDate.getUTCDate() - 1);
  }

  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstDate.getUTCDate()).padStart(2, '0');
  const dateLabel = `${yyyy}-${mm}-${dd}`;

  // 開催日の 05:00:00 JST を UTC ミリ秒に戻す
  const startJstAsUtc = Date.UTC(yyyy, jstDate.getUTCMonth(), jstDate.getUTCDate(), DAY_BOUNDARY_HOUR_JST, 0, 0, 0);
  const startUtcMs = startJstAsUtc - JST_OFFSET_MS;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;

  return {
    dateLabel,
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

/**
 * 当日の定期カスタム (NORMAL) 試合のみを対象に、参加者ごとの試合数・勝ち数・勝率を集計する。
 */
export function aggregateTodayCustomStats(
  matches: Array<{
    id: string | number;
    match_type?: string | null;
    riot_match_id?: string | null;
    winning_team?: string | null;
  }>,
  participants: Array<{
    match_id: string | number;
    player_name: string;
    team: string;
  }>
): { totalMatches: number; stats: TodayPlayerStat[] } {
  const validMatchWinners = new Map<string, string>();

  for (const m of matches) {
    if (!isNormalMatch(m)) continue;
    if (m.winning_team !== 'BLUE' && m.winning_team !== 'RED') continue;
    validMatchWinners.set(String(m.id), m.winning_team);
  }

  const byName = new Map<string, { name: string; games: number; wins: number }>();

  for (const p of participants) {
    const winner = validMatchWinners.get(String(p.match_id));
    if (!winner) continue;
    if (p.team !== 'BLUE' && p.team !== 'RED') continue;
    const rawName = (p.player_name || '').trim();
    if (!rawName) continue;

    const key = rawName.toLowerCase();
    const cur = byName.get(key) || { name: rawName, games: 0, wins: 0 };
    cur.games += 1;
    if (p.team === winner) {
      cur.wins += 1;
    }
    byName.set(key, cur);
  }

  const stats: TodayPlayerStat[] = Array.from(byName.values())
    .map((s) => ({
      name: s.name,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      winRate: s.games > 0 ? Math.round((s.wins / s.games) * 1000) / 10 : 0,
    }))
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.games !== a.games) return b.games - a.games;
      return a.name.localeCompare(b.name, 'ja');
    });

  return {
    totalMatches: validMatchWinners.size,
    stats,
  };
}
