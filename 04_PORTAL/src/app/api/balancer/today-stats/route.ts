import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getCustomDayWindowJst5, aggregateTodayCustomStats } from '../../../../lib/balancer/todayStats';
import { reportApiError } from '../../../../lib/apiHandler';
import { getAuthSession } from '../../../../lib/authGuard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/balancer/today-stats
 * 当日（JST 5:00起点）の定期カスタム (NORMAL) 試合のプレイヤー別勝率を返す（SPEC 11）
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'ログインが必要です。' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 });
    }

    const window = getCustomDayWindowJst5(new Date());

    const { data: matches, error: mErr } = await supabase
      .from('ktm_matches')
      .select('id, match_type, riot_match_id, winning_team, created_at')
      .gte('created_at', window.startIso)
      .lte('created_at', window.endIso);

    if (mErr) throw mErr;

    const matchList = matches || [];
    if (matchList.length === 0) {
      return NextResponse.json({
        ok: true,
        dateLabel: window.dateLabel,
        totalMatches: 0,
        stats: [],
      });
    }

    const matchIds = matchList.map((m: any) => m.id);
    const { data: participants, error: pErr } = await supabase
      .from('ktm_match_participants')
      .select('match_id, player_name, team')
      .in('match_id', matchIds);

    if (pErr) throw pErr;

    const { totalMatches, stats } = aggregateTodayCustomStats(matchList, participants || []);

    return NextResponse.json({
      ok: true,
      dateLabel: window.dateLabel,
      totalMatches,
      stats,
    });
  } catch (err: any) {
    console.error('[api/balancer/today-stats] error:', err);
    reportApiError({
      route: '/api/balancer/today-stats',
      error: err,
      statusCode: 500,
    });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
