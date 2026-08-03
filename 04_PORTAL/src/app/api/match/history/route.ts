import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// ktm_matches + ktm_match_participants（+任意でbalancer_predictions）の読み取り専用API。
// history/page.tsx, ktm-admin/MatchHistoryPanel.tsx, coach/FiveVFiveSimTab.tsx が
// それぞれ似た形のクエリをブラウザから直接投げていたのを1つに集約する。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50));
    const withPredictions = searchParams.get('withPredictions') === 'true';

    const { data, error } = await supabase
      .from('ktm_matches')
      .select(`
        id,
        created_at,
        winning_team,
        ktm_match_participants (
          player_name, team, role, champion_name, kills, deaths, assists,
          player_mmr, kda_score, mmr_delta, cs, damage_dealt, vision_score
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const matches = (data || []).map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      winning_team: m.winning_team,
      participants: m.ktm_match_participants || [],
    }));

    if (!withPredictions || matches.length === 0) {
      return NextResponse.json({ matches });
    }

    const matchIds = matches.map((m: any) => m.id);
    const { data: preds, error: predError } = await supabase
      .from('balancer_predictions')
      .select('match_id, predicted_blue_winprob, correct')
      .in('match_id', matchIds);
    if (predError) console.warn('[match/history] predictions fetch failed:', predError.message);

    const predMap = new Map<number, { predicted_blue_winprob: number; correct: boolean }>();
    (preds || []).forEach((p: any) => {
      if (p.match_id) {
        predMap.set(Number(p.match_id), {
          predicted_blue_winprob: Number(p.predicted_blue_winprob),
          correct: p.correct,
        });
      }
    });

    const withPrediction = matches.map((m: any) => ({ ...m, prediction: predMap.get(Number(m.id)) || null }));
    return NextResponse.json({ matches: withPrediction });
  } catch (err: any) {
    console.error('[match/history] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
