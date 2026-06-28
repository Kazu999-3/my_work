import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase環境変数が設定されていません。' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { matchup_id, champion, enemy, strategy, raw_data } = body;

    if (!matchup_id || !champion || !enemy) {
      return NextResponse.json({ error: '必須パラメータが不足しています。' }, { status: 400 });
    }

    const data = {
      matchup_id,
      champion,
      enemy,
      strategy: strategy || '',
      raw_data: raw_data || {},
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('matchup_sentinel')
      .upsert(data, { onConflict: 'matchup_id' })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'チャンピオン辞典を安全に更新しました。',
      data: result
    });

  } catch (err: any) {
    console.error('❌ [Champion Save API] POST Error:', err);
    return NextResponse.json({ error: 'チャンピオン辞典の保存に失敗しました: ' + err.message }, { status: 500 });
  }
}
