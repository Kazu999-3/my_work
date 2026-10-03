import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabaseクライアントが未初期化です',
        favorites: [],
        itemDict: {},
        laneRoles: {},
      }, { status: 500 });
    }

    // 1. ktm_settings からお気に入りとアイテム辞書を取得
    const { data: settingsData, error: settingsError } = await supabase
      .from('ktm_settings')
      .select('key, value')
      .in('key', ['pilot_fav_champions', 'pilot_item_dict']);

    if (settingsError) {
      console.warn('ktm_settings 取得エラー:', settingsError);
    }

    let favorites: string[] = [];
    let itemDict: Record<string, string> = {};

    if (settingsData) {
      for (const row of settingsData) {
        if (row.key === 'pilot_fav_champions' && Array.isArray(row.value)) {
          favorites = row.value;
        } else if (row.key === 'pilot_item_dict' && row.value && typeof row.value === 'object') {
          itemDict = row.value;
        }
      }
    }

    // 2. champion_lane_roles からレーン所属設定を取得
    const { data: laneData, error: laneError } = await supabase
      .from('champion_lane_roles')
      .select('champion, role, rank')
      .order('rank', { ascending: true });

    if (laneError) {
      console.warn('champion_lane_roles 取得エラー:', laneError);
    }

    const laneRoles: Record<string, string[]> = {};
    if (laneData) {
      for (const row of laneData) {
        if (!laneRoles[row.champion]) {
          laneRoles[row.champion] = [];
        }
        const role = row.role === 'ADC' ? 'ADC' : row.role;
        if (!laneRoles[row.champion].includes(role)) {
          laneRoles[row.champion].push(role);
        }
      }
    }

    return NextResponse.json({
      success: true,
      favorites,
      itemDict,
      laneRoles,
    });
  } catch (err: any) {
    console.error('pilot/settings GET エラー:', err);
    return NextResponse.json({
      success: false,
      error: err.message || '設定の取得に失敗しました',
      favorites: [],
      itemDict: {},
      laneRoles: {},
    }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ success: false, error: 'keyが指定されていません' }, { status: 400 });
    }

    // お気に入り設定の更新
    if (key === 'favorites' || key === 'pilot_fav_champions') {
      const favList = Array.isArray(value) ? value : [];
      const { error } = await supabase
        .from('ktm_settings')
        .upsert(
          { key: 'pilot_fav_champions', value: favList, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
      return NextResponse.json({ success: true, favorites: favList });
    }

    // アイテム辞書の更新
    if (key === 'itemDict' || key === 'pilot_item_dict') {
      const dictObj = value && typeof value === 'object' ? value : {};
      const { error } = await supabase
        .from('ktm_settings')
        .upsert(
          { key: 'pilot_item_dict', value: dictObj, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
      return NextResponse.json({ success: true, itemDict: dictObj });
    }

    // レーン所属設定の更新 (bulk: Record<string, string[]> または単一 { champion, roles })
    if (key === 'laneRoles' || key === 'pilot_custom_roles') {
      if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, string[]>);
        for (const [champion, roles] of entries) {
          if (!Array.isArray(roles)) continue;
          // 既存行を削除して再挿入
          await supabase.from('champion_lane_roles').delete().eq('champion', champion);
          if (roles.length > 0) {
            const rows = roles.map((role: string, idx: number) => ({
              champion,
              role: role === 'BOT' ? 'ADC' : role,
              rank: idx + 1,
              source: 'user_custom',
              updated_at: new Date().toISOString(),
            }));
            await supabase.from('champion_lane_roles').insert(rows);
          }
        }
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: '無効なlaneRolesデータ形式です' }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: `未対応のキーです: ${key}` }, { status: 400 });
  } catch (err: any) {
    console.error('pilot/settings PUT エラー:', err);
    return NextResponse.json({ success: false, error: err.message || '設定の更新に失敗しました' }, { status: 500 });
  }
}
