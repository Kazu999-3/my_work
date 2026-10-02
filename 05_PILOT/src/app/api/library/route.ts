import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

function isLolRecord(item: any): boolean {
  if (item.champion && item.champion !== 'Unknown' && item.champion !== 'null') return true;
  const source = (item.source_url || '').toLowerCase();
  if (source.includes('_lol') || source.includes('leagueoflegends')) return true;
  const genre = (item.genre || '').toLowerCase();
  if (genre.includes('lol') || genre.includes('マクロ') || genre.includes('ビルド') || genre.includes('メカニクス')) return true;
  const tagsStr = (item.tags || []).join(' ').toLowerCase();
  if (tagsStr.includes('lol') || tagsStr.includes('jg') || tagsStr.includes('league') || tagsStr.includes('マクロ') || tagsStr.includes('ビルド')) return true;
  const title = (item.title || '').toLowerCase();
  const lolWords = [
    'lol', 'league', 'jg', 'jungle', 'gank', 'lane', 'patch', 'パッチ', 'ガンク',
    'ジャングル', 'レーン', 'ドラゴン', 'バロン', 'サモナー', 'チャレンジャー',
    'マスター', 'ダイヤ', 'ランク', 'ソロq', 'ビルド', 'ルーン', 'coach', 'kirei',
    '対面', 'ピック', 'elo', 'midgame', 'early game', 'late game', 'challenger',
    'macro', 'micro', 'smite', 'roam', 'dive', 'wave', 'troll', 'carry', 'inting', 'hardstuck'
  ];
  return lolWords.some(w => title.includes(w));
}

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const champion = searchParams.get('champion') || '';
    const category = searchParams.get('category') || 'lol'; // 'lol' | 'general' | 'all'
    const limit = parseInt(searchParams.get('limit') || '60', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('personal_knowledge')
      .select('id, title, champion, source_url, tags, genre, created_at')
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,raw_content.ilike.%${q}%`);
    }

    if (champion) {
      query = query.ilike('champion', `%${champion}%`);
    }

    // 全件取得してカテゴリ集計＆フィルタリング
    const { data, error } = await query.limit(1000);
    if (error) throw error;

    const allRows = data || [];
    let lolCount = 0;
    let generalCount = 0;

    for (const r of allRows) {
      if (isLolRecord(r)) lolCount++;
      else generalCount++;
    }

    let filtered = allRows;
    if (category === 'lol') {
      filtered = allRows.filter(isLolRecord);
    } else if (category === 'general') {
      filtered = allRows.filter(r => !isLolRecord(r));
    }

    const paged = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      articles: paged,
      total: filtered.length,
      counts: {
        lol: lolCount,
        general: generalCount,
        all: allRows.length,
      },
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
