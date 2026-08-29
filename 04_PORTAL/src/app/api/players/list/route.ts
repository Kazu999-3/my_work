import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// ktm_players の軽量一覧（プレイヤー検索・選択ドロップダウン用の読み取り専用API）。
// ktm_players は元々RLSでSELECT公開だが、直接アクセスのAPI経由化の方針に合わせ、
// ブラウザからの直接クエリをここに統一する。metadata等の重い列は含めない(#53のエグレス対策を踏襲)。
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ktm_players')
      .select('id, name, ign, discord_id, is_active, mmr, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, highest_rank, role_preferences, preferred_lane')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ players: data || [] });
  } catch (err: any) {
    console.error('[players/list] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
