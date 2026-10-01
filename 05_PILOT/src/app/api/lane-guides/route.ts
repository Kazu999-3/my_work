import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const LANES = [
  { key: 'COMMON', label: '🌐 全レーン共通マクロ' },
  { key: 'TOP', label: '⚔️ TOP レーン攻略' },
  { key: 'JG', label: '🌲 JG ジャングル攻略' },
  { key: 'MID', label: '⚡ MID レーン攻略' },
  { key: 'ADC', label: '🏹 BOT/ADC レーン攻略' },
  { key: 'SUP', label: '🛡️ SUP サポート攻略' },
];

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('lane_guides')
      .select('lane, title, body, source_count, updated_at');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      guides: data || [],
      lanes: LANES,
    });
  } catch (e: any) {
    console.error('lane_guides APIエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}
