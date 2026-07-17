import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getChampionSearchVariations } from '../../../lib/championNames';

// ============================================================
// チャンピオン別のKTM実戦成績 (課題#51 / #50フェーズB)
//
// チャンピオン辞典の「主張」と、KTMカスタムでの実際の成績を並べて見られるようにする。
// 辞典が古かったり実態と乖離していれば、この数字で気づける（判断は人間）。
// DB(ktm_match_participants + ktm_matches)のみ参照・LLM/外部API不要。
// GET /api/champion-stats?champion=Lillia
// ============================================================

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const champion = (new URL(req.url).searchParams.get('champion') || '').trim();
    if (!champion) return NextResponse.json({ error: 'champion を指定してください。' }, { status: 400 });

    const variations = getChampionSearchVariations(champion);
    const orQuery = variations.map((v) => `champion_name.ilike.%${v}%`).join(',');

    const { data: parts } = await supabase
      .from('ktm_match_participants')
      .select('match_id, team, player_name, kills, deaths, assists, cs, vision_score, ktm_matches!inner(winning_team, game_duration)')
      .or(orQuery)
      .limit(500);

    const rows = parts || [];
    if (rows.length === 0) {
      return NextResponse.json({ champion, games: 0, message: 'KTMでの使用実績がありません。' });
    }

    let wins = 0, k = 0, d = 0, a = 0, csSum = 0, csCount = 0, visSum = 0;
    const byPlayer: Record<string, { games: number; wins: number }> = {};
    for (const r of rows as any[]) {
      const isWin = r.team === r.ktm_matches?.winning_team;
      if (isWin) wins++;
      k += r.kills || 0; d += r.deaths || 0; a += r.assists || 0;
      if (r.cs) { csSum += r.cs; csCount++; }
      visSum += r.vision_score || 0;
      const p = byPlayer[r.player_name] || { games: 0, wins: 0 };
      p.games++; if (isWin) p.wins++;
      byPlayer[r.player_name] = p;
    }

    const games = rows.length;
    const topPlayers = Object.entries(byPlayer)
      .sort((x, y) => y[1].games - x[1].games)
      .slice(0, 5)
      .map(([name, s]) => ({ name, games: s.games, winRate: Math.round((s.wins / s.games) * 100) }));

    return NextResponse.json({
      champion,
      games,
      winRate: Math.round((wins / games) * 100),
      avgKda: d === 0 ? (k + a).toFixed(1) : ((k + a) / d).toFixed(2),
      avgKills: (k / games).toFixed(1),
      avgDeaths: (d / games).toFixed(1),
      avgAssists: (a / games).toFixed(1),
      avgCs: csCount > 0 ? Math.round(csSum / csCount) : null,
      avgVision: Math.round(visSum / games),
      topPlayers,
    });
  } catch (err: any) {
    console.error('[champion-stats] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
