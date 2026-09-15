import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

// leaderboard/page.tsx の「メタ統計」タブ用: チャンピオン別ピック数・勝率・平均KDA集計API。
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: partData, error: partError } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('match_id, player_name, champion_name, team, kills, deaths, assists')
        .range(from, to)
    );
    if (partError) throw partError;

    const { data: matchWins, error: matchWinsError } = await supabase
      .from('ktm_matches')
      .select('id, winning_team');
    if (matchWinsError) throw matchWinsError;

    const winMap: Record<string, string> = {};
    (matchWins || []).forEach((m: any) => { winMap[String(m.id)] = m.winning_team; });

    const agg: Record<string, { 
      games: number; 
      wins: number; 
      k: number; 
      d: number; 
      a: number;
      players: Record<string, { games: number; wins: number }>;
    }> = {};

    (partData || []).forEach((r: any) => {
      const c = r.champion_name;
      if (!c) return;
      if (!agg[c]) agg[c] = { games: 0, wins: 0, k: 0, d: 0, a: 0, players: {} };
      agg[c].games += 1;
      const winningTeam = winMap[String(r.match_id)];
      const isWin = r.team === winningTeam;
      if (isWin) agg[c].wins += 1;
      agg[c].k += r.kills || 0; agg[c].d += r.deaths || 0; agg[c].a += r.assists || 0;

      const pName = r.player_name || 'Unknown';
      if (!agg[c].players[pName]) {
        agg[c].players[pName] = { games: 0, wins: 0 };
      }
      agg[c].players[pName].games += 1;
      if (isWin) agg[c].players[pName].wins += 1;
    });

    const rows = Object.entries(agg).map(([name, s]) => {
      const playerList = Object.entries(s.players).map(([pName, pStats]) => ({
        name: pName,
        games: pStats.games,
        wins: pStats.wins,
        winRate: Math.round((pStats.wins / pStats.games) * 100)
      })).sort((a, b) => b.games - a.games || b.wins - a.wins);

      return {
        name,
        champion: name,
        games: s.games,
        wins: s.wins,
        winRate: Math.round((s.wins / s.games) * 100),
        avgKda: s.d > 0 ? Math.round(((s.k + s.a) / s.d) * 10) / 10 : Math.round((s.k + s.a) * 10) / 10,
        players: playerList,
      };
    }).sort((a, b) => b.games - a.games || b.winRate - a.winRate);

    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error('[leaderboard/meta] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
