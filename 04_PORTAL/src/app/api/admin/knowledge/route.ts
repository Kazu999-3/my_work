import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey
);

// 1. ナレッジ一覧の取得 (検索 & フィルタ)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get('genre');
    const queryStr = searchParams.get('query');

    let dbQuery = supabase.from('personal_knowledge').select('*');

    if (genre && genre !== 'all') {
      dbQuery = dbQuery.eq('genre', genre);
    }

    if (queryStr) {
      dbQuery = dbQuery.or(`title.ilike.%${queryStr}%,content.ilike.%${queryStr}%,raw_content.ilike.%${queryStr}%`);
    }

    // 最新順
    dbQuery = dbQuery.order('created_at', { ascending: false });

    const { data, error } = await dbQuery;

    if (error) throw error;
    return NextResponse.json(data || []);

  } catch (err: any) {
    console.error('❌ [Knowledge API] GET Error:', err);
    return NextResponse.json({ error: 'ナレッジの取得に失敗しました。' }, { status: 500 });
  }
}

// 2. ナレッジの削除
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'IDを指定してください。' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('personal_knowledge')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: '指定されたナレッジが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'ナレッジをナレッジベースから削除しました。'
    });

  } catch (err: any) {
    console.error('❌ [Knowledge API] DELETE Error:', err);
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}
