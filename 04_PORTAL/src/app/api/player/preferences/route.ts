import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { getAuthSession } from '@/lib/authGuard';
import { findOrCreatePlayer } from '@/lib/playerCoins';
import { fetchAllRows } from '@/lib/fetchAll';
import { normalizeRole } from '@/lib/roleUtils';

export const dynamic = 'force-dynamic';

/**
 * GET: ログイン中のユーザーのプロフィール＆レーン設定、および名簿連携の実績戦績を取得
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'Discordログインが必要です。' },
        { status: 401 }
      );
    }

    // プレイヤーを取得（なければ自動作成）
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username || 'Player',
    });

    if (!player) {
      return NextResponse.json(
        { ok: false, error: 'プレイヤー情報の取得に失敗しました。' },
        { status: 404 }
      );
    }

    // 名簿データ連携: ktm_match_participants からリアルタイム集計
    let dynamicStats = {
      total: { g: 0, w: 0 },
      roles: {
        TOP: { g: 0, w: 0 },
        JG: { g: 0, w: 0 },
        MID: { g: 0, w: 0 },
        ADC: { g: 0, w: 0 },
        SUP: { g: 0, w: 0 },
      } as Record<string, { g: number; w: number }>,
      topChampions: [] as Array<{ champion: string; games: number; wins: number; winRate: number }>,
      recentMatches: [] as Array<{
        matchId: string;
        date: string;
        isWin: boolean;
        role: string;
        champion: string;
        kills: number;
        deaths: number;
        assists: number;
      }>,
    };

    try {
      if (supabase) {
        // 1. 該当プレイヤーの参加レコードを取得
        const { data: playerMatches } = await fetchAllRows((from, to) =>
          supabase
            .from('ktm_match_participants')
            .select('match_id, role, champion_name, team, kills, deaths, assists, mmr_delta')
            .eq('player_name', player.name)
            .range(from, to)
        );

        if (playerMatches && playerMatches.length > 0) {
          const matchIds = Array.from(new Set(playerMatches.map((m: any) => m.match_id)));

          // 2. 該当試合の勝敗情報を取得
          const { data: matches } = await supabase
            .from('ktm_matches')
            .select('id, created_at, winning_team')
            .in('id', matchIds)
            .order('created_at', { ascending: false });

          const matchMap = new Map<string, any>();
          (matches || []).forEach((m: any) => matchMap.set(String(m.id), m));

          let totalGames = 0;
          let totalWins = 0;
          const champMap: Record<string, { games: number; wins: number }> = {};
          const recentList: any[] = [];

          // 試合順に並べ替えて集計
          playerMatches.forEach((row: any) => {
            const mKey = String(row.match_id);
            const match = matchMap.get(mKey);
            if (!match) return;

            const role = normalizeRole(row.role);
            const isWin = row.team === match.winning_team;
            const champ = row.champion_name || 'Unknown';

            totalGames++;
            if (isWin) totalWins++;

            // ロール別集計
            if (role && dynamicStats.roles[role]) {
              dynamicStats.roles[role].g++;
              if (isWin) dynamicStats.roles[role].w++;
            }

            // チャンピオン別集計
            if (!champMap[champ]) champMap[champ] = { games: 0, wins: 0 };
            champMap[champ].games++;
            if (isWin) champMap[champ].wins++;

            recentList.push({
              matchId: mKey,
              date: match.created_at,
              isWin,
              role: role || 'FILL',
              champion: champ,
              kills: row.kills ?? 0,
              deaths: row.deaths ?? 0,
              assists: row.assists ?? 0,
            });
          });

          dynamicStats.total = { g: totalGames, w: totalWins };

          // 得意チャンピオン Top 5
          dynamicStats.topChampions = Object.entries(champMap)
            .map(([champion, s]) => ({
              champion,
              games: s.games,
              wins: s.wins,
              winRate: Math.round((s.wins / s.games) * 100),
            }))
            .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
            .slice(0, 5);

          // 直近5試合（新しい順）
          recentList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          dynamicStats.recentMatches = recentList.slice(0, 5);
        }
      }
    } catch (statsErr) {
      console.warn('[player/preferences GET] Stats aggregation error:', statsErr);
    }

    return NextResponse.json({
      ok: true,
      player: {
        id: player.id,
        discord_id: player.discord_id,
        name: player.name,
        ign: player.ign || '',
        highest_rank: player.highest_rank || 'UNRANKED',
        coins: player.coins ?? player.role_preferences?.coins ?? 1000,
        role_preferences: player.role_preferences || { primary: 'FILL', secondary: 'FILL', ng_roles: [] },
        ng_lane_1: player.ng_lane_1 || null,
        ng_lane_2: player.ng_lane_2 || null,
        stats: dynamicStats,
        mmr: player.mmr || 1200,
        avatar: session.avatar,
        isAdmin: session.isAdmin || false,
      },
    });
  } catch (err: any) {
    console.error('[player/preferences GET] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST / PATCH: ログイン中のユーザー自身が希望レーン・NGレーン・IGN・師弟設定を更新
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json(
        { ok: false, error: 'Discordログインが必要です。' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { primary, secondary, ng_roles, ign, mentorship } = body;

    // プレイヤーを取得
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username || 'Player',
    });

    if (!player) {
      return NextResponse.json(
        { ok: false, error: 'プレイヤーが見つかりませんでした。' },
        { status: 404 }
      );
    }

    const currentPrefs = player.role_preferences || {};
    const updatedPrefs = {
      ...currentPrefs,
      primary: primary || currentPrefs.primary || 'FILL',
      secondary: secondary || currentPrefs.secondary || 'FILL',
      ng_roles: Array.isArray(ng_roles) ? ng_roles : (currentPrefs.ng_roles || []),
      ...(mentorship !== undefined ? { mentorship } : {}),
    };

    const ng1 = Array.isArray(ng_roles) && ng_roles.length > 0 ? ng_roles[0] : null;
    const ng2 = Array.isArray(ng_roles) && ng_roles.length > 1 ? ng_roles[1] : null;

    const { error: updateError } = await supabase
      .from('ktm_players')
      .update({
        role_preferences: updatedPrefs,
        ng_lane_1: ng1,
        ng_lane_2: ng2,
        ...(ign !== undefined ? { ign: ign.trim() } : {}),
      })
      .eq('id', player.id);

    if (updateError) {
      console.error('[player/preferences POST] updateError:', updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: '設定を保存しました。',
      player: {
        ...player,
        ign: ign !== undefined ? ign.trim() : player.ign,
        role_preferences: updatedPrefs,
        ng_lane_1: ng1,
        ng_lane_2: ng2,
      },
    });
  } catch (err: any) {
    console.error('[player/preferences POST] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
