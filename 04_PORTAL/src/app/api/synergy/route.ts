import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../lib/fetchAll';

// synergy/page.tsx 用: 全試合データからチームシナジー(2〜5人コンビの勝率)を集計する
// 読み取り専用API。従来はブラウザが全ktm_match_participants行を受信して集計していたが、
// 直接アクセスのAPI経由化に合わせ、集計自体もサーバー側で行う(エグレス削減も兼ねる)。
export const dynamic = 'force-dynamic';

interface AllyStat { p1: string; p2: string; games: number; wins: number; winRate: number }
interface GroupStat { members: string[]; games: number; wins: number; winRate: number }

function combosOf<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, cur: T[]) => {
    if (cur.length === k) { result.push([...cur]); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); walk(i + 1, cur); cur.pop(); }
  };
  walk(0, []);
  return result;
}

export async function GET() {
  try {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('match_id, player_name, team, role')
        .range(from, to)
    );
    if (error) throw error;

    const { data: matchWins, error: matchWinsError } = await supabase
      .from('ktm_matches')
      .select('id, winning_team');
    if (matchWinsError) throw matchWinsError;

    const winMap: Record<number, 'BLUE' | 'RED'> = {};
    (matchWins || []).forEach((m: any) => { winMap[m.id] = m.winning_team; });

    const { data: allPlayersData, error: allPlayersError } = await supabase
      .from('ktm_players')
      .select('name, is_active')
      .neq('is_active', false);
    if (allPlayersError) throw allPlayersError;

    const registeredPlayerNames = new Set<string>(
      (allPlayersData || []).map((p: any) => p.name?.trim()).filter(Boolean)
    );
    const allPlayerNamesList: string[] = Array.from(registeredPlayerNames).sort((a, b) => a.localeCompare(b, 'ja'));

    if (!data) throw new Error('No data');

    const matches: Record<number, { BLUE: string[], RED: string[], winner: 'BLUE' | 'RED' }> = {};
    data.forEach((row: any) => {
      const winner = winMap[row.match_id];
      const rawName = row.player_name?.trim();
      if (!winner || !rawName) return;
      // アクティブな登録プレイヤー以外（トラとらお等の未登録ゲストや非アクティブ選手）は除外
      if (!registeredPlayerNames.has(rawName)) return;

      if (!matches[row.match_id]) {
        matches[row.match_id] = { BLUE: [], RED: [], winner };
      }
      matches[row.match_id][row.team as 'BLUE' | 'RED'].push(rawName);
    });

    const allyMap: Record<string, { games: number, wins: number }> = {};
    const groupMaps: Record<number, Record<string, { games: number; wins: number }>> = { 3: {}, 4: {}, 5: {} };

    Object.values(matches).forEach(m => {
      const processTeam = (teamPlayers: string[], isWin: boolean) => {
        // 重複除外＆アクティブ選手のみ
        const uniquePlayers = Array.from(new Set(teamPlayers)).filter(p => registeredPlayerNames.has(p));
        for (let i = 0; i < uniquePlayers.length; i++) {
          for (let j = i + 1; j < uniquePlayers.length; j++) {
            const pair = [uniquePlayers[i], uniquePlayers[j]].sort();
            const key = `${pair[0]}::${pair[1]}`;
            if (!allyMap[key]) allyMap[key] = { games: 0, wins: 0 };
            allyMap[key].games++;
            if (isWin) allyMap[key].wins++;
          }
        }
        for (const k of [3, 4, 5]) {
          if (uniquePlayers.length < k) continue;
          for (const combo of combosOf(uniquePlayers, k)) {
            const key = [...combo].sort().join('::');
            if (!groupMaps[k][key]) groupMaps[k][key] = { games: 0, wins: 0 };
            groupMaps[k][key].games++;
            if (isWin) groupMaps[k][key].wins++;
          }
        }
      };
      processTeam(m.BLUE, m.winner === 'BLUE');
      processTeam(m.RED, m.winner === 'RED');
    });

    const allyStats: AllyStat[] = Object.entries(allyMap).map(([key, stat]) => {
      const [p1, p2] = key.split('::');
      return { p1, p2, games: stat.games, wins: stat.wins, winRate: stat.wins / stat.games };
    });

    const groupStats: Record<number, GroupStat[]> = { 3: [], 4: [], 5: [] };
    [3, 4, 5].forEach(k => {
      groupStats[k] = Object.entries(groupMaps[k]).map(([key, stat]) => ({
        members: key.split('::'),
        games: stat.games,
        wins: stat.wins,
        winRate: stat.wins / stat.games,
      }));
    });

    return NextResponse.json({ 
      allyStats, 
      groupStats, 
      allPlayers: allPlayerNamesList,
      totalMatches: Object.keys(matches).length 
    });
  } catch (err: any) {
    console.error('[synergy] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
