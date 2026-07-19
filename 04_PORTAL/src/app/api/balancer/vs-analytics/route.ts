import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { calculatePlaystyle } from '../../../../lib/playstyle';

// 対戦分析(VS Analytics)の実データ化(#75)。
// 指定プレイヤー(最大10名)の試合履歴からプレイスタイルをその場で計算して返す。
// これまで参照していた playstyle_cache.custom は書き込み処理が無く常に初期値だった。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { names } = await req.json();
    if (!Array.isArray(names) || names.length === 0 || names.length > 12) {
      return NextResponse.json({ error: 'names(1〜12名)が必要です。' }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from('ktm_match_participants')
      .select('player_name, kills, deaths, assists, cs, damage_dealt, vision_score, team, ktm_matches!inner(winning_team, game_duration, created_at)')
      .in('player_name', names)
      .order('created_at', { ascending: false, referencedTable: 'ktm_matches' })
      .limit(names.length * 30); // 1人あたり直近~30戦ぶんを目安に制限（エグレス配慮）

    if (error) throw error;

    const byPlayer: Record<string, any[]> = {};
    (rows || []).forEach((r: any) => {
      if (!byPlayer[r.player_name]) byPlayer[r.player_name] = [];
      if (byPlayer[r.player_name].length < 30) byPlayer[r.player_name].push(r);
    });

    const styles: Record<string, any> = {};
    for (const name of names) {
      styles[name] = calculatePlaystyle(byPlayer[name] || []);
      styles[name].games = (byPlayer[name] || []).length; // 表示用に試合数も添付
    }

    return NextResponse.json({ success: true, styles });
  } catch (e: any) {
    console.error('[vs-analytics] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
