import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { normalizeChampionName } from '../../../../lib/championNames';

export const dynamic = 'force-dynamic';

// チャンピオン名（例: Aatrox）を受け取り、そのチャンピオンに関する
// 保存済み対面（マッチアップ）メモ一覧（vs 敵チャンピオン）を返す。
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const championParam = searchParams.get('champion');
    if (!championParam) {
      return NextResponse.json({ error: 'championパラメータが必要です' }, { status: 400 });
    }

    const champion = normalizeChampionName(championParam);
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が無効です' }, { status: 500 });
    }

    // matchup_sentinel から該当チャンピオンの対面行（enemy != 'GLOBAL'）を取得
    const { data: rows, error } = await supabase
      .from('matchup_sentinel')
      .select('matchup_id, champion, enemy, title, strategy, updated_at, created_at, raw_data')
      .eq('champion', champion)
      .neq('enemy', 'GLOBAL')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const matchups = (rows || []).map((r: any) => ({
      matchupId: r.matchup_id,
      champion: r.champion,
      enemy: r.enemy,
      title: r.title,
      strategy: r.strategy,
      updatedAt: r.updated_at || r.created_at,
      source: r.raw_data?.source || null,
      sourceTitle: r.raw_data?.source_title || null,
    }));

    return NextResponse.json({ success: true, champion, matchups });
  } catch (err: any) {
    console.error('[api/champions/matchups] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
