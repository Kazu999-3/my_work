import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../lib/fetchAll';
import { getKtmRank } from '../../../lib/mmr';

// leaderboard/page.tsx の「MMRランキング」タブ用集計API。
// 従来はブラウザが全ktm_match_participants行を受信して集計していたのをサーバー側に移す。
export const dynamic = 'force-dynamic';

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const minGames = Number(searchParams.get('minGames')) || 0;

    const { data: players, error: pError } = await supabase
      .from('ktm_players')
      .select('name, discord_id, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup');
    if (pError || !players) throw pError || new Error('players not found');

    const { data: matchesData, error: mError } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('player_name, discord_id, role, team, match_id')
        .range(from, to)
    );
    if (mError) throw mError;

    const { data: rawMatches, error: rawmError } = await supabase
      .from('ktm_matches')
      .select('id, winning_team');
    if (rawmError) throw rawmError;

    const matchWinMap = new Map<number, string>();
    (rawMatches || []).forEach((m: any) => matchWinMap.set(m.id, m.winning_team));

    const byDiscord = new Map<string, any>();
    const byName = new Map<string, any>();
    players.forEach((p: any) => {
      if (p.discord_id) byDiscord.set(p.discord_id, p);
      byName.set(p.name, p);
    });
    const keyOfPlayer = (p: any) => p.discord_id || p.name;

    const statsMap: Record<string, Record<string, { games: number; wins: number }>> = {};
    players.forEach((p: any) => {
      statsMap[keyOfPlayer(p)] = {
        TOP: { games: 0, wins: 0 }, JG: { games: 0, wins: 0 }, MID: { games: 0, wins: 0 },
        ADC: { games: 0, wins: 0 }, SUP: { games: 0, wins: 0 },
      };
    });

    (matchesData || []).forEach((m: any) => {
      const resolved = (m.discord_id && byDiscord.get(m.discord_id)) || byName.get(m.player_name);
      if (!resolved) return;
      const key = keyOfPlayer(resolved);
      const role = (m.role || '').toUpperCase();
      const winningTeam = matchWinMap.get(m.match_id);
      if (statsMap[key] && statsMap[key][role]) {
        statsMap[key][role].games += 1;
        if (m.team === winningTeam) statsMap[key][role].wins += 1;
      }
    });

    const result: Record<string, any[]> = { TOP: [], JG: [], MID: [], ADC: [], SUP: [] };
    ROLES.forEach((role) => {
      const mmrKey = `mmr_${role.toLowerCase()}`;
      const roleRanking = players
        .filter((p: any) => {
          const stats = statsMap[keyOfPlayer(p)]?.[role];
          return stats && stats.games >= minGames;
        })
        .map((p: any) => {
          const stats = statsMap[keyOfPlayer(p)][role];
          const mmr = Number(p[mmrKey] || 1200);
          const winRate = stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : '0.0';
          return {
            name: p.name,
            discordId: p.discord_id,
            mmr,
            games: stats.games,
            winRate,
            rankBadge: getKtmRank(mmr),
          };
        })
        .sort((a: any, b: any) => b.mmr - a.mmr)
        .slice(0, 5);
      result[role] = roleRanking;
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[leaderboard] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
