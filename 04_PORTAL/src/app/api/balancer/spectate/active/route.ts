import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pendingId = searchParams.get('pendingId');

    let balanceResult: any = null;
    let createdAt: string = new Date().toISOString();

    if (pendingId) {
      const { data: task } = await supabase
        .from('edge_tasks')
        .select('payload, created_at')
        .eq('id', pendingId)
        .eq('task_type', 'balancer_pending')
        .maybeSingle();

      if (task?.payload?.balanceResult) {
        balanceResult = task.payload.balanceResult;
        createdAt = task.created_at;
      }
    }

    if (!balanceResult) {
      // 最新の pending タスクを取得
      const { data: latestTask } = await supabase
        .from('edge_tasks')
        .select('payload, created_at')
        .eq('task_type', 'balancer_pending')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestTask?.payload?.balanceResult) {
        balanceResult = latestTask.payload.balanceResult;
        createdAt = latestTask.created_at;
      }
    }

    // 直近マッチ履歴からのフォールバック
    if (!balanceResult) {
      const { data: recentMatch } = await supabase
        .from('ktm_matches')
        .select(`
          id, created_at, winning_team,
          ktm_match_participants (
            player_name, team, role, champion_name, kills, deaths, assists, player_mmr, mmr_delta
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentMatch && recentMatch.ktm_match_participants) {
        const parts = recentMatch.ktm_match_participants;
        const blue = parts.filter((p: any) => p.team === 'BLUE').map((p: any) => ({
          name: p.player_name,
          assignedRole: p.role,
          mmr: p.player_mmr || 1200,
          champion_name: p.champion_name,
        }));
        const red = parts.filter((p: any) => p.team === 'RED').map((p: any) => ({
          name: p.player_name,
          assignedRole: p.role,
          mmr: p.player_mmr || 1200,
          champion_name: p.champion_name,
        }));

        const avg = (arr: any[]) => Math.round(arr.reduce((s, p) => s + (p.mmr || 1200), 0) / (arr.length || 1));
        balanceResult = {
          teamBlue: blue,
          teamRed: red,
          teamBlueMMR: avg(blue),
          teamRedMMR: avg(red),
          mmrDiff: Math.abs(avg(blue) - avg(red)),
          spectators: [],
          isHistoricalFallback: true,
          matchId: recentMatch.id,
        };
        createdAt = recentMatch.created_at;
      }
    }

    if (!balanceResult || !balanceResult.teamBlue || !balanceResult.teamRed) {
      return NextResponse.json({ success: true, active: false, match: null });
    }

    // 両チームプレイヤーのプール・得意チャンプ・戦績を付加
    const allNames = [
      ...balanceResult.teamBlue.map((p: any) => p.name),
      ...balanceResult.teamRed.map((p: any) => p.name),
    ];

    const { data: dbPlayers } = await supabase
      .from('ktm_players')
      .select('name, champion_pool, highest_rank, mmr, playstyle, role_preferences')
      .in('name', allNames);

    const playerMeta: Record<string, any> = {};
    (dbPlayers || []).forEach((p: any) => {
      playerMeta[p.name] = p;
    });

    // 直近100戦のチャンプピック集計
    const { data: recentPicks } = await supabase
      .from('ktm_match_participants')
      .select('player_name, champion_name')
      .in('player_name', allNames)
      .not('champion_name', 'is', null)
      .limit(200);

    const champPicksMap: Record<string, Record<string, number>> = {};
    (recentPicks || []).forEach((row: any) => {
      const pn = row.player_name;
      const cn = row.champion_name;
      if (!pn || !cn) return;
      if (!champPicksMap[pn]) champPicksMap[pn] = {};
      champPicksMap[pn][cn] = (champPicksMap[pn][cn] || 0) + 1;
    });

    const enrichPlayer = (p: any) => {
      const meta = playerMeta[p.name] || {};
      const pool = Array.isArray(meta.champion_pool) ? meta.champion_pool : (meta.champion_pool ? [meta.champion_pool] : []);
      const pickCounts = Object.entries(champPicksMap[p.name] || {}).sort((a, b) => b[1] - a[1]);
      const topPicks = pickCounts.slice(0, 3).map(([c]) => c);
      const combinedPool = Array.from(new Set([...topPicks, ...pool])).slice(0, 4);

      return {
        ...p,
        highest_rank: meta.highest_rank || p.highest_rank || 'UNRANKED',
        mmr: p.mmr || meta.mmr || 1200,
        pool: combinedPool,
        playstyle: meta.playstyle || 'バランス',
      };
    };

    const enrichedBlue = balanceResult.teamBlue.map(enrichPlayer);
    const enrichedRed = balanceResult.teamRed.map(enrichPlayer);

    // AIニュースまたは最新ドラフト戦略があれば添付
    let draftAdvice: any = null;
    let matchNews: any = null;

    try {
      const { data: newsTask } = await supabase
        .from('edge_tasks')
        .select('payload')
        .eq('task_type', 'ktm_match_news')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newsTask?.payload?.article) {
        matchNews = newsTask.payload.article;
      }
    } catch {}

    return NextResponse.json({
      success: true,
      active: true,
      match: {
        ...balanceResult,
        teamBlue: enrichedBlue,
        teamRed: enrichedRed,
        createdAt,
        draftAdvice,
        matchNews,
      },
    });
  } catch (error: any) {
    console.error('[balancer/spectate/active GET] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
