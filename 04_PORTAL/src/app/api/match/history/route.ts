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
        game_duration,
        ktm_match_participants (
          player_name, team, role, champion_name, kills, deaths, assists,
          player_mmr, kda_score, mmr_delta, mmr_breakdown, cs, gold, damage_dealt, vision_score
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const matchIds = (data || []).map((m: any) => m.id);

    // edge_tasks から詳細スタッツ(ktm_match_detail_stats)を一括取得してマージ
    const detailMap = new Map<string, any>();
    if (matchIds.length > 0) {
      try {
        const { data: detailTasks } = await supabase
          .from('edge_tasks')
          .select('payload')
          .eq('task_type', 'ktm_match_detail_stats')
          .limit(100);

        if (detailTasks) {
          for (const t of detailTasks) {
            const p = t.payload;
            if (p?.matchId) {
              detailMap.set(String(p.matchId), p);
            }
          }
        }
      } catch (dErr) {
        // edge_tasks 取得失敗時はフォールバック（続行）
      }
    }

    const matches = (data || []).map((m: any) => {
      const detail = detailMap.get(String(m.id));
      const detailPartsMap = new Map<string, any>();
      if (detail?.participants) {
        for (const dp of detail.participants) {
          detailPartsMap.set(dp.name, dp);
        }
      }

      const mergedParticipants = (m.ktm_match_participants || []).map((p: any) => {
        const dp = detailPartsMap.get(p.player_name);
        return {
          ...p,
          items: dp?.items || [],
          spells: dp?.spells || [],
          time_dead: dp?.time_dead || 0,
          cc_time: dp?.cc_time || 0,
          solo_kills: dp?.solo_kills || 0,
          damage_mitigated: dp?.damage_mitigated || 0,
          building_damage: dp?.building_damage || 0,
        };
      });

      return {
        id: m.id,
        created_at: m.created_at,
        winning_team: m.winning_team,
        game_duration: m.game_duration || 0,
        participants: mergedParticipants,
      };
    });

    if (!withPredictions || matches.length === 0) {
      return NextResponse.json({ matches });
    }

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
