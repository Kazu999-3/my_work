import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';


// 1. ナレッジ一覧の取得 (検索 & フィルタ)
export async function GET(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get('genre');
    const queryStr = searchParams.get('query');

    let dbQuery = supabase.from('personal_knowledge').select('id, created_at, title, content, raw_content, source_url, genre, tags, champion');

    if (genre && genre !== 'all') {
      dbQuery = dbQuery.eq('genre', genre);
    }

    if (queryStr && queryStr.trim() !== '' && queryStr !== 'null' && queryStr !== 'undefined') {
      dbQuery = dbQuery.or(`title.ilike.%${queryStr}%,content.ilike.%${queryStr}%,raw_content.ilike.%${queryStr}%`);
    }

    // 最新順 (上限100件に制限してメモリと描画負荷を低減)
    dbQuery = dbQuery.order('created_at', { ascending: false }).limit(100);

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
