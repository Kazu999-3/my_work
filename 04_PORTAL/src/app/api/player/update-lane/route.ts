import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// レーン希望・NG・こだわり度・格上許可の更新。ktm_players は RLS(migration 12)で
// anon直書き不可なため、BOTからはこのサーバーAPI(サービスロール)経由で更新する。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { discordId, discordName, main, sub, ng1, ng2, weight, allowHigher } = await req.json();
    if (!discordId) {
      return NextResponse.json({ status: 'ERROR', message: 'discordId が必要です。' }, { status: 400 });
    }

    // 既存プレイヤーを discord_id → 名前 の順で探す
    let player: any = null;
    const { data: byId } = await supabase.from('ktm_players').select('*').eq('discord_id', discordId).limit(1);
    if (byId && byId.length > 0) {
      player = byId[0];
    } else if (discordName) {
      const { data: byName } = await supabase.from('ktm_players').select('*').eq('name', discordName).limit(1);
      if (byName && byName.length > 0) {
        player = byName[0];
        player.discord_id = discordId; // Discord ID を紐付ける
      }
    }
    if (!player) {
      player = { discord_id: discordId, name: discordName || 'Unknown', is_active: true };
    }

    // マージ
    player.role_preferences = player.role_preferences || {};
    if (main) player.role_preferences.primary = main;
    if (sub) player.role_preferences.secondary = sub;
    if (ng1) player.ng_lane_1 = ng1;
    if (ng2) player.ng_lane_2 = ng2;
    if (weight !== undefined && weight !== null && weight !== '') {
      const w = parseInt(String(weight));
      if (!Number.isNaN(w)) player.weight = w;
    }
    if (allowHigher !== undefined && allowHigher !== null && allowHigher !== '') {
      player.allow_higher = (allowHigher === 'true' || allowHigher === true);
    }

    // 書き込み（既存はupdate、新規はupsert）
    const payload: any = { ...player };
    delete payload.created_at;
    let error;
    if (player.id) {
      delete payload.id;
      ({ error } = await supabase.from('ktm_players').update(payload).eq('id', player.id));
    } else {
      ({ error } = await supabase.from('ktm_players').upsert(payload, { onConflict: 'discord_id' }));
    }
    if (error) throw new Error(error.message);

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (e: any) {
    console.error('[update-lane] error:', e);
    return NextResponse.json({ status: 'ERROR', message: e.message }, { status: 500 });
  }
}
