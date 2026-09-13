import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

// ktm_players の軽量一覧（プレイヤー検索・選択ドロップダウン用の読み取り専用API）。
// 各プレイヤーの通算試合数（total_games）もktm_match_participantsから高速集計してマージする。
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [{ data: players, error: pError }, { data: participants, error: mError }] = await Promise.all([
      supabase
        .from('ktm_players')
        .select('id, name, ign, discord_id, is_active, mmr, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, highest_rank, role_preferences')
        .order('is_active', { ascending: false })
        .order('name', { ascending: true }),
      fetchAllRows((from, to) =>
        supabase
          .from('ktm_match_participants')
          .select('player_name, discord_id')
          .range(from, to)
      )
    ]);

    if (pError) throw pError;

    // 参加回数の集計マップを作成（discord_id と name_lower の両方で引けるようにする）
    const gamesByDiscord = new Map<string, number>();
    const gamesByNameLower = new Map<string, number>();

    (participants || []).forEach((row: any) => {
      if (row.discord_id) {
        const dId = String(row.discord_id).trim();
        gamesByDiscord.set(dId, (gamesByDiscord.get(dId) || 0) + 1);
      }
      if (row.player_name) {
        const nLow = String(row.player_name).trim().toLowerCase();
        gamesByNameLower.set(nLow, (gamesByNameLower.get(nLow) || 0) + 1);
      }
    });

    const enrichedPlayers = (players || []).map((p: any) => {
      let totalG = 0;
      if (p.discord_id && gamesByDiscord.has(String(p.discord_id).trim())) {
        totalG = gamesByDiscord.get(String(p.discord_id).trim()) || 0;
      } else if (p.name && gamesByNameLower.has(String(p.name).trim().toLowerCase())) {
        totalG = gamesByNameLower.get(String(p.name).trim().toLowerCase()) || 0;
      }
      return {
        ...p,
        total_games: totalG,
        games: totalG
      };
    });

    return NextResponse.json({ players: enrichedPlayers });
  } catch (err: any) {
    console.error('[players/list] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
