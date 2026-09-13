import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { fetchAllRows } from '../../../../../lib/fetchAll';

// ktm-admin/page.tsx（名簿管理画面）専用: ktm_players の全カラムを返す管理者専用読み取りAPI。
// 各プレイヤーの通算試合数（total_games）、直近30日参加数（recent_games_30d）、最終参加日（last_played_at）を集計してマージする。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const [{ data: players, error: pError }, { data: participants, error: mError }] = await Promise.all([
      supabase
        .from('ktm_players')
        .select('*')
        .order('name', { ascending: true }),
      fetchAllRows((from, to) =>
        supabase
          .from('ktm_match_participants')
          .select('player_name, discord_id, created_at')
          .range(from, to)
      )
    ]);

    if (pError) throw pError;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // 参加実績の集計マップを作成（discord_id と name_lower の両方で引けるようにする）
    interface PlayerHistoryStats {
      total: number;
      recent30d: number;
      lastPlayedAt: number | null;
    }

    const statsByDiscord = new Map<string, PlayerHistoryStats>();
    const statsByNameLower = new Map<string, PlayerHistoryStats>();

    const updateStats = (map: Map<string, PlayerHistoryStats>, key: string, time: number) => {
      let stat = map.get(key);
      if (!stat) {
        stat = { total: 0, recent30d: 0, lastPlayedAt: null };
        map.set(key, stat);
      }
      stat.total += 1;
      if (time >= thirtyDaysAgo) {
        stat.recent30d += 1;
      }
      if (!stat.lastPlayedAt || time > stat.lastPlayedAt) {
        stat.lastPlayedAt = time;
      }
    };

    (participants || []).forEach((row: any) => {
      const matchTime = row.created_at ? new Date(row.created_at).getTime() : 0;
      if (row.discord_id) {
        const dId = String(row.discord_id).trim();
        updateStats(statsByDiscord, dId, matchTime);
      }
      if (row.player_name) {
        const nLow = String(row.player_name).trim().toLowerCase();
        updateStats(statsByNameLower, nLow, matchTime);
      }
    });

    const enrichedPlayers = (players || []).map((p: any) => {
      let historyStat: PlayerHistoryStats = { total: 0, recent30d: 0, lastPlayedAt: null };

      if (p.discord_id && statsByDiscord.has(String(p.discord_id).trim())) {
        historyStat = statsByDiscord.get(String(p.discord_id).trim())!;
      } else if (p.name && statsByNameLower.has(String(p.name).trim().toLowerCase())) {
        historyStat = statsByNameLower.get(String(p.name).trim().toLowerCase())!;
      }

      const daysSinceLast = historyStat.lastPlayedAt 
        ? Math.floor((now - historyStat.lastPlayedAt) / (24 * 60 * 60 * 1000))
        : null;

      return {
        ...p,
        total_games: historyStat.total,
        games: historyStat.total,
        recent_games_30d: historyStat.recent30d,
        last_played_at: historyStat.lastPlayedAt ? new Date(historyStat.lastPlayedAt).toISOString() : null,
        days_since_last_match: daysSinceLast
      };
    });

    return NextResponse.json({ players: enrichedPlayers });
  } catch (err: any) {
    console.error('[admin/players/list] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
