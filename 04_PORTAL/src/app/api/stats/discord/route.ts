import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// stats/[discord_id]/page.tsx 用: discord_idからプレイヤー・直近20試合・苦手対面チャンピオンを
// まとめて返す読み取り専用API。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get('id');
    if (!discordId) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });

    const { data: pData, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .eq('discord_id', discordId)
      .single();
    if (pError || !pData) {
      return NextResponse.json({ player: null });
    }

    const { data: hData, error: hError } = await supabase
      .from('ktm_match_participants')
      .select(`
        id, match_id, role, team, kills, deaths, assists, kda_score, mmr_delta, created_at, champion_name,
        ktm_matches ( winning_team, game_duration )
      `)
      .eq('player_name', pData.name)
      .order('created_at', { ascending: false })
      .limit(20);
    if (hError || !hData) {
      return NextResponse.json({ player: pData, history: [], nemesisList: [] });
    }

    const mappedHistory: any[] = hData.map((item: any) => ({
      id: item.id,
      match_id: item.match_id,
      role: item.role,
      team: item.team,
      kills: item.kills,
      deaths: item.deaths,
      assists: item.assists,
      kda_score: item.kda_score,
      mmr_delta: item.mmr_delta,
      created_at: item.created_at,
      champion_name: item.champion_name || 'Unknown',
      matches: {
        winning_team: item.ktm_matches?.winning_team || '',
        game_duration: item.ktm_matches?.game_duration || 0,
      },
    }));

    let nemesisList: any[] = [];
    const matchIds = mappedHistory.map((h) => h.match_id);
    if (matchIds.length > 0) {
      const { data: oppData, error: oppError } = await supabase
        .from('ktm_match_participants')
        .select('match_id, role, team, champion_name')
        .in('match_id', matchIds);

      if (!oppError && oppData) {
        mappedHistory.forEach((h) => {
          const oppRecord = oppData.find((o: any) =>
            o.match_id === h.match_id &&
            o.role === h.role &&
            o.team !== h.team
          );
          if (oppRecord) h.opponent_champion = oppRecord.champion_name;
        });

        const nemesisMap: Record<string, { games: number; losses: number }> = {};
        mappedHistory.forEach((h) => {
          if (!h.opponent_champion || h.opponent_champion === 'Unknown') return;
          const isWin = h.team === h.matches.winning_team;
          if (!nemesisMap[h.opponent_champion]) nemesisMap[h.opponent_champion] = { games: 0, losses: 0 };
          nemesisMap[h.opponent_champion].games += 1;
          if (!isWin) nemesisMap[h.opponent_champion].losses += 1;
        });

        nemesisList = Object.entries(nemesisMap)
          .map(([champ, stat]) => ({
            championName: champ,
            games: stat.games,
            losses: stat.losses,
            winRate: stat.games > 0 ? Math.round(((stat.games - stat.losses) / stat.games) * 100) : 0,
          }))
          .filter((n) => n.losses > 0)
          .sort((a, b) => b.losses - a.losses || a.winRate - b.winRate)
          .slice(0, 3);
      }
    }

    return NextResponse.json({ player: pData, history: mappedHistory, nemesisList });
  } catch (err: any) {
    console.error('[stats/discord] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
