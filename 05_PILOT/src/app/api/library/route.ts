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
    const channel = searchParams.get('channel') || '';
    const sort = searchParams.get('sort') || 'date_desc'; // 'date_desc' | 'date_asc' | 'volume_desc' | 'title_asc'
    const limit = parseInt(searchParams.get('limit') || '60', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // チャンネル名辞書を youtube_queue からロード（URL → channel_name）
    const { data: queueRows } = await supabase
      .from('youtube_queue')
      .select('url, channel_name')
      .not('channel_name', 'is', null)
      .limit(2000);

    const channelMap: Record<string, string> = {};
    if (queueRows) {
      for (const qr of queueRows) {
        if (qr.url && qr.channel_name) {
          channelMap[qr.url.trim()] = qr.channel_name.trim();
        }
      }
    }

    let query = supabase
      .from('personal_knowledge')
      .select('id, title, champion, source_url, tags, genre, created_at, content')
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,raw_content.ilike.%${q}%`);
    }

    if (champion) {
      query = query.ilike('champion', `%${champion}%`);
    }

    // 全件取得してカテゴリ集計＆チャンネル抽出＆フィルタリング
    const { data, error } = await query.limit(2000);
    if (error) throw error;

    const allRows = data || [];
    let lolCount = 0;
    let generalCount = 0;

    // 各記事のチャンネル名と文字数を解決
    const enrichedRows = allRows.map((r: any) => {
      let ch = '';
      if (r.source_url && channelMap[r.source_url.trim()]) {
        ch = channelMap[r.source_url.trim()];
      } else if (r.content) {
        const m = r.content.match(/>\s*-\s*\*\*チャンネル\*\*:\s*([^\n\r]+)/);
        if (m) ch = m[1].trim();
      }

      // チャンネル名正規化（Kireiの表記揺れ統一など）
      if (ch.toLowerCase() === 'kireilol') ch = 'Coach Kirei';
      if (ch.toLowerCase() === 'coach kirei') ch = 'Coach Kirei';

      const charCount = (r.content || '').length;

      // レスポンス軽量化のため一覧では content 本文を削る
      const { content, ...rest } = r;
      return {
        ...rest,
        channel: ch || 'その他・一般',
        char_count: charCount,
      };
    });

    for (const r of enrichedRows) {
      if (isLolRecord(r)) lolCount++;
      else generalCount++;
    }

    let filtered = enrichedRows;
    if (category === 'lol') {
      filtered = enrichedRows.filter(isLolRecord);
    } else if (category === 'general') {
      filtered = enrichedRows.filter((r: any) => !isLolRecord(r));
    }

    // チャンネル集計（フィルタ前/カテゴリ内のチャンネル一覧と件数）
    const channelCountsMap: Record<string, number> = {};
    for (const r of filtered) {
      const ch = r.channel;
      channelCountsMap[ch] = (channelCountsMap[ch] || 0) + 1;
    }
    const channelList = Object.entries(channelCountsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // チャンネル指定フィルタ
    if (channel) {
      filtered = filtered.filter((r: any) => r.channel === channel);
    }

    // ソート処理
    if (sort === 'date_desc') {
      filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'date_asc') {
      filtered.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sort === 'volume_desc') {
      filtered.sort((a: any, b: any) => (b.char_count || 0) - (a.char_count || 0));
    } else if (sort === 'title_asc') {
      filtered.sort((a: any, b: any) => a.title.localeCompare(b.title, 'ja'));
    }

    const paged = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      articles: paged,
      total: filtered.length,
      channels: channelList,
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
