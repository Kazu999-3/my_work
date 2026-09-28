import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

// ktm_players の軽量一覧（プレイヤー検索・選択ドロップダウン用の読み取り専用API）。
// 各プレイヤーの通算試合数（total_games）、直近30日参加数（recent_games_30d）、最終参加日（last_played_at）を集計してマージする。
export const dynamic = 'force-dynamic';

// 参加履歴(全件・1,200行超)は試合記録時にしか変わらないのに、毎リクエスト全件取得→集計していた
// (応答0.8〜1.5秒の主因、2026-09-29実測)。参加者リスト本体(is_active等)は即時性が要るため
// キャッシュせず、履歴集計の元データだけを関数インスタンス内で短時間使い回す。
// 試合記録直後は最大 PARTICIPANTS_TTL_MS だけ通算試合数等の反映が遅れる。
const PARTICIPANTS_TTL_MS = 60 * 1000;
let participantsCache: { at: number; rows: any[] } | null = null;

async function loadParticipants(): Promise<any[]> {
  if (participantsCache && Date.now() - participantsCache.at < PARTICIPANTS_TTL_MS) {
    return participantsCache.rows;
  }
  const { data } = await fetchAllRows((from, to) =>
    supabase
      .from('ktm_match_participants')
      .select('player_name, discord_id, created_at')
      .range(from, to)
  );
  const rows = data || [];
  participantsCache = { at: Date.now(), rows };
  return rows;
}

export async function GET(request: Request) {
  try {
    // ?lite=1: 名前・ランク等だけ欲しい画面(カジノの送金先候補など)向け。参加履歴の集計を省く
    const lite = new URL(request.url).searchParams.get('lite') === '1';
    const [{ data: players, error: pError }, participants] = await Promise.all([
      supabase
        .from('ktm_players')
        // ⚠️ 2026-09-23 修正: NG設定・こだわり・格上許可・Pity の6列が select から漏れており、
        // バランサーの一覧でこれらが常に空（初期値）として表示されていた。
        // DBには値が入っている（NG設定3名・こだわり7名など）ので、取得漏れが原因。
        .select('id, name, ign, discord_id, is_active, mmr, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, highest_rank, role_preferences, ng_lane_1, ng_lane_2, weight, allow_higher, pity, off_role_pity, spectator_pity')
        .order('is_active', { ascending: false })
        .order('name', { ascending: true }),
      lite ? Promise.resolve([] as any[]) : loadParticipants(),
    ]);

    if (pError) throw pError;
    if (lite) {
      return NextResponse.json({ players: players || [] });
    }

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
    console.error('[players/list] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
