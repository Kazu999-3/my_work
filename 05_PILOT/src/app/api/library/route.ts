import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const champion = searchParams.get('champion') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('personal_knowledge')
      .select('id, title, champion, source_url, tags, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (q) {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,raw_content.ilike.%${q}%`);
    }

    if (champion) {
      query = query.ilike('champion', `%${champion}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      articles: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (e: any) {
    console.error('library APIエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

// 単一記事詳細取得 (POST)
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'idが必要です' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('personal_knowledge')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, article: data });
  } catch (e: any) {
    console.error('library 単一記事取得エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}
