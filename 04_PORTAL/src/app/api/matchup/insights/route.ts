import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

// バトルサーチ刷新用の集計API。
//  - recent : 直近の自分の対面（F: 対面カルテ／振り返り導線）
//  - weak   : 苦手対面ランキング（D）
//  - pair   : 特定ペアのクイックビュー（A）
// いずれも matchup_log を集計元にする。
export const dynamic = 'force-dynamic';

const MIN_GAMES_FOR_WEAK = 2;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind') || 'recent';
    const player = url.searchParams.get('player');       // player_name
    const my = url.searchParams.get('my');               // 自分のチャンプ
    const enemy = url.searchParams.get('enemy');         // 相手のチャンプ
    const days = Number(url.searchParams.get('days') || 0); // E: 期間フィルタ(0=全期間)

    let q = supabase
      .from('matchup_log')
      .select('player_name, role, my_champion, enemy_champion, is_win, kills, deaths, assists, created_at')
      .order('created_at', { ascending: false });

    if (player) q = q.eq('player_name', player);
    if (days > 0) q = q.gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

    if (kind === 'pair') {
      if (!my || !enemy) return NextResponse.json({ error: 'my と enemy が必要です。' }, { status: 400 });
      const { data, error } = await q.eq('my_champion', my).eq('enemy_champion', enemy).limit(50);
      if (error) throw error;
      const rows = data || [];
      const wins = rows.filter((r: any) => r.is_win).length;
      const k = rows.reduce((s: number, r: any) => s + (r.kills || 0), 0);
      const d = rows.reduce((s: number, r: any) => s + (r.deaths || 0), 0);
      const a = rows.reduce((s: number, r: any) => s + (r.assists || 0), 0);
      return NextResponse.json({
        success: true,
        games: rows.length,
        wins,
        winRate: rows.length ? Math.round((wins / rows.length) * 100) : null,
        kda: d > 0 ? Math.round(((k + a) / d) * 10) / 10 : k + a,
        history: rows.slice(0, 10).map((r: any) => ({
          isWin: r.is_win, role: r.role, kills: r.kills, deaths: r.deaths, assists: r.assists, date: r.created_at,
        })),
      });
    }

    const { data, error } = await q.limit(kind === 'weak' ? 800 : 20);
    if (error) throw error;
    const rows = data || [];

    if (kind === 'weak') {
      // ペアごとに集計し、勝率が低い順（=苦手）に並べる
      const agg: Record<string, { my: string; enemy: string; games: number; wins: number; deaths: number }> = {};
      rows.forEach((r: any) => {
        if (!r.my_champion || !r.enemy_champion) return;
        const key = `${r.my_champion}|${r.enemy_champion}`;
        if (!agg[key]) agg[key] = { my: r.my_champion, enemy: r.enemy_champion, games: 0, wins: 0, deaths: 0 };
        agg[key].games++;
        if (r.is_win) agg[key].wins++;
        agg[key].deaths += r.deaths || 0;
      });
      const list = Object.values(agg)
        .filter((x) => x.games >= MIN_GAMES_FOR_WEAK)
        .map((x) => ({ ...x, winRate: Math.round((x.wins / x.games) * 100), avgDeaths: Math.round((x.deaths / x.games) * 10) / 10 }))
        .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
        .slice(0, 12);
      return NextResponse.json({ success: true, weak: list });
    }

    // recent: 直近の対面（振り返り導線用）
    return NextResponse.json({
      success: true,
      recent: rows.map((r: any) => ({
        playerName: r.player_name, role: r.role,
        my: r.my_champion, enemy: r.enemy_champion,
        isWin: r.is_win, kills: r.kills, deaths: r.deaths, assists: r.assists, date: r.created_at,
      })),
    });
  } catch (e: any) {
    console.error('[matchup/insights] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
