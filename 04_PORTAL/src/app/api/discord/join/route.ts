import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { discord_id, is_active } = body;

    if (!discord_id) {
      return NextResponse.json({ error: 'discord_id が必要です。' }, { status: 400 });
    }

    // discord_idを元にプレイヤーを特定して更新
    const { data, error } = await supabase
      .from('ktm_players')
      .update({ is_active: is_active ?? true })
      .eq('discord_id', discord_id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: '指定された discord_id のプレイヤーが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `プレイヤー ${data[0].name} の参加ステータスを ${is_active ? '参加' : '不参加'} に更新しました。`,
      player: data[0]
    });

  } catch (error: any) {
    console.error('Discord Join Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'ステータスの更新に失敗しました。' }, { status: 500 });
  }
}
