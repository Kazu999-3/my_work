// 05移植(2026-10-04): 旧ポータルから移植。認証は 05 の proxy.ts が担う。Riot ID は画面から渡す（lib/riotIdParam.ts）。
import { NextResponse } from 'next/server';
import { getRiotId, RIOT_ID_REQUIRED_MESSAGE } from '@/lib/riotIdParam';
import { supabase as supabaseClient } from '@/lib/supabaseClient';
const supabase = supabaseClient!;
import { fetchPuuidByRiotId } from '@/lib/riot';

// soloq_match_history を曜日(0=日〜6=土, JST基準)×時間帯(0-23時)で集計し、
// 勝率ヒートマップ用のセルデータを返す読み取り専用API。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const apiKey = process.env.RIOT_API_KEY!;
    const riotId = getRiotId(req);
    if (!apiKey) return NextResponse.json({ error: 'RIOT_API_KEY が未設定です。' }, { status: 500 });
    if (!riotId) return NextResponse.json({ error: RIOT_ID_REQUIRED_MESSAGE }, { status: 400 });
    const { gameName, tagLine } = riotId;
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    const { data, error } = await supabase
      .from('soloq_match_history')
      .select('game_start_timestamp, win')
      .eq('puuid', puuid)
      .order('game_start_timestamp', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const cellMap: Record<string, { games: number; wins: number }> = {};
    rows.forEach((row: any) => {
      const utcMs = new Date(row.game_start_timestamp).getTime();
      // JST(UTC+9)基準の曜日・時間帯に変換
      const jst = new Date(utcMs + 9 * 3600 * 1000);
      const day = jst.getUTCDay(); // 0=日 ... 6=土
      const hour = jst.getUTCHours();
      const key = `${day}-${hour}`;
      if (!cellMap[key]) cellMap[key] = { games: 0, wins: 0 };
      cellMap[key].games++;
      if (row.win) cellMap[key].wins++;
    });

    const cells = Object.entries(cellMap).map(([key, stat]) => {
      const [day, hour] = key.split('-').map(Number);
      return {
        day,
        hour,
        games: stat.games,
        wins: stat.wins,
        winRate: Math.round((stat.wins / stat.games) * 100),
      };
    });

    return NextResponse.json({
      cells,
      totalGames: rows.length,
      oldestMatch: rows.length > 0 ? rows[rows.length - 1].game_start_timestamp : null,
      newestMatch: rows.length > 0 ? rows[0].game_start_timestamp : null,
    });
  } catch (err: any) {
    console.error('[soloq/heatmap] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
